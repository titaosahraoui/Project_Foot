"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { HealthStatus } from "@footconnect/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

function ApiStatus() {
  const { data, isLoading, isError } = useQuery<HealthStatus>({
    queryKey: ["health"],
    queryFn: () => api.health(),
    retry: false,
  });

  if (isLoading) return <span className="text-gray-400">checking API…</span>;
  if (isError || !data) return <span className="text-red-500">API unreachable</span>;

  const color =
    data.status === "ok"
      ? "text-green-500"
      : data.status === "degraded"
        ? "text-amber-500"
        : "text-red-500";

  return (
    <span className={color}>
      API {data.status} · db {data.db ? "✓" : "✗"} · redis {data.redis ? "✓" : "✗"}
    </span>
  );
}

function AuthPanel() {
  const { user, loading, logout } = useAuth();

  if (loading) return <span className="text-gray-400">…</span>;

  if (!user) {
    return (
      <Link href="/login" className="rounded bg-green-600 px-4 py-2 font-medium text-white">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p>
        Signed in as <strong>{user.displayName}</strong> ({user.email})
      </p>
      <div className="flex gap-3">
        <Link
          href="/profile"
          className="rounded-xl border border-emerald-600 px-5 py-2 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950"
        >
          Profile settings
        </Link>
        <Link
          href="/pitches"
          className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-emerald-500 transition-all"
        >
          Manage My Pitches 🏟️
        </Link>
        <button onClick={() => void logout()} className="text-sm text-gray-500 underline py-2">
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold">FootConnect ⚽</h1>
      <p className="max-w-md text-gray-500">
        Pitch-owner dashboard. Manage your pitches, availability, and reservations here.
      </p>
      <AuthPanel />
      <div className="rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-gray-800">
        <ApiStatus />
      </div>
    </main>
  );
}
