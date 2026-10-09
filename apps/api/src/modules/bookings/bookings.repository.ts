import type {
  Booking,
  BookingStatus,
  OfflinePaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { RepositoryContext } from "../../lib/transaction";

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

const bookingInclude = {
  pitch: true,
  challengerTeam: true,
  opponentTeam: true,
  organizerUser: true,
} satisfies Prisma.BookingInclude;

export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;

export function createBooking(
  data: CreateBookingData,
  db: RepositoryContext = prisma,
): Promise<Booking> {
  return db.booking.create({
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
