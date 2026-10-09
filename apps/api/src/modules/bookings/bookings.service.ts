import type {
  BookingDetailDto,
  BookingDto,
  ListBookingsQuery,
  PaginatedBookings,
} from "@footconnect/shared";
import { HttpError } from "../../middleware/error-handler";
import * as repo from "./bookings.repository";

export function toBookingDto(booking: repo.BookingWithRelations | any): BookingDto {
  return {
    id: booking.id,
    pitchId: booking.pitchId,
    challengeId: booking.challengeId,
    organizerUserId: booking.organizerUserId,
    challengerTeamId: booking.challengerTeamId,
    opponentTeamId: booking.opponentTeamId,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    priceAmountMinor: booking.priceAmountMinor,
    currency: booking.currency as "DZD",
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    ownerResponseDeadline: booking.ownerResponseDeadline.toISOString(),
    confirmedAt: booking.confirmedAt ? booking.confirmedAt.toISOString() : null,
    declinedAt: booking.declinedAt ? booking.declinedAt.toISOString() : null,
    cancelledAt: booking.cancelledAt ? booking.cancelledAt.toISOString() : null,
    expiresAt: booking.expiresAt ? booking.expiresAt.toISOString() : null,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
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
