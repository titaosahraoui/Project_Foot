"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AvailableSlot, CreatePitchBlockInput, Money, PitchBlock } from "@footconnect/shared";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format-money";
import {
  algiersLocalToUtcIso,
  formatAlgiersDateTime,
  formatAlgiersTime,
  getAlgiersDayOfWeek,
  getWeekBoundaries,
} from "@/lib/format-time";

interface PitchCalendarProps {
  pitchId: string;
  pitchName: string;
  isOwner: boolean;
  hourlyRate: Money;
  blocks?: PitchBlock[];
  onClosureChanged?: () => void;
}

const DURATION_OPTIONS = [
  { label: "30 min", value: 30 },
  { label: "60 min", value: 60 },
  { label: "90 min", value: 90 },
  { label: "120 min", value: 120 },
];

export function PitchCalendar({
  pitchId,
  pitchName,
  isOwner,
  hourlyRate,
  blocks = [],
  onClosureChanged,
}: PitchCalendarProps) {
  const queryClient = useQueryClient();

  // Week offset state (0 = current week, -1 = previous, +1 = next)
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);

  // Add closure modal / form state
  const [isAddClosureOpen, setIsAddClosureOpen] = useState(false);
  const [closureStartDate, setClosureStartDate] = useState<string>("");
  const [closureStartTime, setClosureStartTime] = useState<string>("08:00");
  const [closureEndDate, setClosureEndDate] = useState<string>("");
  const [closureEndTime, setClosureEndTime] = useState<string>("12:00");
  const [closureReason, setClosureReason] = useState<string>("");

  // Feedback states
  const [closureError, setClosureError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Compute week boundaries in Africa/Algiers timezone
  const { from, to, weekLabel, days } = useMemo(() => {
    return getWeekBoundaries(undefined, weekOffset);
  }, [weekOffset]);

  // Query exact available slots for the selected week
  const {
    data: slots,
    isLoading: slotsLoading,
    error: slotsError,
    refetch: refetchSlots,
  } = useQuery<AvailableSlot[]>({
    queryKey: ["available-slots", pitchId, from, to, durationMinutes],
    queryFn: () => api.getAvailableSlots(pitchId, { from, to, durationMinutes }),
  });

  // Mutation to create a pitch block / closure
  const addBlockMutation = useMutation({
    mutationFn: async (input: CreatePitchBlockInput) => {
      return api.createPitchBlock(pitchId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pitch", pitchId] });
      void queryClient.invalidateQueries({ queryKey: ["available-slots", pitchId] });

      setIsAddClosureOpen(false);
      setClosureError(null);
      setClosureReason("");
      setStatusMessage("Pitch closure scheduled successfully. Slots updated! 🚫");
      setTimeout(() => setStatusMessage(null), 4000);
      onClosureChanged?.();
    },
    onError: (err: Error) => {
      // Input is preserved on error
      setClosureError(err.message || "Failed to create pitch closure. Please try again.");
    },
  });

  // Mutation to cancel an active pitch block / closure
  const cancelBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      return api.cancelPitchBlock(pitchId, blockId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pitch", pitchId] });
      void queryClient.invalidateQueries({ queryKey: ["available-slots", pitchId] });

      setStatusMessage("Closure removed. Available slots restored! ✨");
      setTimeout(() => setStatusMessage(null), 4000);
      onClosureChanged?.();
    },
    onError: (err: Error) => {
      setStatusMessage(err.message || "Failed to remove closure.");
      setTimeout(() => setStatusMessage(null), 4000);
    },
  });

  // Handle closure form submission
  const handleCreateClosure = (e: React.FormEvent) => {
    e.preventDefault();
    setClosureError(null);

    if (!closureStartDate || !closureStartTime || !closureEndDate || !closureEndTime) {
      setClosureError("Please fill in both start and end date and time.");
      return;
    }

    let startAtUtc: string;
    let endAtUtc: string;
    try {
      startAtUtc = algiersLocalToUtcIso(closureStartDate, closureStartTime);
      endAtUtc = algiersLocalToUtcIso(closureEndDate, closureEndTime);
    } catch {
      setClosureError("Invalid date or time format.");
      return;
    }

    if (new Date(endAtUtc).getTime() <= new Date(startAtUtc).getTime()) {
      setClosureError("End date/time must be strictly after start date/time.");
      return;
    }

    addBlockMutation.mutate({
      startAt: startAtUtc,
      endAt: endAtUtc,
      reason: closureReason.trim() || undefined,
    });
  };

  // Group slots by their Algiers day of week (0..6)
  const slotsByDay = useMemo(() => {
    const map = new Map<number, AvailableSlot[]>();
    for (let i = 0; i < 7; i++) {
      map.set(i, []);
    }

    if (!slots) return map;

    for (const slot of slots) {
      const dayIndex = getAlgiersDayOfWeek(slot.startAt);
      const dayList = map.get(dayIndex) ?? [];
      dayList.push(slot);
      map.set(dayIndex, dayList);
    }

    return map;
  }, [slots]);

  // Active (non-cancelled) blocks
  const activeBlocks = useMemo(() => {
    return blocks.filter((b) => b.cancelledAt === null);
  }, [blocks]);

  // Total bookable slots this week
  const totalSlotsCount = slots?.length ?? 0;

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 md:p-8 shadow-sm space-y-8">
      {/* Calendar Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {pitchName} — Weekly Slot Inventory
            </h2>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              Rate: {formatMoney(hourlyRate)}/hr
            </span>
            <span className="rounded-full bg-emerald-500/10 text-emerald-500 text-xs px-2.5 py-0.5 border border-emerald-500/20 font-medium">
              Africa/Algiers (UTC+1)
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Exact available match slots calculated from recurring rules minus closures and maintenance.
          </p>
        </div>

        {/* Action button */}
        {isOwner && (
          <button
            type="button"
            onClick={() => {
              // Pre-fill start/end date with current week's selected days if empty
              if (!closureStartDate && days[0]) {
                setClosureStartDate(days[0].dateStr);
                setClosureEndDate(days[0].dateStr);
              }
              setIsAddClosureOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold px-4 py-2 text-xs shadow-sm transition-all focus:ring-2 focus:ring-amber-500 focus:outline-none"
          >
            <span>🚫</span>
            <span>Add Pitch Closure</span>
          </button>
        )}
      </div>

      {/* Week Navigator & Duration Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-50/80 dark:bg-zinc-800/30 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
        {/* Week navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            aria-label="Previous week"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            aria-label="Next week"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            Next →
          </button>
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 ml-2">
            {weekLabel}
          </span>
        </div>

        {/* Duration selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-medium">Duration:</span>
          <div className="flex rounded-lg bg-zinc-200/70 dark:bg-zinc-800 p-0.5 text-xs">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDurationMinutes(opt.value)}
                className={`rounded-md px-2.5 py-1 font-semibold transition-all ${
                  durationMinutes === opt.value
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-600 dark:text-emerald-400"
        >
          {statusMessage}
        </div>
      )}

      {/* Loading State */}
      {slotsLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800"
              />
            ))}
          </div>
        </div>
      )}

      {/* Retry State on Slot Error */}
      {slotsError && !slotsLoading && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-8 text-center space-y-3">
          <h3 className="text-base font-bold text-red-500">Failed to load weekly slots</h3>
          <p className="text-xs text-zinc-400">
            {slotsError instanceof Error ? slotsError.message : "A network error occurred."}
          </p>
          <button
            type="button"
            onClick={() => void refetchSlots()}
            className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 transition-colors"
          >
            Retry Loading Slots
          </button>
        </div>
      )}

      {/* Week Calendar Grid (7 columns) */}
      {!slotsLoading && !slotsError && (
        <div className="space-y-4">
          {/* Empty State when no slots across entire week */}
          {totalSlotsCount === 0 && (
            <div className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center space-y-2">
              <div className="text-3xl">🏟️</div>
              <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                No bookable slots for this week
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                No active operating rules match this period, or active pitch closures have blocked
                all available slots.
              </p>
            </div>
          )}

          {/* 7-column calendar display */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 overflow-x-auto">
            {days.map((day) => {
              const daySlots = slotsByDay.get(day.dayOfWeek) ?? [];

              return (
                <div
                  key={day.dateStr}
                  className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/20 p-3 min-w-[130px]"
                >
                  {/* Day Header */}
                  <div className="border-b border-zinc-200/70 dark:border-zinc-800/80 pb-2 mb-2 text-center">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                      {day.dayLabel}
                    </span>
                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                      {day.dateLabel}
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      {daySlots.length} {daySlots.length === 1 ? "slot" : "slots"}
                    </span>
                  </div>

                  {/* Day Slots List */}
                  <div className="flex-1 space-y-2 overflow-y-auto max-h-80 pr-1">
                    {daySlots.length === 0 ? (
                      <div className="text-[11px] text-zinc-400 text-center py-6 italic">
                        No slots
                      </div>
                    ) : (
                      daySlots.map((slot) => (
                        <div
                          key={`${slot.startAt}-${slot.endAt}`}
                          className="rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-900 p-2 shadow-xs hover:border-emerald-500/60 transition-colors"
                        >
                          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                            <span>
                              {formatAlgiersTime(slot.startAt)} – {formatAlgiersTime(slot.endAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-1">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatMoney(slot.price)}
                            </span>
                            <span className="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0.2 font-medium">
                              Open
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Closures / Pitch Blocks Section */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <span>Active Pitch Closures & Maintenance ({activeBlocks.length})</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Scheduled closures automatically subtract time intervals from public inventory.
            </p>
          </div>
        </div>

        {activeBlocks.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 p-5 text-center text-xs text-zinc-500">
            No active closures or maintenance scheduled. Pitch runs on normal operating rules.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeBlocks.map((block) => (
              <div
                key={block.id}
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5">
                      Closed
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Added {new Date(block.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 mt-2">
                    {formatAlgiersDateTime(block.startAt)} – {formatAlgiersDateTime(block.endAt)}
                  </div>

                  {block.reason && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 italic">
                      “{block.reason}”
                    </p>
                  )}
                </div>

                {isOwner && (
                  <div className="border-t border-amber-500/20 pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => cancelBlockMutation.mutate(block.id)}
                      disabled={cancelBlockMutation.isPending}
                      className="text-xs font-semibold text-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {cancelBlockMutation.isPending ? "Removing..." : "Remove Closure ✕"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Closure Modal */}
      {isAddClosureOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-closure-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3
                id="modal-closure-title"
                className="text-base font-bold text-zinc-900 dark:text-zinc-100"
              >
                Schedule Pitch Closure / Maintenance
              </h3>
              <button
                type="button"
                onClick={() => setIsAddClosureOpen(false)}
                className="text-zinc-400 hover:text-zinc-100 p-1 text-sm font-bold"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Times are entered in Africa/Algiers local time (UTC+1) and saved in UTC.
            </p>

            {closureError && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500 font-medium"
              >
                {closureError}
              </div>
            )}

            <form onSubmit={handleCreateClosure} className="space-y-4">
              {/* Start Date & Time */}
              <div className="space-y-1">
                <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Closure Start (Algiers Local Time)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={closureStartDate}
                    onChange={(e) => setClosureStartDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="time"
                    value={closureStartTime}
                    onChange={(e) => setClosureStartTime(e.target.value)}
                    required
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* End Date & Time */}
              <div className="space-y-1">
                <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Closure End (Algiers Local Time)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={closureEndDate}
                    onChange={(e) => setClosureEndDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="time"
                    value={closureEndTime}
                    onChange={(e) => setClosureEndTime(e.target.value)}
                    required
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <label
                  htmlFor="closure-reason"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Reason (optional)
                </label>
                <input
                  id="closure-reason"
                  type="text"
                  placeholder="e.g. Turf maintenance, Private event, Facility repairs"
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value)}
                  maxLength={500}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddClosureOpen(false)}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addBlockMutation.isPending}
                  className="rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 px-4 py-2 text-xs font-semibold shadow transition-all disabled:opacity-50"
                >
                  {addBlockMutation.isPending ? "Applying Closure..." : "Apply Closure"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
