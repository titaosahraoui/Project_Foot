import {
  calculateOwnerResponseDeadline,
  createBookingSchema,
  isLateCancellation,
  type AcceptedConditionComparison,
  type BlockingRange,
  type BookingDetailDto,
  type BookingDto,
  type CancelBookingInput,
  type ConfirmBookingInput,
  type CreateBookingInput,
  type DeclineBookingInput,
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
import * as matchesService from "../matches/matches.service";
import * as matchmakingService from "../matchmaking/matchmaking.service";
import { haversineKm } from "../matchmaking/recommendation-score";
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
    cancelledByUserId: booking.cancelledByUserId ?? null,
    responsibleTeamId: booking.responsibleTeamId ?? null,
    cancellationReason: booking.cancellationReason ?? null,
    isLateCancellation: Boolean(booking.isLateCancellation),
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
  const isOwner = viewerUserId && booking.pitch?.ownerId === viewerUserId;
  const isOrganizer = viewerUserId && booking.organizerUserId === viewerUserId;
  const isChallengerCaptain =
    viewerUserId &&
    (booking.challengerTeam?.members?.some(
      (m) => m.userId === viewerUserId && m.role === "CAPTAIN" && m.status === "ACTIVE",
    ) ||
      booking.match?.homeCaptainId === viewerUserId);
  const isOpponentCaptain =
    viewerUserId &&
    (booking.opponentTeam?.members?.some(
      (m) => m.userId === viewerUserId && m.role === "CAPTAIN" && m.status === "ACTIVE",
    ) ||
      booking.match?.awayCaptainId === viewerUserId);

  const challenge = booking.challenge;
  let comparison: AcceptedConditionComparison | undefined;
  if (challenge && booking.pitch) {
    const pitchLat = booking.pitch.lat ?? null;
    const pitchLng = booking.pitch.lng ?? null;
    let distanceKm: number | null = null;
    if (typeof pitchLat === "number" && typeof pitchLng === "number") {
      distanceKm =
        Math.round(
          haversineKm(
            { lat: challenge.originLat, lng: challenge.originLng },
            { lat: pitchLat, lng: pitchLng },
          ) * 10,
        ) / 10;
    }
    const bStart =
      booking.startAt instanceof Date
        ? booking.startAt.toISOString()
        : booking.startAt;
    const bEnd =
      booking.endAt instanceof Date
        ? booking.endAt.toISOString()
        : booking.endAt;
    const cStart =
      challenge.startAt instanceof Date
        ? challenge.startAt.toISOString()
        : challenge.startAt;
    const cEnd =
      challenge.endAt instanceof Date
        ? challenge.endAt.toISOString()
        : challenge.endAt;

    comparison = {
      agreedFormat: challenge.format,
      pitchFormat: booking.pitch.size,
      formatMatches: challenge.format === booking.pitch.size,
      agreedWindowStartAt: cStart,
      agreedWindowEndAt: cEnd,
      bookingStartAt: bStart,
      bookingEndAt: bEnd,
      withinWindow:
        new Date(bStart).getTime() >= new Date(cStart).getTime() &&
        new Date(bEnd).getTime() <= new Date(cEnd).getTime(),
      agreedOriginLat: challenge.originLat,
      agreedOriginLng: challenge.originLng,
      agreedRadiusKm: challenge.radiusKm,
      pitchLat,
      pitchLng,
      pitchDistanceKm: distanceKm,
      withinRadius:
        distanceKm !== null ? distanceKm <= challenge.radiusKm : true,
    };
  }

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
    matchId: booking.match?.id ?? null,
    viewerPermissions: {
      canConfirm: Boolean(isOwner && booking.status === "PENDING_OWNER_CONFIRMATION"),
      canDecline: Boolean(isOwner && booking.status === "PENDING_OWNER_CONFIRMATION"),
      canCancel: Boolean(
        (booking.status === "PENDING_OWNER_CONFIRMATION" && isOrganizer) ||
          (booking.status === "CONFIRMED" &&
            (isOwner || isChallengerCaptain || isOpponentCaptain)),
      ),
    },
    acceptedConditions: comparison,
    comparison,
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
  actorOrData: string | repo.CreateBookingData,
  inputOrDb?: CreateBookingInput | RepositoryContext,
  idempotencyKey?: string,
  nowDate?: Date,
  maybeTx?: RepositoryContext,
): Promise<BookingDto> {
  // Legacy / direct repository creation path
  if (typeof actorOrData !== "string") {
    const rawCreated = await repo.createBooking(
      actorOrData,
      inputOrDb as RepositoryContext | undefined,
    );
    return toBookingDto(rawCreated);
  }

  const actorId = actorOrData;
  const input = inputOrDb as CreateBookingInput;
  const key = idempotencyKey?.trim();
  const now = nowDate ?? new Date();
  const tx = maybeTx;

  const scope = "bookings.create";
  const requestHash = hashIdempotencyRequest(input);

  // Check stored idempotency record outside transaction
  if (key) {
    const existingRecord = await readIdempotentResult(actorId, scope, key);
    if (existingRecord) {
      if (existingRecord.requestHash !== requestHash) {
        throw new HttpError(
          409,
          "Idempotency key was already used for a different request",
          "CONFLICT",
          { scope, key },
        );
      }
      return existingRecord.responseBody as BookingDto;
    }

    const flightKey = `${actorId}:${scope}:${key}`;
    const pendingPromise = inFlightBookingRequests.get(flightKey);
    if (pendingPromise) {
      return await pendingPromise;
    }
  }

  const doCreate = async (): Promise<BookingDto> => {
    const execute = async (client: RepositoryContext): Promise<BookingDto> => {
      // Check stored idempotency inside transaction
      if (key) {
        const stored = await readIdempotentResult(actorId, scope, key, client);
        if (stored) {
          if (stored.requestHash !== requestHash) {
            throw new HttpError(
              409,
              "Idempotency key was already used for a different request",
              "CONFLICT",
              { scope, key },
            );
          }
          return stored.responseBody as BookingDto;
        }
      }

      // Load accepted challenge via client to lock/verify latest state
      const challenge = await client.matchChallenge.findUnique({
        where: { id: input.challengeId },
        include: {
          challengerTeam: {
            include: {
              members: {
                where: { userId: actorId, status: "ACTIVE" },
              },
            },
          },
        },
      });

      if (!challenge) {
        throw new HttpError(404, "Challenge not found", "NOT_FOUND");
      }

      const activeMember = challenge.challengerTeam.members[0];
      const isChallengerCaptain = activeMember?.role === "CAPTAIN";

      // Load pitch with rules and blocks via client
      const pitch = await client.pitch.findUnique({
        where: { id: input.pitchId },
        include: {
          availabilityRules: { where: { isActive: true } },
          blocks: { where: { cancelledAt: null } },
        },
      });

      if (!pitch) {
        throw new HttpError(404, "Pitch not found", "NOT_FOUND");
      }

      const reqStart = new Date(input.startAt);
      const reqEnd = new Date(input.endAt);

      if (Number.isNaN(reqStart.getTime()) || Number.isNaN(reqEnd.getTime())) {
        throw new HttpError(400, "Invalid startAt or endAt date format", "VALIDATION_ERROR");
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

/**
 * Confirms a pending booking.
 * Only the owning PITCH_OWNER acts before response deadline.
 * Atomically transitions status to CONFIRMED and schedules match in the same transaction.
 * Match failure rolls back confirmation.
 * Repeated confirmation is idempotent. Conflicting state throws 409.
 */
export async function confirmBooking(
  ownerId: string,
  bookingId: string,
  now: Date = new Date(),
  input?: ConfirmBookingInput,
): Promise<BookingDto> {
  const existing = await repo.findBookingById(bookingId);
  if (!existing) {
    throw new HttpError(404, "Booking not found", "NOT_FOUND");
  }

  // Only the owning PITCH_OWNER acts
  if (existing.pitch.ownerId !== ownerId) {
    throw new HttpError(
      403,
      "Only the pitch owner can confirm this booking",
      "FORBIDDEN",
    );
  }

  // Repeated same decision is idempotent
  if (existing.status === "CONFIRMED") {
    return toBookingDto(existing);
  }

  // Opposite / stale decision returns 409 STATE_CONFLICT
  if (existing.status !== "PENDING_OWNER_CONFIRMATION") {
    throw new HttpError(
      409,
      `Cannot confirm booking with status ${existing.status}`,
      "STATE_CONFLICT",
    );
  }

  // Act before response deadline
  if (now.getTime() >= existing.ownerResponseDeadline.getTime()) {
    throw new HttpError(
      409,
      "Owner response deadline has expired",
      "STATE_CONFLICT",
    );
  }

  return withTransaction(async (tx) => {
    const fresh = await repo.findBookingById(bookingId, tx);
    if (!fresh) {
      throw new HttpError(404, "Booking not found", "NOT_FOUND");
    }
    if (fresh.status === "CONFIRMED") {
      return toBookingDto(fresh);
    }
    if (fresh.status !== "PENDING_OWNER_CONFIRMATION") {
      throw new HttpError(
        409,
        `Cannot confirm booking with status ${fresh.status}`,
        "STATE_CONFLICT",
      );
    }
    if (now.getTime() >= fresh.ownerResponseDeadline.getTime()) {
      throw new HttpError(
        409,
        "Owner response deadline has expired",
        "STATE_CONFLICT",
      );
    }

    const updated = await repo.updateBooking(
      bookingId,
      {
        status: "CONFIRMED",
        confirmedAt: now,
      },
      tx,
    );

    // Call matches.service.scheduleFromConfirmedBooking in the same transaction
    await matchesService.scheduleFromConfirmedBooking(
      {
        bookingId: fresh.id,
        homeTeamId: fresh.challengerTeamId,
        awayTeamId: fresh.opponentTeamId,
        pitchOwnerId: fresh.pitch.ownerId,
        startAt: fresh.startAt,
        endAt: fresh.endAt,
        format: fresh.challenge.format,
      },
      tx,
    );

    const reloaded = await repo.findBookingById(bookingId, tx);
    return toBookingDto(reloaded ?? updated);
  });
}

/**
 * Declines a pending booking.
 * Only the owning PITCH_OWNER acts before response deadline.
 * Releases inventory and leaves challenge ACCEPTED until booking deadline.
 * Repeated decline is idempotent. Conflicting state throws 409.
 */
export async function declineBooking(
  ownerId: string,
  bookingId: string,
  now: Date = new Date(),
  input?: DeclineBookingInput,
): Promise<BookingDto> {
  const existing = await repo.findBookingById(bookingId);
  if (!existing) {
    throw new HttpError(404, "Booking not found", "NOT_FOUND");
  }

  // Only the owning PITCH_OWNER acts
  if (existing.pitch.ownerId !== ownerId) {
    throw new HttpError(
      403,
      "Only the pitch owner can decline this booking",
      "FORBIDDEN",
    );
  }

  // Repeated same decision is idempotent
  if (existing.status === "DECLINED") {
    return toBookingDto(existing);
  }

  // Opposite / stale decision returns 409 STATE_CONFLICT
  if (existing.status !== "PENDING_OWNER_CONFIRMATION") {
    throw new HttpError(
      409,
      `Cannot decline booking with status ${existing.status}`,
      "STATE_CONFLICT",
    );
  }

  // Act before response deadline
  if (now.getTime() >= existing.ownerResponseDeadline.getTime()) {
    throw new HttpError(
      409,
      "Owner response deadline has expired",
      "STATE_CONFLICT",
    );
  }

  return withTransaction(async (tx) => {
    const fresh = await repo.findBookingById(bookingId, tx);
    if (!fresh) {
      throw new HttpError(404, "Booking not found", "NOT_FOUND");
    }
    if (fresh.status === "DECLINED") {
      return toBookingDto(fresh);
    }
    if (fresh.status !== "PENDING_OWNER_CONFIRMATION") {
      throw new HttpError(
        409,
        `Cannot decline booking with status ${fresh.status}`,
        "STATE_CONFLICT",
      );
    }
    if (now.getTime() >= fresh.ownerResponseDeadline.getTime()) {
      throw new HttpError(
        409,
        "Owner response deadline has expired",
        "STATE_CONFLICT",
      );
    }

    const updated = await repo.updateBooking(
      bookingId,
      {
        status: "DECLINED",
        declinedAt: now,
        cancellationReason: input?.reason ?? null,
      },
      tx,
    );

    const reloaded = await repo.findBookingById(bookingId, tx);
    return toBookingDto(reloaded ?? updated);
  });
}

/**
 * Cancels a booking before or after confirmation.
 * Before confirmation: Only organizer cancels.
 * After confirmation: Designated captain (challenger or opponent) or pitch owner cancels.
 * In the same transaction: sets status, cancels Match if present, releases inventory.
 * Early vs late (< 6h) classification applies to team cancellations.
 * Repeated cancellation by same actor is idempotent. Conflicting actor throws 409.
 */
export async function cancelBooking(
  actorId: string,
  bookingId: string,
  input?: CancelBookingInput,
  now: Date = new Date(),
): Promise<BookingDto> {
  const booking = await repo.findBookingById(bookingId);
  if (!booking) {
    throw new HttpError(404, "Booking not found", "NOT_FOUND");
  }

  // Repeated same cancellation is idempotent; a different actor after cancellation conflicts
  if (
    booking.status === "CANCELLED_BY_TEAM" ||
    booking.status === "CANCELLED_BY_OWNER"
  ) {
    if (booking.cancelledByUserId === actorId) {
      return toBookingDto(booking);
    }
    throw new HttpError(
      409,
      "Booking has already been cancelled",
      "STATE_CONFLICT",
    );
  }

  // If in DECLINED or EXPIRED state, cannot cancel
  if (booking.status === "DECLINED" || booking.status === "EXPIRED") {
    throw new HttpError(
      409,
      `Cannot cancel booking with status ${booking.status}`,
      "STATE_CONFLICT",
    );
  }

  // Before confirmation, only the organizer cancels
  if (booking.status === "PENDING_OWNER_CONFIRMATION") {
    if (booking.organizerUserId !== actorId) {
      throw new HttpError(
        403,
        "Only the organizer can cancel a pending booking request",
        "FORBIDDEN",
      );
    }

    const isLate = isLateCancellation(booking.startAt, now);

    return withTransaction(async (tx) => {
      const fresh = await repo.findBookingById(bookingId, tx);
      if (!fresh) {
        throw new HttpError(404, "Booking not found", "NOT_FOUND");
      }
      if (
        fresh.status === "CANCELLED_BY_TEAM" ||
        fresh.status === "CANCELLED_BY_OWNER"
      ) {
        if (fresh.cancelledByUserId === actorId) return toBookingDto(fresh);
        throw new HttpError(409, "Booking has already been cancelled", "STATE_CONFLICT");
      }
      if (fresh.status !== "PENDING_OWNER_CONFIRMATION") {
        throw new HttpError(409, `Cannot cancel booking with status ${fresh.status}`, "STATE_CONFLICT");
      }

      const updated = await repo.updateBooking(
        bookingId,
        {
          status: "CANCELLED_BY_TEAM",
          cancelledAt: now,
          cancelledByUserId: actorId,
          responsibleTeamId: fresh.challengerTeamId,
          cancellationReason: input?.reason ?? null,
          isLateCancellation: isLate,
        },
        tx,
      );

      const reloaded = await repo.findBookingById(bookingId, tx);
      return toBookingDto(reloaded ?? updated);
    });
  }

  // After confirmation and before match end
  if (booking.status === "CONFIRMED") {
    if (now.getTime() >= booking.endAt.getTime()) {
      throw new HttpError(
        409,
        "Cannot cancel a match that has already ended",
        "STATE_CONFLICT",
      );
    }

    const isOwner = booking.pitch.ownerId === actorId;
    const isChallengerCaptain =
      booking.challengerTeam?.members?.some(
        (m) => m.userId === actorId && m.role === "CAPTAIN" && m.status === "ACTIVE",
      ) || booking.match?.homeCaptainId === actorId;
    const isOpponentCaptain =
      booking.opponentTeam?.members?.some(
        (m) => m.userId === actorId && m.role === "CAPTAIN" && m.status === "ACTIVE",
      ) || booking.match?.awayCaptainId === actorId;

    let targetStatus: "CANCELLED_BY_OWNER" | "CANCELLED_BY_TEAM";
    let responsibleTeamId: string | null = null;
    let isLate = false;

    if (isOwner) {
      targetStatus = "CANCELLED_BY_OWNER";
      responsibleTeamId = null;
      isLate = false;
    } else if (isChallengerCaptain || isOpponentCaptain) {
      targetStatus = "CANCELLED_BY_TEAM";
      responsibleTeamId = isChallengerCaptain
        ? booking.challengerTeamId
        : booking.opponentTeamId;

      if (
        input?.responsibleTeamId &&
        input.responsibleTeamId !== responsibleTeamId
      ) {
        throw new HttpError(
          403,
          "Captains may only cancel for their own team",
          "FORBIDDEN",
        );
      }

      isLate = isLateCancellation(booking.startAt, now);
    } else {
      throw new HttpError(
        403,
        "You do not have permission to cancel this booking",
        "FORBIDDEN",
      );
    }

    return withTransaction(async (tx) => {
      const fresh = await repo.findBookingById(bookingId, tx);
      if (!fresh) {
        throw new HttpError(404, "Booking not found", "NOT_FOUND");
      }
      if (
        fresh.status === "CANCELLED_BY_TEAM" ||
        fresh.status === "CANCELLED_BY_OWNER"
      ) {
        if (fresh.cancelledByUserId === actorId) return toBookingDto(fresh);
        throw new HttpError(409, "Booking has already been cancelled", "STATE_CONFLICT");
      }
      if (fresh.status !== "CONFIRMED") {
        throw new HttpError(409, `Cannot cancel booking with status ${fresh.status}`, "STATE_CONFLICT");
      }
      if (now.getTime() >= fresh.endAt.getTime()) {
        throw new HttpError(409, "Cannot cancel a match that has already ended", "STATE_CONFLICT");
      }

      const updated = await repo.updateBooking(
        bookingId,
        {
          status: targetStatus,
          cancelledAt: now,
          cancelledByUserId: actorId,
          responsibleTeamId,
          cancellationReason: input?.reason ?? null,
          isLateCancellation: isLate,
        },
        tx,
      );

      // Cancel the match in the same transaction
      await matchesService.cancelMatchByBookingId(bookingId, tx);

      const reloaded = await repo.findBookingById(bookingId, tx);
      return toBookingDto(reloaded ?? updated);
    });
  }

  throw new HttpError(
    409,
    `Cannot cancel booking with status ${booking.status}`,
    "STATE_CONFLICT",
  );
}

/**
 * Evaluates pending bookings past ownerResponseDeadline and marks them EXPIRED.
 */
export async function expireDueBookings(
  now: Date = new Date(),
  tx?: RepositoryContext,
): Promise<{ count: number }> {
  return repo.expireDueBookings(now, tx);
}
