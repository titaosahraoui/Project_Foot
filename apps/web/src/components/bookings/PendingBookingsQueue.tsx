"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookingDto, BookingStatus } from "@footconnect/shared";
import { api } from "@/lib/api";
import { formatAlgiersDateTime, formatAlgiersTime } from "@/lib/format-time";
import { formatDzd } from "@/lib/format-money";
import { BookingDetailModal } from "./BookingDetailModal";

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `key_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function PendingBookingsQueue() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"PENDING" | "CONFIRMED" | "ALL">("PENDING");
  const [selectedBooking, setSelectedBooking] = useState<BookingDto | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch bookings for the owner
  const {
    data: bookingsData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["owner-bookings", activeTab],
    queryFn: () => {
      const statusParam =
        activeTab === "PENDING"
          ? ("PENDING_OWNER_CONFIRMATION" as BookingStatus)
          : activeTab === "CONFIRMED"
            ? ("CONFIRMED" as BookingStatus)
            : undefined;

      return api.getOwnerBookings({
        status: statusParam,
        page: 1,
        pageSize: 50,
      });
    },
    refetchInterval: 15000,
  });

  // Query pending count specifically for badge
  const { data: pendingData } = useQuery({
    queryKey: ["owner-pending-count"],
    queryFn: () =>
      api.getOwnerBookings({
        status: "PENDING_OWNER_CONFIRMATION" as BookingStatus,
        page: 1,
        pageSize: 1,
      }),
    refetchInterval: 15000,
  });

  const pendingCount = pendingData?.total ?? 0;

  const handleConfirm = async (bookingId: string) => {
    setIsProcessing(true);
    setActionError(null);
    setActionSuccess(null);

    const idempotencyKey = generateIdempotencyKey();

    try {
      await api.confirmBooking(bookingId, idempotencyKey);
      setActionSuccess("Booking confirmed! Match has been scheduled.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["owner-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["owner-pending-count"] }),
        queryClient.invalidateQueries({ queryKey: ["booking-detail", bookingId] }),
      ]);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to confirm booking. Please try again.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async (bookingId: string, reason?: string) => {
    setIsProcessing(true);
    setActionError(null);
    setActionSuccess(null);

    const idempotencyKey = generateIdempotencyKey();

    try {
      await api.declineBooking(bookingId, idempotencyKey, { reason });
      setActionSuccess("Booking declined. Slot returned to available inventory.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["owner-bookings"] }),
        queryClient.invalidateQueries({ queryKey: ["owner-pending-count"] }),
        queryClient.invalidateQueries({ queryKey: ["booking-detail", bookingId] }),
      ]);
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to decline booking. Please try again.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const items = bookingsData?.items ?? [];

  return (
    <div className="layer-1 rounded-xl p-6 border border-white/5 space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[#c3f400] uppercase tracking-wider">
              RESERVATION QUEUE
            </span>
            {pendingCount > 0 && (
              <span className="bg-[#c3f400] text-[#161e00] font-mono text-[11px] font-bold px-2 py-0.5 rounded-full">
                {pendingCount} PENDING
              </span>
            )}
          </div>
          <h3 className="font-headline text-2xl font-bold text-white mt-1">
            PITCH BOOKING REQUESTS
          </h3>
          <p className="text-xs text-[#c4c9ac] mt-0.5">
            Review and confirm challenge bookings submitted by team captains.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 bg-[#141815] p-1 rounded-lg border border-white/5 text-xs font-headline font-semibold">
          <button
            onClick={() => setActiveTab("PENDING")}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === "PENDING"
                ? "bg-[#272b29] text-[#c3f400] shadow-sm"
                : "text-[#c4c9ac] hover:text-white"
            }`}
          >
            Pending {pendingCount > 0 ? `(${pendingCount})` : ""}
          </button>
          <button
            onClick={() => setActiveTab("CONFIRMED")}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === "CONFIRMED"
                ? "bg-[#272b29] text-[#00fd93] shadow-sm"
                : "text-[#c4c9ac] hover:text-white"
            }`}
          >
            Confirmed
          </button>
          <button
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 rounded-md transition-all ${
              activeTab === "ALL"
                ? "bg-[#272b29] text-white shadow-sm"
                : "text-[#c4c9ac] hover:text-white"
            }`}
          >
            All History
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionSuccess && (
        <div className="p-3 bg-[#00fd93]/10 border border-[#00fd93]/30 rounded-lg text-xs text-[#00fd93] flex items-center justify-between">
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-[#00fd93] hover:underline">
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-[#ff5449]/10 border border-[#ff5449]/30 rounded-lg text-xs text-[#ffb4ab] flex items-center justify-between">
          <span>⚠️ {actionError}</span>
          <button onClick={() => setActionError(null)} className="text-[#ffb4ab] hover:underline">
            ✕
          </button>
        </div>
      )}

      {/* Queue Content */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <div className="w-6 h-6 border-2 border-[#c3f400] border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-xs text-[#8e9379] font-mono">Loading booking requests…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-center p-6">
          <span className="text-3xl mb-2">🏟️</span>
          <h4 className="font-headline text-lg font-bold text-white">
            {activeTab === "PENDING"
              ? "No Pending Reservations"
              : activeTab === "CONFIRMED"
                ? "No Confirmed Bookings Yet"
                : "No Booking History"}
          </h4>
          <p className="text-xs text-[#c4c9ac] max-w-sm mt-1">
            {activeTab === "PENDING"
              ? "Incoming match challenge reservations from captains will appear here with confirmation deadlines."
              : "Confirmed bookings and past reservations will appear in this log."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((booking) => {
            const isPending = booking.status === "PENDING_OWNER_CONFIRMATION";
            const deadline = new Date(booking.ownerResponseDeadline);
            const now = new Date();
            const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
            const isExpired = diffHours <= 0;

            return (
              <div
                key={booking.id}
                className="bg-[#141815] border border-white/5 hover:border-white/15 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all"
              >
                {/* Left: Pitch, Time & Teams */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-headline text-base font-bold text-white">
                      Pitch Reservation #{booking.id.slice(0, 8)}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        booking.status === "CONFIRMED"
                          ? "bg-[#00fd93]/20 text-[#00fd93]"
                          : isPending
                            ? "bg-[#c3f400]/20 text-[#c3f400]"
                            : "bg-white/10 text-[#c4c9ac]"
                      }`}
                    >
                      {booking.status.replace(/_/g, " ")}
                    </span>
                    {isPending && (
                      <span
                        className={`text-[11px] font-mono ${
                          isExpired
                            ? "text-[#ff5449] font-bold"
                            : diffHours < 4
                              ? "text-[#ffb200]"
                              : "text-[#c4c9ac]"
                        }`}
                      >
                        ⏱ {isExpired ? "Deadline Expired" : `${Math.max(0, Math.floor(diffHours))}h left to respond`}
                      </span>
                    )}
                  </div>

                  {/* Timing & Price tags */}
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-[#8e9379]">
                    <span className="text-white">
                      📅 {formatAlgiersDateTime(booking.startAt).split(",")[0]},{" "}
                      {formatAlgiersTime(booking.startAt)} – {formatAlgiersTime(booking.endAt)}
                    </span>
                    <span>·</span>
                    <span className="text-[#c3f400] font-bold font-sans text-sm">
                      {formatDzd(booking.priceAmountMinor)}
                    </span>
                    <span>·</span>
                    <span className="text-[#00fd93]">Offline Settlement</span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-white/5">
                  <button
                    onClick={() => setSelectedBooking(booking)}
                    className="px-3 py-2 rounded-lg border border-white/10 hover:border-white/20 text-xs font-headline font-semibold text-[#c4c9ac] hover:text-white transition-all"
                  >
                    View Details
                  </button>

                  {isPending && (
                    <>
                      <button
                        onClick={() => setSelectedBooking(booking)}
                        disabled={isProcessing}
                        className="px-3 py-2 rounded-lg border border-[#ff5449]/40 hover:bg-[#ff5449]/10 text-[#ffb4ab] text-xs font-headline font-bold uppercase tracking-wider transition-all"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleConfirm(booking.id)}
                        disabled={isProcessing || isExpired}
                        className="px-4 py-2 rounded-lg bg-[#c3f400] hover:bg-[#abd600] text-[#161e00] text-xs font-headline font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(195,244,0,0.25)] transition-all disabled:opacity-50"
                      >
                        {isProcessing ? "Confirming..." : "Confirm"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal
          bookingId={selectedBooking.id}
          initialBooking={selectedBooking}
          isOpen={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onConfirm={handleConfirm}
          onDecline={handleDecline}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}
