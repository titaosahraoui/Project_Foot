import {
  calculateOwnerResponseDeadline,
  createBookingSchema,
  type BlockingRange,
  type BookingDetailDto,
  type BookingDto,
  type CreateBookingInput,
  type ListBookingsQuery,
  type PaginatedBookings,
} from "@footconnect/shared";
import {
  hashIdempotencyRequest,
  readIdempotentResult,
  storeIdempotentResult,
} from "../../lib/idempotency";
import { withTransaction, type RepositoryContext } from "../../lib/transaction";
import { HttpError } from "../../middleware/error-handler";
import * as matchmakingService from "../matchmaking/matchmaking.service";
import { assertBookingCompatible } from "./booking-compatibility";
import * as repo from "./bookings.repository";

export * from "./booking-compatibility";
export { isBookingCollisionError } from "./bookings.repository";

const inFlightBookingRequests = new Map<string, Promise<BookingDto>>();

export function toBookingDto(booking: repo.BookingWithRelations | any): BookingDto {
  return {
    id: booking.id,
    pitchId: booking.pitchId,
    challengeId: booking.challengeId,
    organizerUserId: booking.organizerUserId,
    challengerTeamId: booking.challengerTeamId,
    opponentTeamId: booking.opponentTeamId,
    startAt: booking.startAt instanceof Date ? booking.startAt.toISOString() : booking.startAt,
    endAt: booking.endAt instanceof Date ? booking.endAt.toISOString() : booking.endAt,
    priceAmountMinor: booking.priceAmountMinor,
    currency: booking.currency as "DZD",
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    ownerResponseDeadline:
      booking.ownerResponseDeadline instanceof Date
        ? booking.ownerResponseDeadline.toISOString()
        : booking.ownerResponseDeadline,
    confirmedAt: booking.confirmedAt
      ? booking.confirmedAt instanceof Date
        ? booking.confirmedAt.toISOString()
        : booking.confirmedAt
      : null,
    declinedAt: booking.declinedAt
      ? booking.declinedAt instanceof Date
        ? booking.declinedAt.toISOString()
        : booking.declinedAt
      : null,
    cancelledAt: booking.cancelledAt
      ? booking.cancelledAt instanceof Date
        ? booking.cancelledAt.toISOString()
        : booking.cancelledAt
      : null,
    expiresAt: booking.expiresAt
      ? booking.expiresAt instanceof Date
        ? booking.expiresAt.toISOString()
        : booking.expiresAt
      : null,
    createdAt:
      booking.createdAt instanceof Date
        ? booking.createdAt.toISOString()
        : booking.createdAt,
    updatedAt:
      booking.updatedAt instanceof Date
        ? booking.updatedAt.toISOString()
        : booking.updatedAt,
  };
}

export function toBookingDetailDto(
  booking: repo.BookingWithRelations,
  viewerUserId?: string,
): BookingDetailDto {
  const base = toBookingDto(booking);
  const isOwner = viewerUserId && booking.pitch.ownerId === viewerUserId;
  const isOrganizer = viewerUserId && booking.organizerUserId === viewerUserId;

  return {
    ...base,
    pitch: {
      id: booking.pitch.id,
      name: booking.pitch.name,
      address: booking.pitch.address,
      city: booking.pitch.city,
      surface: booking.pitch.surface,
      size: booking.pitch.size,
      priceAmountMinor: booking.pitch.priceAmountMinor,
      currency: booking.pitch.currency,
      photos: booking.pitch.photos ?? [],
    },
    challengerTeam: {
      id: booking.challengerTeam.id,
      name: booking.challengerTeam.name,
      logoUrl: booking.challengerTeam.logoUrl,
    },
    opponentTeam: {
      id: booking.opponentTeam.id,
      name: booking.opponentTeam.name,
      logoUrl: booking.opponentTeam.logoUrl,
    },
    organizerUser: {
      id: booking.organizerUser.id,
      displayName: booking.organizerUser.displayName,
      email: booking.organizerUser.email,
    },
    matchId: null,
    viewerPermissions: {
      canConfirm: Boolean(isOwner && booking.status === "PENDING_OWNER_CONFIRMATION"),
      canDecline: Boolean(isOwner && booking.status === "PENDING_OWNER_CONFIRMATION"),
      canCancel: Boolean(
        isOrganizer &&
          (booking.status === "PENDING_OWNER_CONFIRMATION" || booking.status === "CONFIRMED"),
      ),
    },
  };
}

export async function createBooking(
  actorId: string,
  input: CreateBookingInput,
  idempotencyKey?: string,
  now?: Date,
  tx?: RepositoryContext,
): Promise<BookingDto>;
export async function createBooking(
  data: repo.CreateBookingData,
  db?: RepositoryContext,
): Promise<BookingDto>;
export async function createBooking(
  actorIdOrData: string | repo.CreateBookingData,
  inputOrDb?: CreateBookingInput | RepositoryContext,
  idempotencyKey?: string,
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<BookingDto> {
  if (typeof actorIdOrData !== "string") {
    const booking = await repo.createBooking(
      actorIdOrData,
      inputOrDb as RepositoryContext,
    );
    return toBookingDto(booking);
  }

  const actorId = actorIdOrData;
  const rawInput = inputOrDb as CreateBookingInput;
  const input = createBookingSchema.parse(rawInput);
  const reqStart = new Date(input.startAt);
  const reqEnd = new Date(input.endAt);

  const scope = "booking:create";
  const key = idempotencyKey;
  const requestPayload = {
    actorId,
    challengeId: input.challengeId,
    pitchId: input.pitchId,
    startAt: input.startAt,
    endAt: input.endAt,
  };
  const requestHash = hashIdempotencyRequest(requestPayload);

  // If this key is already in flight in the same process, wait for it
  if (key) {
    const flightKey = `${actorId}:${scope}:${key}`;
    const inFlight = inFlightBookingRequests.get(flightKey);
    if (inFlight) {
      try {
        const res = await inFlight;
        const cached = await readIdempotentResult(actorId, scope, key);
        if (cached) {
          if (cached.requestHash !== requestHash) {
            throw new HttpError(
              409,
              "Idempotency key was already used for a different request",
              "CONFLICT",
              { scope, key },
            );
          }
          return cached.responseBody as BookingDto;
        }
        return res;
      } catch {
        // If prior in-flight request threw, check if it was cached before letting this proceed
        const cached = await readIdempotentResult(actorId, scope, key);
        if (cached) {
          if (cached.requestHash === requestHash) {
            return cached.responseBody as BookingDto;
          }
          throw new HttpError(
            409,
            "Idempotency key was already used for a different request",
            "CONFLICT",
            { scope, key },
          );
        }
      }
    }
  }

  const doCreate = async (): Promise<BookingDto> => {
    // 1. Initial idempotency read
    if (key) {
      const cached = await readIdempotentResult(actorId, scope, key);
      if (cached) {
        if (cached.requestHash !== requestHash) {
          throw new HttpError(
            409,
            "Idempotency key was already used for a different request",
            "CONFLICT",
            { scope, key },
          );
        }
        return cached.responseBody as BookingDto;
      }
    }

    const execute = async (client: RepositoryContext) => {
      // Re-check idempotency in transaction
      if (key) {
        const inTxCached = await readIdempotentResult(actorId, scope, key, client);
        if (inTxCached) {
          if (inTxCached.requestHash !== requestHash) {
            throw new HttpError(
              409,
              "Idempotency key was already used for a different request",
              "CONFLICT",
              { scope, key },
            );
          }
          return inTxCached.responseBody as BookingDto;
        }
      }

      // Expire due challenges in tx
      await matchmakingService.expireDueChallenges(now, client);

      // Lock challenge row with SELECT ... FOR UPDATE to share locks with competing updates
      const rawChallenges = await client.$queryRaw<
        Array<{
          id: string;
          challengerAvailabilityId: string;
          opponentAvailabilityId: string;
          challengerTeamId: string;
          opponentTeamId: string;
          organizerUserId: string;
          format: string;
          startAt: Date;
          endAt: Date;
          originLat: number;
          originLng: number;
          radiusKm: number;
          responseDeadline: Date;
          bookingDeadline: Date | null;
          status: string;
        }>
      >`
        SELECT id, "challengerAvailabilityId", "opponentAvailabilityId", "challengerTeamId",
               "opponentTeamId", "organizerUserId", format, "startAt", "endAt",
               "originLat", "originLng", "radiusKm", "responseDeadline", "bookingDeadline", status
        FROM match_challenges
        WHERE id = ${input.challengeId}
        FOR UPDATE
      `;

      const challenge = rawChallenges[0];
      if (!challenge) {
        throw new HttpError(404, "Challenge not found");
      }

      if (challenge.status !== "ACCEPTED") {
        throw new HttpError(
          409,
          `Challenge is not in ACCEPTED status (current: ${challenge.status})`,
          "STATE_CONFLICT",
        );
      }

      if (!challenge.bookingDeadline) {
        throw new HttpError(
          409,
          "Challenge has no active booking deadline",
          "STATE_CONFLICT",
        );
      }

      if (now.getTime() >= new Date(challenge.bookingDeadline).getTime()) {
        throw new HttpError(
          409,
          "Challenge booking deadline has passed",
          "STATE_CONFLICT",
        );
      }

      // Verify challenger captaincy in tx
      const captainMembership = await client.teamMembership.findFirst({
        where: {
          teamId: challenge.challengerTeamId,
          userId: actorId,
          role: "CAPTAIN",
          status: "ACTIVE",
        },
      });
      const isChallengerCaptain = Boolean(captainMembership);

      // Load pitch with rules and blocks in tx
      const pitch = await client.pitch.findUnique({
        where: { id: input.pitchId },
        include: {
          availabilityRules: { where: { isActive: true } },
          blocks: { where: { cancelledAt: null } },
        },
      });
      if (!pitch) {
        throw new HttpError(404, "Pitch not found");
      }

      const rules = pitch.availabilityRules.map((r) => ({
        id: r.id,
        pitchId: r.pitchId,
        dayOfWeek: r.dayOfWeek,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
        startTime: `${String(Math.floor(r.startMinute / 60)).padStart(2, "0")}:${String(r.startMinute % 60).padStart(2, "0")}`,
        endTime: `${String(Math.floor(r.endMinute / 60)).padStart(2, "0")}:${String(r.endMinute % 60).padStart(2, "0")}`,
        timezone: "Africa/Algiers" as const,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));

      const blocks = pitch.blocks.map((b) => ({
        id: b.id,
        pitchId: b.pitchId,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        reason: b.reason,
        createdById: b.createdById,
        createdAt: b.createdAt.toISOString(),
        cancelledAt: b.cancelledAt ? b.cancelledAt.toISOString() : null,
      }));

      // Apply compatibility assertions first (actor is organizer/captain, window, format, distance, rules)
      const compatibility = assertBookingCompatible({
        challenge: {
          status: challenge.status,
          bookingDeadline: challenge.bookingDeadline,
          organizerUserId: challenge.organizerUserId,
          challengerTeamId: challenge.challengerTeamId,
          format: challenge.format,
          startAt: challenge.startAt,
          endAt: challenge.endAt,
          originLat: challenge.originLat,
          originLng: challenge.originLng,
          radiusKm: challenge.radiusKm,
        },
        actorId,
        isChallengerCaptain,
        requestedStartAt: reqStart,
        requestedEndAt: reqEnd,
        pitch: {
          id: pitch.id,
          isActive: pitch.isActive,
          size: pitch.size,
          lat: pitch.lat,
          lng: pitch.lng,
          priceAmountMinor: pitch.priceAmountMinor,
          currency: pitch.currency,
          availabilityRules: rules,
          blocks,
        },
        now,
      });

      // Check active booking for challenge in client
      const activeInTx = await repo.findActiveBookingByChallengeId(challenge.id, client);
      if (activeInTx) {
        throw new HttpError(
          409,
          "An active booking request already exists for this challenge",
          "STATE_CONFLICT",
        );
      }

      // Check competing pitch blocks in tx
      const conflictingBlock = await client.pitchBlock.findFirst({
        where: {
          pitchId: input.pitchId,
          cancelledAt: null,
          startAt: { lt: reqEnd },
          endAt: { gt: reqStart },
        },
      });
      if (conflictingBlock) {
        throw new HttpError(
          409,
          "Selected slot is no longer available in pitch inventory or is blocked",
          "INVENTORY_CONFLICT",
        );
      }

      // Check competing pitch bookings in tx
      const conflictingBooking = await client.booking.findFirst({
        where: {
          pitchId: input.pitchId,
          status: { in: ["PENDING_OWNER_CONFIRMATION", "CONFIRMED"] },
          startAt: { lt: reqEnd },
          endAt: { gt: reqStart },
        },
      });
      if (conflictingBooking) {
        throw new HttpError(
          409,
          "The requested time slot overlaps with an existing booking on this pitch",
          "INVENTORY_CONFLICT",
        );
      }

      // Calculate owner deadline: earlier of 24h after booking request or 2h before match start
      const ownerResponseDeadline = calculateOwnerResponseDeadline(now, reqStart);

      const created = await repo.createBooking(
        {
          pitchId: pitch.id,
          challengeId: challenge.id,
          organizerUserId: actorId,
          challengerTeamId: challenge.challengerTeamId,
          opponentTeamId: challenge.opponentTeamId,
          startAt: reqStart,
          endAt: reqEnd,
          priceAmountMinor: compatibility.priceAmountMinor,
          currency: compatibility.currency as "DZD",
          status: "PENDING_OWNER_CONFIRMATION",
          paymentStatus: "UNPAID",
          ownerResponseDeadline,
        },
        client,
      );

      const bookingDto = toBookingDto(created);

      if (key) {
        await storeIdempotentResult(
          {
            actorId,
            scope,
            key,
            requestHash,
            resourceType: "Booking",
            resourceId: created.id,
            responseStatus: 201,
            responseBody: bookingDto,
            expiresAt: ownerResponseDeadline,
          },
          client,
        );
      }

      return bookingDto;
    };

    try {
      if (tx) {
        return await execute(tx);
      }
      return await withTransaction(execute);
    } catch (err) {
      // Conflict recovery for concurrent requests sharing the same key
      if (key) {
        const recovered = await readIdempotentResult(actorId, scope, key);
        if (recovered) {
          if (recovered.requestHash === requestHash) {
            return recovered.responseBody as BookingDto;
          }
          throw new HttpError(
            409,
            "Idempotency key was already used for a different request",
            "CONFLICT",
            { scope, key },
          );
        }
      }
      throw err;
    }
  };

  if (key) {
    const flightKey = `${actorId}:${scope}:${key}`;
    const p = (async () => {
      try {
        return await doCreate();
      } finally {
        inFlightBookingRequests.delete(flightKey);
      }
    })();
    inFlightBookingRequests.set(flightKey, p);
    return await p;
  }

  return await doCreate();
}

export async function getBookingById(
  id: string,
  viewerUserId?: string,
): Promise<BookingDetailDto> {
  const booking = await repo.findBookingById(id);
  if (!booking) {
    throw new HttpError(404, "Booking not found", "NOT_FOUND");
  }
  if (!viewerUserId || !repo.isUserRelatedToBooking(booking, viewerUserId)) {
    throw new HttpError(
      403,
      "You do not have permission to view this booking",
      "FORBIDDEN",
    );
  }
  return toBookingDetailDto(booking, viewerUserId);
}

export async function getBlockingBookingRangesForPitch(
  pitchId: string,
  from: Date,
  to: Date,
): Promise<BlockingRange[]> {
  const items = await repo.findBlockingBookingRanges({ pitchId, from, to });
  return items.map((b) => ({
    startAt: b.startAt,
    endAt: b.endAt,
  }));
}

export async function getBlockingBookingRangesForPitches(
  pitchIds: string[],
  from: Date,
  to: Date,
): Promise<Map<string, BlockingRange[]>> {
  const items = await repo.findBlockingBookingRanges({ pitchIds, from, to });
  const map = new Map<string, BlockingRange[]>();
  for (const id of pitchIds) {
    map.set(id, []);
  }
  for (const item of items) {
    const list = map.get(item.pitchId) ?? [];
    list.push({ startAt: item.startAt, endAt: item.endAt });
    map.set(item.pitchId, list);
  }
  return map;
}

export async function listBookings(
  query: ListBookingsQuery,
  viewerUserId?: string,
): Promise<PaginatedBookings> {
  const page = query.page ?? 1;
  const pageSize = query.limit ?? query.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  if (!viewerUserId) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
    };
  }

  const { items, total } = await repo.findBookings({
    role: query.role,
    status: query.status,
    pitchId: query.pitchId,
    challengeId: query.challengeId,
    teamId: query.teamId,
    userId: viewerUserId,
    skip,
    take: pageSize,
  });

  return {
    items: items.map((b) => toBookingDetailDto(b, viewerUserId)),
    total,
    page,
    pageSize,
  };
}
