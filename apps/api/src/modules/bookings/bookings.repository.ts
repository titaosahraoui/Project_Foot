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
}

export interface UpdateBookingData {
  status?: BookingStatus;
  paymentStatus?: OfflinePaymentStatus;
  confirmedAt?: Date | null;
  declinedAt?: Date | null;
  cancelledAt?: Date | null;
  expiresAt?: Date | null;
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

const bookingInclude = {
  pitch: true,
  challengerTeam: true,
  opponentTeam: true,
  organizerUser: true,
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

export function isBookingCollisionError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string })?.code;
  return (
    code === "23P01" ||
    code === "P2010" ||
    code === "P2002" ||
    msg.includes("bookings_pitch_time_exclusion") ||
    msg.includes("exclusion constraint") ||
    msg.includes("violates exclusion constraint") ||
    msg.includes("23P01")
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
  const where: Prisma.BookingWhereInput = {};

  if (filter.status) {
    where.status = filter.status;
  }
  if (filter.pitchId) {
    where.pitchId = filter.pitchId;
  }
  if (filter.challengeId) {
    where.challengeId = filter.challengeId;
  }
  if (filter.teamId) {
    where.OR = [
      { challengerTeamId: filter.teamId },
      { opponentTeamId: filter.teamId },
    ];
  }
  if (filter.userId && filter.role === "organizer") {
    where.organizerUserId = filter.userId;
  } else if (filter.userId && filter.role === "owner") {
    where.pitch = { ownerId: filter.userId };
  }

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
