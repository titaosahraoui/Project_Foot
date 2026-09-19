"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { PitchDetail } from "@footconnect/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/format-money";
import { AvailabilityRuleEditor } from "@/components/pitches/AvailabilityRuleEditor";
import { PitchCalendar } from "@/components/pitches/PitchCalendar";

export default function PitchAvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"calendar" | "rules">("calendar");

  const {
    data: pitch,
    isLoading: pitchLoading,
    error: pitchError,
    refetch,
  } = useQuery<PitchDetail>({
    queryKey: ["pitch", id],
    queryFn: () => api.getPitch(id),
  });

  // 1. Auth loading state
  if (authLoading || pitchLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-zinc-400">
        Loading pitch availability manager...
      </div>
    );
  }

  // 2. Unauthenticated state
  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Sign In Required</h1>
        <p className="text-xs text-zinc-400">
          You must be signed in as a pitch owner to manage availability schedules.
        </p>
        <Link
          href="/login"
          className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition-all"
        >
          Sign In
        </Link>
      </div>
    );
  }

  // 3. Error / Not Found State
  if (pitchError || !pitch) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center space-y-4">
        <h2 className="text-xl font-bold text-red-500">Pitch not found</h2>
        <p className="text-xs text-zinc-400">
          {pitchError instanceof Error
            ? pitchError.message
            : "Could not retrieve pitch details. Please verify the link."}
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
            Back to Pitches
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = pitch.ownerId === user.id || user.roles.includes("ADMIN");

  // 4. Forbidden State for non-owners
  if (!isOwner) {
    return (
      <div className="mx-auto max-w-lg p-12 text-center space-y-4">
        <div className="text-4xl">🔒</div>
        <h2 className="text-xl font-bold text-amber-500">Access Forbidden</h2>
        <p className="text-xs text-zinc-400">
          You do not have permission to manage operating rules or closures for “{pitch.name}”. Only
          the facility owner may access commercial scheduling.
        </p>
        <Link
          href={`/pitches/${pitch.id}`}
          className="inline-block rounded-xl bg-zinc-800 px-5 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors"
        >
          View Public Pitch Details
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 space-y-8">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
            <Link href="/pitches" className="hover:underline">
              Pitches
            </Link>
            <span>›</span>
            <Link href={`/pitches/${pitch.id}`} className="hover:underline">
              {pitch.name}
            </Link>
            <span>›</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">Availability</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
              {pitch.name} — Schedule & Availability
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

          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            📍 {pitch.address}, {pitch.city} · Hourly Rate: {formatMoney(pitch.hourlyRate)} · Timezone: Africa/Algiers (UTC+1)
          </p>
        </div>

        <Link
          href={`/pitches/${pitch.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Pitch Overview
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab("calendar")}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === "calendar"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
          }`}
        >
          Weekly Inventory & Closures 📅
          {activeTab === "calendar" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rules")}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === "rules"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
          }`}
        >
          Recurring Operating Rules ⚙️
          {activeTab === "rules" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
          )}
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "calendar" ? (
        <PitchCalendar
          pitchId={pitch.id}
          pitchName={pitch.name}
          isOwner={isOwner}
          hourlyRate={pitch.hourlyRate}
          blocks={pitch.blocks}
        />
      ) : (
        <AvailabilityRuleEditor
          pitchId={pitch.id}
          isOwner={isOwner}
        />
      )}
    </div>
  );
}
