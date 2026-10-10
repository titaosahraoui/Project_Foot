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
import * as pitchesService from "../pitches/pitches.service";
import * as teamsService from "../teams/teams.service";
import { assertBookingCompatible } from "./booking-compatibility";
import * as repo from "./bookings.repository";

export * from "./booking-compatibility";
export { isBookingCollisionError } from "./bookings.repository";

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

  // Load accepted challenge through matchmaking.service
  await matchmakingService.expireDueChallenges(now, tx);
  const challenge = await matchmakingService.getChallengeById(input.challengeId, tx);
  if (!challenge) {
    throw new HttpError(404, "Challenge not found");
  }

  // Verify challenger team and actor captaincy
  const challengerTeam = await teamsService.getTeam(challenge.challengerTeamId);
  const isChallengerCaptain = challengerTeam.members.some(
    (m) =>
      m.userId === actorId &&
      (m.role === "CAPTAIN" || (m as any).teamRole === "CAPTAIN"),
  );

  // Load pitch and exact inventory through pitches.service
  const pitch = await pitchesService.getPitch(input.pitchId);
  const durationMinutes = Math.round((reqEnd.getTime() - reqStart.getTime()) / 60000);
  const availableSlots = await pitchesService.getAvailableSlots(pitch.id, {
    from: reqStart.toISOString(),
    to: reqEnd.toISOString(),
    durationMinutes,
  });

  // Apply compatibility
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
      priceAmountMinor: pitch.hourlyRate.amountMinor,
      currency: pitch.hourlyRate.currency,
      availabilityRules: pitch.availabilityRules,
      blocks: pitch.blocks,
    },
    availableSlots,
    now,
  });

  // Check if there is already an active booking for this challenge
  const existingActive = await repo.findActiveBookingByChallengeId(challenge.id, tx);
  if (existingActive) {
    throw new HttpError(
      409,
      "An active booking request already exists for this challenge",
      "STATE_CONFLICT",
    );
  }

  // Calculate owner deadline: earlier of 24h after booking request or 2h before match start
  const ownerResponseDeadline = calculateOwnerResponseDeadline(now, reqStart);

  const execute = async (client: RepositoryContext) => {
    if (key) {
      const inTxCached = await readIdempotentResult(actorId, scope, key);
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

    const activeInTx = await repo.findActiveBookingByChallengeId(challenge.id, client);
    if (activeInTx) {
      throw new HttpError(
        409,
        "An active booking request already exists for this challenge",
        "STATE_CONFLICT",
      );
    }

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

  if (tx) {
    return await execute(tx);
  }
  return await withTransaction(execute);
}

export async function getBookingById(
  id: string,
  viewerUserId?: string,
): Promise<BookingDetailDto> {
  const booking = await repo.findBookingById(id);
  if (!booking) {
    throw new HttpError(404, "Booking not found", "NOT_FOUND");
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
