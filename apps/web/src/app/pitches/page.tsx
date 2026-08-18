"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Pitch } from "@footconnect/shared";
import { formatPitchPrice } from "@footconnect/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function PitchesPage() {
  const { user, loading: authLoading } = useAuth();

  const { data: pitches, isLoading, error } = useQuery<Pitch[]>({
    queryKey: ["my-pitches"],
    queryFn: () => api.getMyPitches(),
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-gray-400">
        Loading session...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
        <h1 className="text-2xl font-bold">Pitch Owner Dashboard</h1>
        <p className="text-gray-400">Please sign in to manage your pitches.</p>
        <Link
          href="/login"
          className="rounded-lg bg-emerald-600 px-6 py-2.5 font-medium text-white shadow-md hover:bg-emerald-500 transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            My Pitches ⚽
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Manage your sports facilities, configure availability slots, and set pricing.
          </p>
        </div>
        <Link
          href="/pitches/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-emerald-500 transition-all hover:scale-[1.02]"
        >
          + Add New Pitch
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800"
            />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-red-500">
          Failed to load pitches. Please try again.
        </div>
      ) : !pitches || pitches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-800 p-12 text-center">
          <div className="text-4xl mb-3">🏟️</div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            No pitches registered yet
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mb-6">
            Get started by adding your first football pitch facility to host teams and matches.
          </p>
          <Link
            href="/pitches/new"
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-500 transition-all"
          >
            Create Your First Pitch
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pitches.map((pitch) => (
            <div
              key={pitch.id}
              className="group flex flex-col justify-between rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm hover:shadow-xl transition-all duration-200 hover:-translate-y-1"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-500 transition-colors">
                    {pitch.name}
                  </h2>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      pitch.isActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"
                    }`}
                  >
                    {pitch.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-4 flex items-center gap-1">
                  📍 {pitch.address}, {pitch.city}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {pitch.size.replace("_", " ")}
                  </span>
                  <span className="rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {pitch.surface.replace("_", " ")}
                  </span>
                </div>

                {pitch.description && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-4">
                    {pitch.description}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
                <div>
                  <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatPitchPrice(pitch.hourlyRate)}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400"> / hr</span>
                </div>

                <Link
                  href={`/pitches/${pitch.id}`}
                  className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-xs font-semibold text-white dark:text-zinc-900 hover:bg-emerald-600 dark:hover:bg-emerald-400 dark:hover:text-zinc-900 transition-colors"
                >
                  Manage Slots →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
