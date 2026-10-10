import type {
  Booking,
  BookingStatus,
  OfflinePaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { RepositoryContext } from "../../lib/transaction";
import { HttpError } from "../../middleware/error-handler";

export interface CreateBookingData {
  pitchId: string;
  challengeId: string;
  organizerUserId: string;
  challengerTeamId: string;
  opponentTeamId: string;
  startAt: Date;
  endAt: Date;
  priceAmountMinor: number;
  currency?: string;
  status?: BookingStatus;
  paymentStatus?: OfflinePaymentStatus;
  ownerResponseDeadline: Date;
  confirmedAt?: Date | null;
  declinedAt?: Date | null;
  cancelledAt?: Date | null;
  expiresAt?: Date | null;
  cancelledByUserId?: string | null;
  responsibleTeamId?: string | null;
  cancellationReason?: string | null;
  isLateCancellation?: boolean;
}

export interface UpdateBookingData {
  status?: BookingStatus;
  paymentStatus?: OfflinePaymentStatus;
  confirmedAt?: Date | null;
  declinedAt?: Date | null;
  cancelledAt?: Date | null;
  expiresAt?: Date | null;
  cancelledByUserId?: string | null;
  responsibleTeamId?: string | null;
  cancellationReason?: string | null;
  isLateCancellation?: boolean;
}

export interface ListBookingsFilter {
  role?: "organizer" | "captain" | "owner";
  status?: BookingStatus;
  pitchId?: string;
  challengeId?: string;
  teamId?: string;
  userId?: string;
  skip?: number;
  take?: number;
}

export interface FindBlockingBookingRangesFilter {
  pitchId?: string;
  pitchIds?: string[];
  from: Date;
  to: Date;
}

export const bookingInclude = {
  pitch: true,
  challenge: true,
  challengerTeam: {
    include: {
      members: true,
    },
  },
  opponentTeam: {
    include: {
      members: true,
    },
  },
  organizerUser: true,
  match: true,
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

export function isUserRelatedToBooking(
  booking: BookingWithRelations,
  userId: string,
): boolean {
  if (booking.organizerUserId === userId) return true;
  if (booking.pitch?.ownerId === userId) return true;
  if (
    booking.challengerTeam?.members?.some(
      (m) => m.userId === userId && m.status === "ACTIVE",
    )
  ) {
    return true;
  }
  if (
    booking.opponentTeam?.members?.some(
      (m) => m.userId === userId && m.status === "ACTIVE",
    )
  ) {
    return true;
  }
  return false;
}

export function isBookingCollisionError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code;
  return (
    code === "23P01" ||
    msg.includes("bookings_pitch_time_exclusion") ||
    msg.includes("exclusion constraint") ||
    msg.includes("violates exclusion constraint") ||
    msg.includes("23P01") ||
    (code === "P2010" && msg.includes("exclusion"))
  );
}

export function isBookingChallengeConflictError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code;
  return (
    code === "23505" ||
    code === "P2002" ||
    msg.includes("bookings_challenge_active_unique") ||
    msg.includes("unique constraint") ||
    msg.includes("Unique constraint failed")
  );
}

export async function createBooking(
  data: CreateBookingData,
  db: RepositoryContext = prisma,
): Promise<Booking> {
  try {
    return await db.booking.create({
      data: {
        pitchId: data.pitchId,
        challengeId: data.challengeId,
        organizerUserId: data.organizerUserId,
        challengerTeamId: data.challengerTeamId,
        opponentTeamId: data.opponentTeamId,
        startAt: data.startAt,
        endAt: data.endAt,
        priceAmountMinor: data.priceAmountMinor,
        currency: data.currency ?? "DZD",
        status: data.status ?? "PENDING_OWNER_CONFIRMATION",
        paymentStatus: data.paymentStatus ?? "UNPAID",
        ownerResponseDeadline: data.ownerResponseDeadline,
        confirmedAt: data.confirmedAt ?? null,
        declinedAt: data.declinedAt ?? null,
        cancelledAt: data.cancelledAt ?? null,
        expiresAt: data.expiresAt ?? null,
        cancelledByUserId: data.cancelledByUserId ?? null,
        responsibleTeamId: data.responsibleTeamId ?? null,
        cancellationReason: data.cancellationReason ?? null,
        isLateCancellation: data.isLateCancellation ?? false,
      },
    });
  } catch (err) {
    if (isBookingCollisionError(err)) {
      throw new HttpError(
        409,
        "The requested time slot overlaps with an existing booking on this pitch",
        "INVENTORY_CONFLICT",
      );
    }
    if (isBookingChallengeConflictError(err)) {
      throw new HttpError(
        409,
        "An active booking request already exists for this challenge",
        "STATE_CONFLICT",
      );
    }
    throw err;
  }
}

export function findBookingById(
  id: string,
  db: RepositoryContext = prisma,
): Promise<BookingWithRelations | null> {
  return db.booking.findUnique({
    where: { id },
    include: bookingInclude,
  });
}

export function findActiveBookingByChallengeId(
  challengeId: string,
  db: RepositoryContext = prisma,
): Promise<Booking | null> {
  return db.booking.findFirst({
    where: {
      challengeId,
      status: { in: ["PENDING_OWNER_CONFIRMATION", "CONFIRMED"] },
    },
  });
}

export function findBookingsByChallengeId(
  challengeId: string,
  db: RepositoryContext = prisma,
): Promise<Booking[]> {
  return db.booking.findMany({
    where: { challengeId },
    orderBy: { createdAt: "desc" },
  });
}

export async function findBlockingBookingRanges(
  filter: FindBlockingBookingRangesFilter,
  db: RepositoryContext = prisma,
): Promise<Array<{ pitchId: string; startAt: Date; endAt: Date }>> {
  const pitchIds = filter.pitchIds ?? (filter.pitchId ? [filter.pitchId] : []);
  if (pitchIds.length === 0) return [];

  return db.booking.findMany({
    where: {
      pitchId: { in: pitchIds },
      status: { in: ["PENDING_OWNER_CONFIRMATION", "CONFIRMED"] },
      startAt: { lt: filter.to },
      endAt: { gt: filter.from },
    },
    select: {
      pitchId: true,
      startAt: true,
      endAt: true,
    },
    orderBy: { startAt: "asc" },
  });
}

export async function findBookings(
  filter: ListBookingsFilter,
  db: RepositoryContext = prisma,
): Promise<{ items: BookingWithRelations[]; total: number }> {
  // If no viewer userId is provided, return empty set (caller-supplied filters must not grant access)
  if (!filter.userId) {
    return { items: [], total: 0 };
  }

  const conditions: Prisma.BookingWhereInput[] = [];

  // Enforce viewer scope based on role or default relationship
  if (filter.role === "organizer") {
    conditions.push({ organizerUserId: filter.userId });
  } else if (filter.role === "owner") {
    conditions.push({ pitch: { ownerId: filter.userId } });
  } else if (filter.role === "captain") {
    conditions.push({
      OR: [
        {
          challengerTeam: {
            members: {
              some: {
                userId: filter.userId,
                role: "CAPTAIN",
                status: "ACTIVE",
              },
            },
          },
        },
        {
          opponentTeam: {
            members: {
              some: {
                userId: filter.userId,
                role: "CAPTAIN",
                status: "ACTIVE",
              },
            },
          },
        },
      ],
    });
  } else {
    // Default: any booking where viewer is owner, organizer, or active team member
    conditions.push({
      OR: [
        { pitch: { ownerId: filter.userId } },
        { organizerUserId: filter.userId },
        {
          challengerTeam: {
            members: {
              some: {
                userId: filter.userId,
                status: "ACTIVE",
              },
            },
          },
        },
        {
          opponentTeam: {
            members: {
              some: {
                userId: filter.userId,
                status: "ACTIVE",
              },
            },
          },
        },
      ],
    });
  }

  // Caller-supplied narrowing filters
  if (filter.status) {
    conditions.push({ status: filter.status });
  }
  if (filter.pitchId) {
    conditions.push({ pitchId: filter.pitchId });
  }
  if (filter.challengeId) {
    conditions.push({ challengeId: filter.challengeId });
  }
  if (filter.teamId) {
    conditions.push({
      OR: [
        { challengerTeamId: filter.teamId },
        { opponentTeamId: filter.teamId },
      ],
    });
  }

  const where: Prisma.BookingWhereInput = {
    AND: conditions,
  };

  const [items, total] = await Promise.all([
    db.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { createdAt: "desc" },
      skip: filter.skip,
      take: filter.take,
    }),
    db.booking.count({ where }),
  ]);

  return { items, total };
}

export function updateBooking(
  id: string,
  data: UpdateBookingData,
  db: RepositoryContext = prisma,
): Promise<Booking> {
  return db.booking.update({
    where: { id },
    data,
  });
}

export async function expireDueBookings(
  now: Date = new Date(),
  db: RepositoryContext = prisma,
): Promise<{ count: number }> {
  const result = await db.booking.updateMany({
    where: {
      status: "PENDING_OWNER_CONFIRMATION",
      ownerResponseDeadline: { lte: now },
    },
    data: {
      status: "EXPIRED",
      expiresAt: now,
    },
  });
  return { count: result.count };
}
