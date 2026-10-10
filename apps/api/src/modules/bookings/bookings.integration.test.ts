import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import {
  calculateChallengeBookingDeadline,
  calculateChallengeResponseDeadline,
  calculateOwnerResponseDeadline,
} from "@footconnect/shared";
import { uniqueEmail } from "../../test/integration-helpers";
import * as repo from "./bookings.repository";
import * as service from "./bookings.service";

describe("bookings schema, migration, and partial unique index (integration)", () => {
  const runId = randomUUID();
  const password = "password123";

  let pitchOwnerId = "";
  let organizerId = "";
  let opponentCaptainId = "";

  let challengerTeamId = "";
  let opponentTeamId = "";

  let pitchId = "";
  let challengerAvailId = "";
  let opponentAvailId = "";
  let challengeId = "";

  const baseNow = new Date("2026-10-10T10:00:00.000Z");
  const matchStart = new Date("2026-10-15T18:00:00.000Z");
  const matchEnd = new Date("2026-10-15T20:00:00.000Z");
  const bookingStart = new Date("2026-10-15T18:00:00.000Z");
  const bookingEnd = new Date("2026-10-15T19:30:00.000Z");

  beforeAll(async () => {
    // 1. Create users
    const [pOwner, orgUser, oCap] = await Promise.all([
      prisma.user.create({
        data: {
          email: uniqueEmail(`pOwner_${runId}`),
          passwordHash: password,
          displayName: "Pitch Owner",
          roles: ["PITCH_OWNER"],
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`orgUser_${runId}`),
          passwordHash: password,
          displayName: "Organizer Captain",
          roles: ["PLAYER"],
        },
      }),
      prisma.user.create({
        data: {
          email: uniqueEmail(`oCap_${runId}`),
          passwordHash: password,
          displayName: "Opponent Captain",
          roles: ["PLAYER"],
        },
      }),
    ]);
    pitchOwnerId = pOwner.id;
    organizerId = orgUser.id;
    opponentCaptainId = oCap.id;

    // 2. Create pitch
    const pitch = await prisma.pitch.create({
      data: {
        ownerId: pitchOwnerId,
        name: `Camp Nou Algiers ${runId}`,
        description: "Premium five-a-side pitch",
        address: "10 Boulevard Colonel Amirouche",
        city: "Algiers",
        lat: 36.7538,
        lng: 3.0588,
        surface: "ARTIFICIAL_TURF",
        size: "FIVE_A_SIDE",
        priceAmountMinor: 400000, // 4,000.00 DZD
        currency: "DZD",
        amenities: ["LIGHTING", "CHANGING_ROOMS"],
      },
    });
    pitchId = pitch.id;

    // 3. Create teams
    const [cTeam, oTeam] = await Promise.all([
      prisma.team.create({
        data: {
          name: `Challenger FC ${runId}`,
          lat: 36.7538,
          lng: 3.0588,
        },
      }),
      prisma.team.create({
        data: {
          name: `Opponent FC ${runId}`,
          lat: 36.76,
          lng: 3.06,
        },
      }),
    ]);
    challengerTeamId = cTeam.id;
    opponentTeamId = oTeam.id;

    // 4. Create captain memberships
    await Promise.all([
      prisma.teamMembership.create({
        data: { teamId: challengerTeamId, userId: organizerId, role: "CAPTAIN" },
      }),
      prisma.teamMembership.create({
        data: { teamId: opponentTeamId, userId: opponentCaptainId, role: "CAPTAIN" },
      }),
    ]);

    // 5. Create team availabilities
    const [cAvail, oAvail] = await Promise.all([
      prisma.teamAvailability.create({
        data: {
          teamId: challengerTeamId,
          createdById: organizerId,
          startAt: matchStart,
          endAt: matchEnd,
          format: "FIVE_A_SIDE",
          originLat: 36.7538,
          originLng: 3.0588,
          radiusKm: 10,
          eloTolerance: 150,
          expiresAt: matchStart,
          status: "MATCHED",
        },
      }),
      prisma.teamAvailability.create({
        data: {
          teamId: opponentTeamId,
          createdById: opponentCaptainId,
          startAt: matchStart,
          endAt: matchEnd,
          format: "FIVE_A_SIDE",
          originLat: 36.76,
          originLng: 3.06,
          radiusKm: 10,
          eloTolerance: 150,
          expiresAt: matchStart,
          status: "MATCHED",
        },
      }),
    ]);
    challengerAvailId = cAvail.id;
    opponentAvailId = oAvail.id;

    // 6. Create accepted challenge
    const challenge = await prisma.matchChallenge.create({
      data: {
        challengerTeamId,
        opponentTeamId,
        challengerAvailabilityId: challengerAvailId,
        opponentAvailabilityId: opponentAvailId,
        organizerUserId: organizerId,
        format: "FIVE_A_SIDE",
        startAt: matchStart,
        endAt: matchEnd,
        originLat: 36.7538,
        originLng: 3.0588,
        radiusKm: 10,
        responseDeadline: calculateChallengeResponseDeadline(baseNow, matchStart),
        bookingDeadline: calculateChallengeBookingDeadline(baseNow, matchStart),
        status: "ACCEPTED",
        message: "Friendly challenge accepted",
        respondedAt: baseNow,
      },
    });
    challengeId = challenge.id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    await prisma.booking.deleteMany({
      where: {
        OR: [{ challengerTeamId }, { opponentTeamId }, { pitchId }],
      },
    });
    await prisma.matchChallenge.deleteMany({
      where: {
        OR: [{ challengerTeamId }, { opponentTeamId }],
      },
    });
    await prisma.teamAvailability.deleteMany({
      where: {
        OR: [{ teamId: challengerTeamId }, { teamId: opponentTeamId }],
      },
    });
    await prisma.pitch.deleteMany({
      where: { id: pitchId },
    });
    await prisma.teamMembership.deleteMany({
      where: {
        OR: [{ teamId: challengerTeamId }, { teamId: opponentTeamId }],
      },
    });
    await prisma.team.deleteMany({
      where: {
        id: { in: [challengerTeamId, opponentTeamId] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [pitchOwnerId, organizerId, opponentCaptainId] },
      },
    });
    await prisma.$disconnect();
  });

  function createTestBookingData(overrides: Partial<repo.CreateBookingData> = {}): repo.CreateBookingData {
    return {
      pitchId,
      challengeId,
      organizerUserId: organizerId,
      challengerTeamId,
      opponentTeamId,
      startAt: bookingStart,
      endAt: bookingEnd,
      priceAmountMinor: 450000, // 4,500.00 DZD snapshotted price
      currency: "DZD",
      ownerResponseDeadline: calculateOwnerResponseDeadline(baseNow, bookingStart),
      status: "PENDING_OWNER_CONFIRMATION",
      paymentStatus: "UNPAID",
      ...overrides,
    };
  }

  describe("database enums and table definition", () => {
    it("verifies BookingStatus enum exists with all expected labels in PostgreSQL", async () => {
      const rows = await prisma.$queryRaw<{ type: string; label: string }[]>`
        SELECT t.typname AS type, e.enumlabel AS label
        FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'BookingStatus'
        ORDER BY e.enumsortorder
      `;
      const labels = rows.map((r) => r.label);
      expect(labels).toEqual([
        "PENDING_OWNER_CONFIRMATION",
        "CONFIRMED",
        "DECLINED",
        "CANCELLED_BY_TEAM",
        "CANCELLED_BY_OWNER",
        "EXPIRED",
      ]);
    });

    it("verifies OfflinePaymentStatus enum exists with expected labels in PostgreSQL", async () => {
      const rows = await prisma.$queryRaw<{ type: string; label: string }[]>`
        SELECT t.typname AS type, e.enumlabel AS label
        FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'OfflinePaymentStatus'
        ORDER BY e.enumsortorder
      `;
      const labels = rows.map((r) => r.label);
      expect(labels).toEqual(["UNPAID", "PAID_AT_VENUE", "WAIVED"]);
    });
  });

  describe("booking persistence & price snapshot", () => {
    it("persists a valid Booking row with snapshotted price and relations", async () => {
      const data = createTestBookingData();
      const booking = await prisma.booking.create({
        data,
        include: {
          pitch: true,
          challenge: true,
          organizerUser: true,
          challengerTeam: true,
          opponentTeam: true,
        },
      });

      expect(booking.id).toBeDefined();
      expect(booking.status).toBe("PENDING_OWNER_CONFIRMATION");
      expect(booking.paymentStatus).toBe("UNPAID");
      expect(booking.priceAmountMinor).toBe(450000);
      expect(booking.currency).toBe("DZD");
      expect(booking.pitch.name).toBe(`Camp Nou Algiers ${runId}`);
      expect(booking.organizerUser.email).toContain(`orgUser_${runId}`);
      expect(booking.challengerTeam.name).toBe(`Challenger FC ${runId}`);
      expect(booking.opponentTeam.name).toBe(`Opponent FC ${runId}`);
      expect(booking.confirmedAt).toBeNull();
      expect(booking.declinedAt).toBeNull();
      expect(booking.cancelledAt).toBeNull();
      expect(booking.expiresAt).toBeNull();

      // Clean up
      await prisma.booking.delete({ where: { id: booking.id } });
    });
  });

  describe("database check constraints", () => {
    it("enforces different teams check constraint", async () => {
      await expect(
        prisma.booking.create({
          data: createTestBookingData({
            opponentTeamId: challengerTeamId, // same team
          }),
        }),
      ).rejects.toThrow();
    });

    it("enforces endAt > startAt window check constraint", async () => {
      await expect(
        prisma.booking.create({
          data: createTestBookingData({
            endAt: bookingStart, // equal to startAt
          }),
        }),
      ).rejects.toThrow();
    });

    it("enforces non-negative price check constraint", async () => {
      await expect(
        prisma.booking.create({
          data: createTestBookingData({
            priceAmountMinor: -500,
          }),
        }),
      ).rejects.toThrow();
    });
  });

  describe("PostgreSQL partial unique index on challengeId", () => {
    it("rejects two concurrent blocking attempts (PENDING_OWNER_CONFIRMATION) for the same challenge", async () => {
      const first = await prisma.booking.create({
        data: createTestBookingData({
          status: "PENDING_OWNER_CONFIRMATION",
        }),
      });

      // Attempting to create another PENDING booking for the same challenge must violate the partial unique index
      await expect(
        prisma.booking.create({
          data: createTestBookingData({
            status: "PENDING_OWNER_CONFIRMATION",
          }),
        }),
      ).rejects.toThrow();

      // Attempting to create a CONFIRMED booking for the same challenge must also violate the partial unique index
      await expect(
        prisma.booking.create({
          data: createTestBookingData({
            status: "CONFIRMED",
          }),
        }),
      ).rejects.toThrow();

      // Clean up
      await prisma.booking.delete({ where: { id: first.id } });
    });

    it("allows sequential new booking attempt after previous booking was DECLINED or EXPIRED", async () => {
      // 1. Create first attempt and mark it DECLINED
      const _declinedBooking = await prisma.booking.create({
        data: createTestBookingData({
          status: "DECLINED",
          declinedAt: new Date(),
        }),
      });

      // 2. Create second attempt and mark it EXPIRED
      const _expiredBooking = await prisma.booking.create({
        data: createTestBookingData({
          status: "EXPIRED",
          expiresAt: new Date(),
        }),
      });

      // 3. Create third attempt in PENDING_OWNER_CONFIRMATION for the SAME challengeId -> MUST SUCCEED
      const activeBooking = await prisma.booking.create({
        data: createTestBookingData({
          status: "PENDING_OWNER_CONFIRMATION",
        }),
      });

      expect(activeBooking.id).toBeDefined();

      // 4. Verify all sequential rows for the challenge are queryable (historical audit trail)
      const allChallengeBookings = await prisma.booking.findMany({
        where: { challengeId },
        orderBy: { createdAt: "asc" },
      });

      expect(allChallengeBookings).toHaveLength(3);
      expect(allChallengeBookings.map((b) => b.status)).toEqual([
        "DECLINED",
        "EXPIRED",
        "PENDING_OWNER_CONFIRMATION",
      ]);

      // 5. Attempting to create another blocking row while the active one exists must still fail
      await expect(
        prisma.booking.create({
          data: createTestBookingData({
            status: "PENDING_OWNER_CONFIRMATION",
          }),
        }),
      ).rejects.toThrow();

      // Clean up
      await prisma.booking.deleteMany({
        where: { challengeId },
      });
    });
  });

  describe("repository and service queries", () => {
    it("finds active booking and returns detail DTO with viewer permissions", async () => {
      const created = await repo.createBooking(createTestBookingData());

      const active = await repo.findActiveBookingByChallengeId(challengeId);
      expect(active?.id).toBe(created.id);
      expect(active?.status).toBe("PENDING_OWNER_CONFIRMATION");

      // Owner perspective
      const ownerDetail = await service.getBookingById(created.id, pitchOwnerId);
      expect(ownerDetail.viewerPermissions?.canConfirm).toBe(true);
      expect(ownerDetail.viewerPermissions?.canDecline).toBe(true);
      expect(ownerDetail.viewerPermissions?.canCancel).toBe(false);

      // Organizer perspective
      const organizerDetail = await service.getBookingById(created.id, organizerId);
      expect(organizerDetail.viewerPermissions?.canConfirm).toBe(false);
      expect(organizerDetail.viewerPermissions?.canDecline).toBe(false);
      expect(organizerDetail.viewerPermissions?.canCancel).toBe(true);

      // Clean up
      await prisma.booking.delete({ where: { id: created.id } });
    });
  });
});
