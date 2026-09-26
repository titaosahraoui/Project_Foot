"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PitchAvailabilityRule, SetPitchAvailabilityRuleItem } from "@footconnect/shared";
import { api } from "@/lib/api";
import {
  DAYS_OF_WEEK,
  formatTimeRange,
  timeStringToMinutes,
} from "@/lib/format-time";

interface LocalRule {
  id?: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface AvailabilityRuleEditorProps {
  pitchId: string;
  isOwner: boolean;
  onRulesUpdated?: () => void;
}

export function AvailabilityRuleEditor({
  pitchId,
  isOwner,
  onRulesUpdated,
}: AvailabilityRuleEditorProps) {
  const queryClient = useQueryClient();

  // Query server rules
  const {
    data: serverRules,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<PitchAvailabilityRule[]>({
    queryKey: ["availability-rules", pitchId],
    queryFn: () => api.getPitchAvailabilityRules(pitchId),
  });

  // Local editable rules state (preserved on errors, reset on save/explicit reset)
  const [customRules, setCustomRules] = useState<LocalRule[] | null>(null);

  const rules: LocalRule[] = useMemo(() => {
    if (customRules !== null) return customRules;
    if (!serverRules) return [];
    return serverRules.map((r) => ({
      id: r.id,
      dayOfWeek: r.dayOfWeek,
      startMinute: r.startMinute,
      endMinute: r.endMinute,
      startTime: r.startTime,
      endTime: r.endTime,
      isActive: r.isActive,
    }));
  }, [customRules, serverRules]);

  const setRules = (updater: LocalRule[] | ((prev: LocalRule[]) => LocalRule[])) => {
    if (typeof updater === "function") {
      setCustomRules((prev) => updater(prev ?? rules));
    } else {
      setCustomRules(updater);
    }
  };

  // New rule form state
  const [newDayOfWeek, setNewDayOfWeek] = useState<number>(0);
  const [newStartTime, setNewStartTime] = useState<string>("09:00");
  const [newEndTime, setNewEndTime] = useState<string>("12:00");
  const [newIsActive, setNewIsActive] = useState<boolean>(true);

  // Status & feedback state
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Mutation to replace all availability rules
  const saveMutation = useMutation({
    mutationFn: async (updatedRules: LocalRule[]) => {
      const payload: SetPitchAvailabilityRuleItem[] = updatedRules.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
        isActive: r.isActive,
      }));
      return api.setPitchAvailabilityRules(pitchId, { rules: payload });
    },
    onSuccess: () => {
      // Invalidate relevant TanStack Query caches
      void queryClient.invalidateQueries({ queryKey: ["availability-rules", pitchId] });
      void queryClient.invalidateQueries({ queryKey: ["pitch", pitchId] });
      void queryClient.invalidateQueries({ queryKey: ["available-slots", pitchId] });

      setCustomRules(null);
      setMutationError(null);
      setValidationError(null);
      setSuccessMessage("Recurring availability rules updated successfully! ✨");
      setTimeout(() => setSuccessMessage(null), 4000);
      onRulesUpdated?.();
    },
    onError: (err: Error) => {
      // Form input is intentionally preserved on error
      setMutationError(err.message || "Failed to save availability rules. Please try again.");
    },
  });


  // Client-side overlap checker
  const checkRuleConflicts = (rulesToCheck: LocalRule[]): string | null => {
    const activeByDay = new Map<number, LocalRule[]>();
    for (const r of rulesToCheck) {
      if (!r.isActive) continue;
      const list = activeByDay.get(r.dayOfWeek) ?? [];
      list.push(r);
      activeByDay.set(r.dayOfWeek, list);
    }

    for (const [day, dayRules] of activeByDay.entries()) {
      const sorted = [...dayRules].sort((a, b) => a.startMinute - b.startMinute);
      for (let i = 0; i < sorted.length - 1; i++) {
        const curr = sorted[i]!;
        const next = sorted[i + 1]!;
        if (curr.endMinute > next.startMinute) {
          return `Conflict on ${DAYS_OF_WEEK[day]}: rule (${curr.startTime}–${curr.endTime}) overlaps with (${next.startTime}–${next.endTime}).`;
        }
      }
    }
    return null;
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setMutationError(null);

    let startMinute: number;
    let endMinute: number;
    try {
      startMinute = timeStringToMinutes(newStartTime);
      endMinute = timeStringToMinutes(newEndTime);
    } catch {
      setValidationError("Invalid time format. Please use HH:mm (e.g. 09:00).");
      return;
    }

    if (endMinute <= startMinute) {
      setValidationError("End time must be after start time.");
      return;
    }

    if (endMinute - startMinute < 30) {
      setValidationError("Availability rule must be at least 30 minutes long.");
      return;
    }

    const newRule: LocalRule = {
      dayOfWeek: newDayOfWeek,
      startMinute,
      endMinute,
      startTime: newStartTime,
      endTime: newEndTime,
      isActive: newIsActive,
    };

    const nextRules = [...rules, newRule];
    const conflict = checkRuleConflicts(nextRules);
    if (conflict) {
      setValidationError(conflict);
      return;
    }

    setRules(nextRules);
  };

  const handleDeleteRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
    setValidationError(null);
  };

  const handleToggleActive = (index: number) => {
    setRules((prev) => {
      const updated = [...prev];
      const target = updated[index];
      if (target) {
        updated[index] = { ...target, isActive: !target.isActive };
      }
      return updated;
    });
    setValidationError(null);
  };

  const handleSaveAll = () => {
    setValidationError(null);
    setMutationError(null);

    const conflict = checkRuleConflicts(rules);
    if (conflict) {
      setValidationError(conflict);
      return;
    }

    saveMutation.mutate(rules);
  };

  const handleReset = () => {
    setCustomRules(null);
    setValidationError(null);
    setMutationError(null);
  };


  // 1. Loading State
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-8 shadow-sm space-y-4">
        <div className="h-6 w-48 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-96 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800/60" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60"
            />
          ))}
        </div>
      </div>
    );
  }

  // 2. Retry State on Query Error
  if (queryError) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center space-y-3">
        <h3 className="text-base font-bold text-red-500">Failed to load availability rules</h3>
        <p className="text-xs text-zinc-400">
          {queryError instanceof Error ? queryError.message : "A network error occurred."}
        </p>
        <button
          onClick={() => void refetch()}
          className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // 3. Forbidden State for non-owners
  if (!isOwner) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-8 text-center space-y-2">
        <div className="text-2xl">🔒</div>
        <h3 className="text-base font-bold text-amber-500">Access Restricted</h3>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Only the verified pitch owner can modify recurring availability rules and operating hours.
        </p>
      </div>
    );
  }

  // Sort rules for presentation by day of week then start minute
  const sortedRulesWithIndex = rules
    .map((rule, originalIndex) => ({ rule, originalIndex }))
    .sort((a, b) => {
      if (a.rule.dayOfWeek !== b.rule.dayOfWeek) {
        return a.rule.dayOfWeek - b.rule.dayOfWeek;
      }
      return a.rule.startMinute - b.rule.startMinute;
    });

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 md:p-8 shadow-sm space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>Recurring Operating Rules</span>
            <span className="rounded-full bg-emerald-500/10 text-emerald-500 text-xs px-2.5 py-0.5 border border-emerald-500/20 font-medium">
              Africa/Algiers (UTC+1)
            </span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Define recurring weekly open hours. Player discovery and bookable slots are automatically
            generated from these rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={saveMutation.isPending}
            className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saveMutation.isPending}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50 transition-all focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {saveMutation.isPending ? "Saving Rules..." : "Save Operating Rules"}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-600 dark:text-emerald-400"
        >
          {successMessage}
        </div>
      )}

      {(validationError || mutationError) && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs font-medium text-red-500 space-y-1"
        >
          <div className="font-bold">Cannot save schedule:</div>
          <div>{validationError || mutationError}</div>
        </div>
      )}

      {/* Existing Rules List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
          <span>Configured Weekly Rules ({rules.length})</span>
          {rules.length > 0 && (
            <span className="text-[11px] font-normal text-zinc-500">
              Active rules generate open slots
            </span>
          )}
        </h3>

        {/* 4. Empty State */}
        {rules.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center space-y-2">
            <div className="text-3xl">⏰</div>
            <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              No operating rules configured
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              Add recurring operating rules below to make your pitch bookable by amateur teams.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedRulesWithIndex.map(({ rule, originalIndex }) => (
              <div
                key={rule.id ?? `${rule.dayOfWeek}-${rule.startMinute}-${rule.endMinute}-${originalIndex}`}
                className={`rounded-xl border p-4 transition-all flex flex-col justify-between gap-3 ${
                  rule.isActive
                    ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40"
                    : "border-zinc-200 dark:border-zinc-800/50 bg-zinc-100/40 dark:bg-zinc-900/30 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      {DAYS_OF_WEEK[rule.dayOfWeek]}
                    </span>
                    <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                      {formatTimeRange(rule.startMinute, rule.endMinute)}
                    </div>
                    <span className="text-[10px] text-zinc-500">
                      {rule.endMinute - rule.startMinute} mins
                    </span>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                      rule.isActive
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                    }`}
                  >
                    {rule.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-zinc-200/60 dark:border-zinc-800/60 pt-2.5">
                  <label className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.isActive}
                      onChange={() => handleToggleActive(originalIndex)}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Active</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleDeleteRule(originalIndex)}
                    aria-label={`Delete rule for ${DAYS_OF_WEEK[rule.dayOfWeek]} ${rule.startTime} to ${rule.endTime}`}
                    className="text-xs font-semibold text-red-500 hover:text-red-400 transition-colors p-1"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Rule Form */}
      <form
        onSubmit={handleAddRule}
        className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/20 p-5 space-y-4"
      >
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
          + Add Operating Hours Rule
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Day of Week */}
          <div className="space-y-1">
            <label
              htmlFor="rule-day"
              className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Day of Week
            </label>
            <select
              id="rule-day"
              value={newDayOfWeek}
              onChange={(e) => setNewDayOfWeek(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none"
            >
              {DAYS_OF_WEEK.map((day, idx) => (
                <option key={day} value={idx}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          {/* Start Time */}
          <div className="space-y-1">
            <label
              htmlFor="rule-start"
              className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              Start Time (Algiers)
            </label>
            <input
              id="rule-start"
              type="time"
              value={newStartTime}
              onChange={(e) => setNewStartTime(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* End Time */}
          <div className="space-y-1">
            <label
              htmlFor="rule-end"
              className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
            >
              End Time (Algiers)
            </label>
            <input
              id="rule-end"
              type="time"
              value={newEndTime}
              onChange={(e) => setNewEndTime(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Action button & active checkbox */}
          <div className="flex flex-col justify-end gap-2">
            <div className="flex items-center gap-2">
              <input
                id="rule-active"
                type="checkbox"
                checked={newIsActive}
                onChange={(e) => setNewIsActive(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500"
              />
              <label
                htmlFor="rule-active"
                className="text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer"
              >
                Enabled
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-emerald-600 dark:hover:bg-emerald-400 dark:hover:text-zinc-900 transition-colors"
            >
              Add to Schedule
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
