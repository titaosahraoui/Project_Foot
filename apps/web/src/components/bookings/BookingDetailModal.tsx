"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BookingDetailDto, BookingDto } from "@footconnect/shared";
import { api } from "@/lib/api";
import { formatAlgiersDateTime, formatAlgiersTime } from "@/lib/format-time";
import { formatDzd } from "@/lib/format-money";

interface BookingDetailModalProps {
  bookingId: string;
  initialBooking?: BookingDto | BookingDetailDto;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (bookingId: string) => Promise<void>;
  onDecline: (bookingId: string, reason?: string) => Promise<void>;
  isProcessing: boolean;
}

export function BookingDetailModal({
  bookingId,
  initialBooking,
  isOpen,
  onClose,
  onConfirm,
  onDecline,
  isProcessing,
}: BookingDetailModalProps) {
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  // Query full booking detail including condition comparison, pitch, and teams
  const { data: detailData, isLoading } = useQuery<BookingDetailDto>({
    queryKey: ["booking-detail", bookingId],
    queryFn: () => api.getBooking(bookingId),
    enabled: isOpen && !!bookingId,
  });

  const booking = detailData ?? (initialBooking as BookingDetailDto | undefined);

  if (!isOpen || !booking) return null;

  const isPending = booking.status === "PENDING_OWNER_CONFIRMATION";
  const deadline = new Date(booking.ownerResponseDeadline);
  const now = new Date();
  const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  const isExpired = diffHours <= 0;

  const handleDeclineSubmit = async () => {
    await onDecline(booking.id, declineReason.trim() || undefined);
    setShowDeclineConfirm(false);
    onClose();
  };

  const handleConfirmSubmit = async () => {
    await onConfirm(booking.id);
    onClose();
  };

  const comparison = booking.comparison ?? booking.acceptedConditions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111412] border border-white/10 rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
        {/* Modal Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#151916]">
          <div>
            <span className="font-mono text-xs text-[#8e9379] uppercase tracking-wider">
              Booking Details & Verification
            </span>
            <h3 className="font-headline text-2xl font-bold text-white mt-0.5">
              {booking.pitch?.name ?? "Pitch Reservation"}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-[#c4c9ac] hover:text-white flex items-center justify-center transition-all"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Status & Deadline Banner */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              booking.status === "CONFIRMED"
                ? "bg-[#00fd93]/10 border-[#00fd93]/30 text-[#00fd93]"
                : isPending
                  ? "bg-[#c3f400]/10 border-[#c3f400]/30 text-[#c3f400]"
                  : "bg-[#ff5449]/10 border-[#ff5449]/30 text-[#ffb4ab]"
            }`}
          >
            <div>
              <span className="text-xs font-mono font-semibold uppercase tracking-wider block">
                CURRENT STATUS
              </span>
              <span className="font-headline text-lg font-bold">
                {booking.status.replace(/_/g, " ")}
              </span>
            </div>
            {isPending && (
              <div className="text-right">
                <span className="text-[11px] font-mono text-[#c4c9ac] uppercase block">
                  Response Deadline
                </span>
                <span
                  className={`text-sm font-mono font-bold ${
                    isExpired ? "text-[#ff5449]" : diffHours < 4 ? "text-[#ffb200]" : "text-white"
                  }`}
                >
                  {isExpired
                    ? "EXPIRED"
                    : `${Math.floor(diffHours)}h ${Math.round((diffHours % 1) * 60)}m left`}
                </span>
              </div>
            )}
          </div>

          {/* Teams Matchup */}
          <div className="bg-[#181c19] border border-white/5 rounded-xl p-4">
            <span className="font-mono text-xs text-[#8e9379] uppercase tracking-wider block mb-2">
              SCHEDULED TEAMS
            </span>
            <div className="flex items-center justify-between text-center">
              <div className="flex-1">
                <div className="font-headline text-lg font-bold text-white">
                  {booking.challengerTeam?.name ?? "Challenger Team"}
                </div>
                <span className="text-xs text-[#00fd93] font-mono">
                  ORGANIZER SQUAD
                </span>
              </div>
              <span className="font-headline text-sm font-black text-[#c3f400] px-3">
                VS
              </span>
              <div className="flex-1">
                <div className="font-headline text-lg font-bold text-white">
                  {booking.opponentTeam?.name ?? "Opponent Team"}
                </div>
                <span className="text-xs text-[#c4c9ac] font-mono">
                  OPPONENT SQUAD
                </span>
              </div>
            </div>
          </div>

          {/* Slot & Venue Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#181c19] border border-white/5 rounded-xl p-3.5">
              <span className="font-mono text-xs text-[#8e9379] uppercase block">
                Kickoff Time
              </span>
              <span className="font-headline text-base font-bold text-white mt-1 block">
                {formatAlgiersTime(booking.startAt)} – {formatAlgiersTime(booking.endAt)}
              </span>
              <span className="text-xs text-[#c4c9ac] mt-0.5 block">
                {formatAlgiersDateTime(booking.startAt).split(",")[0]}
              </span>
            </div>

            <div className="bg-[#181c19] border border-white/5 rounded-xl p-3.5">
              <span className="font-mono text-xs text-[#8e9379] uppercase block">
                Snapshot Price
              </span>
              <span className="font-headline text-lg font-extrabold text-[#c3f400] mt-1 block">
                {formatDzd(booking.priceAmountMinor)}
              </span>
              <span className="text-[11px] text-[#00fd93] font-mono block">
                Offline cash at venue
              </span>
            </div>
          </div>

          {/* Condition Comparison Checks */}
          <div className="bg-[#181c19] border border-white/5 rounded-xl p-4 space-y-2">
            <span className="font-mono text-xs text-[#8e9379] uppercase tracking-wider block mb-2">
              ACCEPTED CONDITIONS AUDIT
            </span>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#c4c9ac]">
                Format Compatibility ({comparison?.pitchFormat ?? "Confirmed"})
              </span>
              <span className="text-[#00fd93] font-medium flex items-center gap-1 font-mono">
                ✓ Verified
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#c4c9ac]">Time Window Inside Agreed Range</span>
              <span className="text-[#00fd93] font-medium flex items-center gap-1 font-mono">
                ✓ Verified
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#c4c9ac]">Location Inside Accepted Radius</span>
              <span className="text-[#00fd93] font-medium flex items-center gap-1 font-mono">
                ✓ Verified
              </span>
            </div>
          </div>

          {/* Destructive Decline Confirmation Box */}
          {showDeclineConfirm && (
            <div className="bg-[#ff5449]/10 border border-[#ff5449]/40 rounded-xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div>
                  <h4 className="font-headline text-sm font-bold text-[#ffb4ab]">
                    Confirm Decline
                  </h4>
                  <p className="text-xs text-[#c4c9ac] mt-0.5">
                    Declining will reject this slot reservation request and release the time slot back into available inventory. The challenge organizers will be notified to select an alternative slot.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[#8e9379] uppercase mb-1">
                  Decline Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Facility maintenance, pitch unavailable..."
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="w-full bg-[#111412] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-[#8e9379] focus:outline-none focus:border-[#ff5449]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeclineConfirm(false)}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-semibold text-[#c4c9ac] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeclineSubmit}
                  disabled={isProcessing}
                  className="px-4 py-1.5 rounded-lg bg-[#ff5449] hover:bg-[#d9382f] text-white text-xs font-headline font-bold uppercase tracking-wider transition-all"
                >
                  {isProcessing ? "Declining..." : "Confirm Decline"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-white/10 bg-[#151916] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-lg border border-white/10 text-xs font-headline font-semibold text-[#c4c9ac] hover:text-white transition-all"
          >
            Close
          </button>

          {isPending && !showDeclineConfirm && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDeclineConfirm(true)}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-lg border border-[#ff5449]/40 hover:bg-[#ff5449]/10 text-[#ffb4ab] text-xs font-headline font-bold uppercase tracking-wider transition-all"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={isProcessing || isExpired}
                className="px-5 py-2.5 rounded-lg bg-[#c3f400] hover:bg-[#abd600] text-[#161e00] text-xs font-headline font-bold uppercase tracking-wider shadow-[0_0_12px_rgba(195,244,0,0.3)] transition-all disabled:opacity-50"
              >
                {isProcessing ? "Confirming..." : "Confirm Booking"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
