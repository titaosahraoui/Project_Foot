"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { PitchDetail } from "@footconnect/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/format-money";
import { DAYS_OF_WEEK, formatAlgiersDateTime, formatTimeRange } from "@/lib/format-time";

export default function PitchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();

  const {
    data: pitch,
    isLoading,
    error,
    refetch,
  } = useQuery<PitchDetail>({
    queryKey: ["pitch", id],
    queryFn: () => api.getPitch(id),
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-zinc-400">
        Loading pitch details...
      </div>
    );
  }

  if (error || !pitch) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center space-y-4">
        <h2 className="text-xl font-bold text-red-500">Pitch not found</h2>
        <p className="text-xs text-zinc-400">
          {error instanceof Error ? error.message : "Unable to retrieve pitch details."}
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Retry
          </button>
          <Link
            href="/pitches"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
          >
            Back to My Pitches
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === pitch.ownerId || user?.roles.includes("ADMIN");
  const activeRules = pitch.availabilityRules?.filter((r) => r.isActive) ?? [];
  const activeBlocks = pitch.blocks?.filter((b) => b.cancelledAt === null) ?? [];

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
              {pitch.name}
            </h1>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                pitch.isActive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-zinc-500/10 text-zinc-500"
              }`}
            >
              {pitch.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            📍 {pitch.address}, {pitch.city} · {formatMoney(pitch.hourlyRate)}/hr ·{" "}
            {pitch.format.replace("_", " ")} ({pitch.surface.replace("_", " ")})
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isOwner && (
            <Link
              href={`/pitches/${pitch.id}/availability`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition-all hover:scale-[1.02]"
            >
              <span>📅 Manage Schedule & Closures</span>
            </Link>
          )}
          <Link
            href="/pitches"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← Back to Pitches
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Availability Summary & Actions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Availability Action Card */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Availability & Operating Schedule
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Manage your recurring operating hours and schedule maintenance closures to generate
                  exact match slots in Africa/Algiers local time.
                </p>
              </div>

              {isOwner && (
                <Link
                  href={`/pitches/${pitch.id}/availability`}
                  className="rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-xs font-semibold hover:bg-emerald-600 dark:hover:bg-emerald-400 dark:hover:text-zinc-900 transition-colors shrink-0"
                >
                  Open Calendar →
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 p-3.5">
                <span className="text-[11px] text-zinc-500 block font-medium">Hourly Price</span>
                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  {formatMoney(pitch.hourlyRate)}
                </span>
                <span className="text-[10px] text-zinc-400">Fixed in DZD</span>
              </div>

              <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 p-3.5">
                <span className="text-[11px] text-zinc-500 block font-medium">Operating Rules</span>
                <span className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 block mt-0.5">
                  {activeRules.length} Active
                </span>
                <span className="text-[10px] text-zinc-400">Recurring weekly</span>
              </div>

              <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 p-3.5 col-span-2 sm:col-span-1">
                <span className="text-[11px] text-zinc-500 block font-medium">Closures</span>
                <span className="text-base font-extrabold text-amber-500 block mt-0.5">
                  {activeBlocks.length} Scheduled
                </span>
                <span className="text-[10px] text-zinc-400">Maintenance/blocks</span>
              </div>
            </div>

            {/* Recurring Rules Quick Preview */}
            <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Operating Hours Preview
              </h3>

              {activeRules.length === 0 ? (
                <p className="text-xs text-zinc-500 italic">
                  No operating hours configured yet. Click “Open Calendar” to define weekly rules.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeRules.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-800/60 px-2.5 py-1 text-xs font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {DAYS_OF_WEEK[r.dayOfWeek]?.slice(0, 3)}:
                      </strong>
                      <span>{formatTimeRange(r.startMinute, r.endMinute)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Active Closures Preview */}
            {activeBlocks.length > 0 && (
              <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-4 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500">
                  Upcoming Closures
                </h3>
                <div className="space-y-1.5">
                  {activeBlocks.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatAlgiersDateTime(b.startAt)} – {formatAlgiersDateTime(b.endAt)}
                        </span>
                        {b.reason && (
                          <span className="text-zinc-500 dark:text-zinc-400 ml-2">
                            ({b.reason})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Facility Specifications */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Pitch Specifications
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Surface</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {pitch.surface.replace("_", " ")}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Format</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {pitch.format.replace("_", " ")}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Hourly Rate</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatMoney(pitch.hourlyRate)} / hr
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Location</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-right">
                  {pitch.city}
                </span>
              </div>
            </div>

            {pitch.amenities.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                  Amenities
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {pitch.amenities.map((a) => (
                    <span
                      key={a}
                      className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      ✓ {a.replace("_", " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {pitch.description && (
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Description
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {pitch.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
