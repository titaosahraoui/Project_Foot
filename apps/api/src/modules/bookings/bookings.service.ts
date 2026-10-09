import type {
  BlockingRange,
  BookingDetailDto,
  BookingDto,
  ListBookingsQuery,
  PaginatedBookings,
} from "@footconnect/shared";
import type { RepositoryContext } from "../../lib/transaction";
import { HttpError } from "../../middleware/error-handler";
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
  data: repo.CreateBookingData,
  db?: RepositoryContext,
): Promise<BookingDto> {
  const booking = await repo.createBooking(data, db);
  return toBookingDto(booking);
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
    items: items.map(toBookingDto),
    page,
    pageSize,
    total,
  };
}
