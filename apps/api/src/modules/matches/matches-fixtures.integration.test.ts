import { randomUUID } from "node:crypto";
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import {
  authHeader,
  createTestUserWithRoles,
  registerTestUser,
} from "../../test/integration-helpers";
import * as teamsService from "../teams/teams.service";

describe("matches fixtures API (integration - M09-T01)", () => {
  let app: Express;
  const runId = randomUUID();

  // Users
  let pitchOwnerToken = "";
  let pitchOwnerId = "";

  let homeCaptainToken = "";
  let homeCaptainId = "";

  let awayCaptainToken = "";
  let awayCaptainId = "";

  let homePlayerToken = "";
  let homePlayerId = "";

  let awayPlayerToken = "";
  let awayPlayerId = "";

  let removedPlayerToken = "";
  let removedPlayerId = "";

  let adminToken = "";
  let adminId = "";

  let strangerToken = "";
  let strangerId = "";

  // Entities
  let homeTeamId = "";
  let awayTeamId = "";
  let pitchId = "";

  // Matches
  let upcomingMatchId1 = "";
  let upcomingMatchId2 = "";
  let pastMatchId = "";

  let bookingId1 = "";
  let bookingId2 = "";
  let bookingId3 = "";

  let challengeId1 = "";
  let challengeId2 = "";
  let challengeId3 = "";

  let availId1 = "";
  let availId2 = "";
  let availId3 = "";

  const now = new Date();
  const upcomingStart1 = new Date(now.getTime() + 1 * 86400000); // +1 day
  const upcomingEnd1 = new Date(upcomingStart1.getTime() + 90 * 60000);

  const upcomingStart2 = new Date(now.getTime() + 3 * 86400000); // +3 days
  const upcomingEnd2 = new Date(upcomingStart2.getTime() + 90 * 60000);

  const pastStart = new Date(now.getTime() - 2 * 86400000); // -2 days
  const pastEnd = new Date(pastStart.getTime() + 90 * 60000);

  beforeAll(async () => {
    app = createApp();

    // 1. Create users
    const ownerRes = await createTestUserWithRoles(app, ["PITCH_OWNER"], {
      displayName: "Arena Owner",
    });
    pitchOwnerToken = ownerRes.accessToken;
    pitchOwnerId = ownerRes.user.id;

    const hCapRes = await registerTestUser(app, { displayName: "Riyad Captain" });
    homeCaptainToken = hCapRes.accessToken;
    homeCaptainId = hCapRes.user.id;

    const aCapRes = await registerTestUser(app, { displayName: "Ismail Captain" });
    awayCaptainToken = aCapRes.accessToken;
    awayCaptainId = aCapRes.user.id;

    const hPlayRes = await registerTestUser(app, { displayName: "Youcef Player" });
    homePlayerToken = hPlayRes.accessToken;
    homePlayerId = hPlayRes.user.id;

    const aPlayRes = await registerTestUser(app, { displayName: "Baghdad Player" });
    awayPlayerToken = aPlayRes.accessToken;
    awayPlayerId = aPlayRes.user.id;

    const remPlayRes = await registerTestUser(app, { displayName: "Removed Player" });
    removedPlayerToken = remPlayRes.accessToken;
    removedPlayerId = remPlayRes.user.id;

    const adminRes = await createTestUserWithRoles(app, ["ADMIN"], {
      displayName: "Super Admin",
    });
    adminToken = adminRes.accessToken;
    adminId = adminRes.user.id;

    const strangerRes = await registerTestUser(app, { displayName: "Stranger Player" });
    strangerToken = strangerRes.accessToken;
    strangerId = strangerRes.user.id;

    // 2. Create teams
    const homeTeam = await prisma.team.create({
      data: {
        name: `M09 Home Stars ${runId}`,
        members: {
          create: [
            { userId: homeCaptainId, role: "CAPTAIN", status: "ACTIVE" },
            { userId: homePlayerId, role: "MEMBER", status: "ACTIVE" },
            { userId: removedPlayerId, role: "MEMBER", status: "ACTIVE" },
          ],
        },
      },
    });
    homeTeamId = homeTeam.id;

    const awayTeam = await prisma.team.create({
      data: {
        name: `M09 Away Warriors ${runId}`,
        members: {
          create: [
            { userId: awayCaptainId, role: "CAPTAIN", status: "ACTIVE" },
            { userId: awayPlayerId, role: "MEMBER", status: "ACTIVE" },
          ],
        },
      },
    });
    awayTeamId = awayTeam.id;

    // 3. Create pitch
    const pitch = await prisma.pitch.create({
      data: {
        name: `Stade Baraki Arena ${runId}`,
        ownerId: pitchOwnerId,
        surface: "ARTIFICIAL_TURF",
        size: "FIVE_A_SIDE",
        priceAmountMinor: 450000,
        currency: "DZD",
        address: "Baraki District, Algiers",
        city: "Algiers",
        lat: 36.68,
        lng: 3.09,
      },
    });
    pitchId = pitch.id;

    // Helper to create booking and match fixture
    async function setupMatchFixture(startAt: Date, endAt: Date, _label?: string) {
      const avail = await prisma.teamAvailability.create({
        data: {
          teamId: homeTeamId,
          createdById: homeCaptainId,
          startAt,
          endAt,
          format: "FIVE_A_SIDE",
          originLat: 36.68,
          originLng: 3.09,
          radiusKm: 15,
          eloTolerance: 150,
          expiresAt: startAt,
          status: "MATCHED",
        },
      });

      const challenge = await prisma.matchChallenge.create({
        data: {
          challengerTeamId: homeTeamId,
          opponentTeamId: awayTeamId,
          challengerAvailabilityId: avail.id,
          opponentAvailabilityId: avail.id,
          organizerUserId: homeCaptainId,
          format: "FIVE_A_SIDE",
          startAt,
          endAt,
          originLat: 36.68,
          originLng: 3.09,
          radiusKm: 15,
          responseDeadline: new Date(Date.now() + 86400000),
          bookingDeadline: new Date(Date.now() + 86400000),
          status: "ACCEPTED",
        },
      });

      const booking = await prisma.booking.create({
        data: {
          pitchId,
          challengeId: challenge.id,
          organizerUserId: homeCaptainId,
          challengerTeamId: homeTeamId,
          opponentTeamId: awayTeamId,
          startAt,
          endAt,
          priceAmountMinor: 450000,
          currency: "DZD",
          status: "CONFIRMED",
          paymentStatus: "UNPAID",
          ownerResponseDeadline: new Date(Date.now() + 86400000),
          confirmedAt: new Date(),
        },
      });

      const match = await prisma.match.create({
        data: {
          bookingId: booking.id,
          homeTeamId,
          awayTeamId,
          homeCaptainId,
          awayCaptainId,
          pitchOwnerId,
          startAt,
          endAt,
          format: "FIVE_A_SIDE",
          status: "SCHEDULED",
          participants: {
            create: [
              { teamId: homeTeamId, captainId: homeCaptainId, role: "HOME" },
              { teamId: awayTeamId, captainId: awayCaptainId, role: "AWAY" },
            ],
          },
        },
      });

      return { availId: avail.id, challengeId: challenge.id, bookingId: booking.id, matchId: match.id };
    }

    const f1 = await setupMatchFixture(upcomingStart1, upcomingEnd1, "upcoming-1");
    availId1 = f1.availId;
    challengeId1 = f1.challengeId;
    bookingId1 = f1.bookingId;
    upcomingMatchId1 = f1.matchId;

    const f2 = await setupMatchFixture(upcomingStart2, upcomingEnd2, "upcoming-2");
    availId2 = f2.availId;
    challengeId2 = f2.challengeId;
    bookingId2 = f2.bookingId;
    upcomingMatchId2 = f2.matchId;

    const f3 = await setupMatchFixture(pastStart, pastEnd, "past");
    availId3 = f3.availId;
    challengeId3 = f3.challengeId;
    bookingId3 = f3.bookingId;
    pastMatchId = f3.matchId;

    // Now remove `removedPlayer` from home team so they are no longer active
    await prisma.teamMembership.delete({
      where: { teamId_userId: { teamId: homeTeamId, userId: removedPlayerId } },
    });
  });

  afterAll(async () => {
    try {
      const matchIds = [upcomingMatchId1, upcomingMatchId2, pastMatchId].filter(Boolean);
      if (matchIds.length > 0) {
        await prisma.matchParticipant.deleteMany({
          where: { matchId: { in: matchIds } },
        });
        await prisma.match.deleteMany({
          where: { id: { in: matchIds } },
        });
      }

      const bookingIds = [bookingId1, bookingId2, bookingId3].filter(Boolean);
      if (bookingIds.length > 0) {
        await prisma.booking.deleteMany({
          where: { id: { in: bookingIds } },
        });
      }

      const challengeIds = [challengeId1, challengeId2, challengeId3].filter(Boolean);
      if (challengeIds.length > 0) {
        await prisma.matchChallenge.deleteMany({
          where: { id: { in: challengeIds } },
        });
      }

      const availIds = [availId1, availId2, availId3].filter(Boolean);
      if (availIds.length > 0) {
        await prisma.teamAvailability.deleteMany({
          where: { id: { in: availIds } },
        });
      }

      if (pitchId) {
        await prisma.pitch.deleteMany({ where: { id: pitchId } });
      }

      if (homeTeamId && awayTeamId) {
        await prisma.teamMembership.deleteMany({
          where: { teamId: { in: [homeTeamId, awayTeamId] } },
        });
        await prisma.team.deleteMany({
          where: { id: { in: [homeTeamId, awayTeamId] } },
        });
      }

      const userIds = [
        pitchOwnerId,
        homeCaptainId,
        awayCaptainId,
        homePlayerId,
        awayPlayerId,
        removedPlayerId,
        adminId,
        strangerId,
      ].filter(Boolean);
      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  // -------------------------------------------------------------------------
  // 1. Every Viewer Access Tests
  // -------------------------------------------------------------------------
  describe("Every viewer access", () => {
    it("allows home team active player to view match detail", async () => {
      const res = await request(app)
        .get(`/api/v1/matches/${upcomingMatchId1}`)
        .set(authHeader(homePlayerToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(upcomingMatchId1);
      expect(res.body.homeTeam.id).toBe(homeTeamId);
      expect(res.body.viewerActions).toBeDefined();
    });

    it("allows away team active player to view match detail", async () => {
      const res = await request(app)
        .get(`/api/v1/matches/${upcomingMatchId1}`)
        .set(authHeader(awayPlayerToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(upcomingMatchId1);
      expect(res.body.awayTeam.id).toBe(awayTeamId);
    });

    it("allows designated home captain to view match detail", async () => {
      const res = await request(app)
        .get(`/api/v1/matches/${upcomingMatchId1}`)
        .set(authHeader(homeCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(upcomingMatchId1);
      expect(res.body.homeCaptain.id).toBe(homeCaptainId);
    });

    it("allows designated away captain to view match detail", async () => {
      const res = await request(app)
        .get(`/api/v1/matches/${upcomingMatchId1}`)
        .set(authHeader(awayCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(upcomingMatchId1);
      expect(res.body.awayCaptain.id).toBe(awayCaptainId);
    });

    it("allows pitch owner to view match detail", async () => {
      const res = await request(app)
        .get(`/api/v1/matches/${upcomingMatchId1}`)
        .set(authHeader(pitchOwnerToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(upcomingMatchId1);
      expect(res.body.pitchOwner.id).toBe(pitchOwnerId);
    });

    it("allows admin to view any match detail", async () => {
      const res = await request(app)
        .get(`/api/v1/matches/${upcomingMatchId1}`)
        .set(authHeader(adminToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(upcomingMatchId1);
    });

    it("designated captain retains access even if their team membership later changes", async () => {
      // Simulate transferring captaincy of home team to homePlayerId
      await teamsService.transferCaptain(homeTeamId, homeCaptainId, {
        newCaptainUserId: homePlayerId,
      });

      // Also mark homeCaptain's membership as LEFT
      await prisma.teamMembership.update({
        where: { teamId_userId: { teamId: homeTeamId, userId: homeCaptainId } },
        data: { status: "LEFT" },
      });

      // Original designated home captain MUST retain access
      const res = await request(app)
        .get(`/api/v1/matches/${upcomingMatchId1}`)
        .set(authHeader(homeCaptainToken));

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(upcomingMatchId1);

      // And it must still be returned in their /matches/mine
      const mineRes = await request(app)
        .get("/api/v1/matches/mine")
        .set(authHeader(homeCaptainToken));

      expect(mineRes.status).toBe(200);
      const matchIds = mineRes.body.items.map((m: any) => m.id);
      expect(matchIds).toContain(upcomingMatchId1);
    });

    it("denies access to a former player whose membership was removed and who was not a designated captain", async () => {
      const res = await request(app)
        .get(`/api/v1/matches/${upcomingMatchId1}`)
        .set(authHeader(removedPlayerToken));

      expect(res.status).toBe(403);
    });

    it("denies access to an unrelated stranger", async () => {
      const res = await request(app)
        .get(`/api/v1/matches/${upcomingMatchId1}`)
        .set(authHeader(strangerToken));

      expect(res.status).toBe(403);
    });

    it("denies regular players from accessing /api/v1/matches/owner", async () => {
      const res = await request(app)
        .get("/api/v1/matches/owner")
        .set(authHeader(strangerToken));

      expect(res.status).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Chronological Ordering Tests
  // -------------------------------------------------------------------------
  describe("Chronological ordering", () => {
    it("orders upcoming fixtures chronologically (startAt ASC) on /matches/mine?state=upcoming", async () => {
      const res = await request(app)
        .get("/api/v1/matches/mine?state=upcoming")
        .set(authHeader(awayPlayerToken));

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThanOrEqual(2);

      const items = res.body.items;
      const index1 = items.findIndex((m: any) => m.id === upcomingMatchId1);
      const index2 = items.findIndex((m: any) => m.id === upcomingMatchId2);

      expect(index1).toBeGreaterThanOrEqual(0);
      expect(index2).toBeGreaterThanOrEqual(0);
      expect(index1).toBeLessThan(index2); // upcoming1 (tomorrow) before upcoming2 (3 days)

      // Past match should NOT be in upcoming
      const pastMatchInUpcoming = items.find((m: any) => m.id === pastMatchId);
      expect(pastMatchInUpcoming).toBeUndefined();
    });

    it("orders past fixtures chronologically (startAt DESC) on /matches/mine?state=past", async () => {
      const res = await request(app)
        .get("/api/v1/matches/mine?state=past")
        .set(authHeader(awayPlayerToken));

      expect(res.status).toBe(200);
      const items = res.body.items;
      const foundPast = items.find((m: any) => m.id === pastMatchId);
      expect(foundPast).toBeDefined();

      // Upcoming matches should NOT be in past
      const upcomingInPast = items.find((m: any) => m.id === upcomingMatchId1);
      expect(upcomingInPast).toBeUndefined();
    });

    it("orders matches on /matches/owner with state filtering for pitch owner", async () => {
      const resUpcoming = await request(app)
        .get("/api/v1/matches/owner?state=upcoming")
        .set(authHeader(pitchOwnerToken));

      expect(resUpcoming.status).toBe(200);
      const ids = resUpcoming.body.items.map((m: any) => m.id);
      expect(ids).toContain(upcomingMatchId1);
      expect(ids).toContain(upcomingMatchId2);
      expect(ids).not.toContain(pastMatchId);

      const resPast = await request(app)
        .get("/api/v1/matches/owner?state=past")
        .set(authHeader(pitchOwnerToken));

      expect(resPast.status).toBe(200);
      const pastIds = resPast.body.items.map((m: any) => m.id);
      expect(pastIds).toContain(pastMatchId);
      expect(pastIds).not.toContain(upcomingMatchId1);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Privacy & Data Integrity
  // -------------------------------------------------------------------------
  describe("Privacy & Data Integrity", () => {
    it("does not leak email addresses or private credentials in match responses", async () => {
      const res = await request(app)
        .get(`/api/v1/matches/${upcomingMatchId1}`)
        .set(authHeader(awayPlayerToken));

      expect(res.status).toBe(200);
      const body = res.body;

      // Ensure no emails in captains or pitch owner
      expect(body.homeCaptain).toBeDefined();
      expect(body.homeCaptain.email).toBeUndefined();
      expect(body.awayCaptain.email).toBeUndefined();
      expect(body.pitchOwner.email).toBeUndefined();

      // Ensure no password hashes anywhere
      const serialized = JSON.stringify(body);
      expect(serialized).not.toContain("passwordHash");
      expect(serialized).not.toContain("password123");
    });

    it("contains no result or score fields before submission", async () => {
      const res = await request(app)
        .get(`/api/v1/matches/${upcomingMatchId1}`)
        .set(authHeader(homePlayerToken));

      expect(res.status).toBe(200);
      const body = res.body;

      // Scheduled match must NOT have score or result fields
      expect(body.score).toBeUndefined();
      expect(body.homeScore).toBeUndefined();
      expect(body.awayScore).toBeUndefined();
      expect(body.result).toBeUndefined();
      expect(body.winnerId).toBeUndefined();
    });

    it("exposes full match detail with UTC schedule, Algiers label data, public teams, pitch, format, booking price and viewer actions", async () => {
      const res = await request(app)
        .get(`/api/v1/matches/${upcomingMatchId1}`)
        .set(authHeader(awayCaptainToken));

      expect(res.status).toBe(200);
      const m = res.body;

      // Teams
      expect(m.homeTeam.name).toContain("M09 Home Stars");
      expect(typeof m.homeTeam.elo).toBe("number");
      expect(m.awayTeam.name).toContain("M09 Away Warriors");
      expect(typeof m.awayTeam.elo).toBe("number");

      // Pitch
      expect(m.pitch.name).toContain("Stade Baraki Arena");
      expect(m.pitch.city).toBe("Algiers");
      expect(m.pitch.surface).toBe("ARTIFICIAL_TURF");

      // Schedule & Algiers label data
      expect(m.startAt).toBeDefined();
      expect(m.endAt).toBeDefined();
      expect(m.algiersDateLabel).toBeDefined();
      expect(m.algiersTimeRangeLabel).toContain("–");
      expect(m.algiersKickoffLabel).toMatch(/^\d{2}:\d{2}$/);

      // Price & Payment
      expect(m.priceAmountMinor).toBe(450000);
      expect(m.currency).toBe("DZD");
      expect(m.paymentStatus).toBe("UNPAID");

      // Designated captains
      expect(m.homeCaptain.displayName).toBe("Riyad Captain");
      expect(m.awayCaptain.displayName).toBe("Ismail Captain");

      // Status
      expect(m.status).toBe("SCHEDULED");

      // Viewer actions
      expect(m.viewerActions).toBeDefined();
      expect(typeof m.viewerActions.canSubmitLineup).toBe("boolean");
    });

    it("supports pagination on /matches/mine", async () => {
      const res = await request(app)
        .get("/api/v1/matches/mine?page=1&pageSize=1")
        .set(authHeader(awayPlayerToken));

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.total).toBeGreaterThanOrEqual(2);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(1);
    });
  });
});
