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

  if (isLoading) return <span className="text-[#8e9379]">checking API…</span>;
  if (isError || !data) return <span className="text-[#ffb4ab]">API unreachable</span>;

  const color =
    data.status === "ok"
      ? "text-[#00fd93]"
      : data.status === "degraded"
        ? "text-[#ffb200]"
        : "text-[#ffb4ab]";

  return (
    <span className={`text-xs font-mono font-medium ${color}`}>
      LIVE SYSTEM: {data.status.toUpperCase()} · DB {data.db ? "✓" : "✗"} · REDIS {data.redis ? "✓" : "✗"}
    </span>
  );
}

export default function Home() {
  const { user, loading, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-[#0A0F0A] bg-grid-pattern">
      {/* Navigation Drawer (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/10 bg-[#0c0f0d] py-6 px-4 fixed h-full z-30">
        <div className="flex items-center gap-3 px-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-[#1d201e] border border-[#8e9379]/40 flex items-center justify-center font-headline text-lg font-bold text-[#c3f400] shadow-[0_0_12px_rgba(195,244,0,0.25)]">
            FC
          </div>
          <div>
            <h1 className="font-headline text-xl font-bold tracking-tight text-[#c3f400] leading-none m-0">
              ARENA HUB
            </h1>
            <p className="font-mono text-[10px] text-[#c4c9ac] tracking-wider uppercase m-0 mt-0.5">
              Pitch Owner Hub
            </p>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-1.5">
          <Link
            href="/pitches"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-[#272b29]/60 border-l-4 border-[#c3f400] text-[#c3f400] font-headline text-sm font-semibold tracking-wide transition-all"
          >
            <span>🏟️</span>
            <span>MY PITCHES</span>
          </Link>
          <a
            href="#schedule"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[#c4c9ac] hover:text-white hover:bg-[#1d201e] font-headline text-sm font-semibold tracking-wide transition-all"
          >
            <span>📅</span>
            <span>TODAY'S SLOTS</span>
          </a>
          <a
            href="#analytics"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[#c4c9ac] hover:text-white hover:bg-[#1d201e] font-headline text-sm font-semibold tracking-wide transition-all"
          >
            <span>📊</span>
            <span>ANALYTICS</span>
          </a>
          <Link
            href="/profile"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[#c4c9ac] hover:text-white hover:bg-[#1d201e] font-headline text-sm font-semibold tracking-wide transition-all"
          >
            <span>⚙️</span>
            <span>SETTINGS</span>
          </Link>
        </nav>

        <div className="pt-4 border-t border-white/5 px-2">
          <ApiStatus />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top App Bar Header */}
        <header className="h-16 border-b border-white/5 bg-[#111412]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="md:hidden font-headline text-xl font-bold text-[#c3f400]">ARENA HUB</span>
            <span className="hidden md:inline font-headline text-lg font-bold text-white tracking-wide uppercase">
              Stadium Infrastructure & Booking Center
            </span>
          </div>

          <div className="flex items-center gap-4">
            {loading ? (
              <span className="text-xs text-[#8e9379]">Loading…</span>
            ) : user ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#c4c9ac] hidden sm:inline">
                  Signed in as <strong className="text-white">{user.displayName}</strong>
                </span>
                <button
                  onClick={() => void logout()}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md border border-white/10 text-[#c4c9ac] hover:text-white hover:border-white/20 transition-all"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="font-headline text-sm font-bold uppercase tracking-wider bg-[#c3f400] text-[#161e00] px-4 py-1.5 rounded-md glow-neon transition-all hover:bg-[#abd600]"
              >
                Sign In
              </Link>
            )}
          </div>
        </header>

        {/* Dashboard Canvas */}
        <div className="p-6 md:p-8 flex flex-col gap-8 max-w-7xl">
          {/* Welcome Banner */}
          <div className="layer-1 rounded-xl p-6 border-elite relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="z-10">
              <span className="font-mono text-xs font-semibold text-[#00fd93] uppercase tracking-wider">
                Stadium-at-Night Engine
              </span>
              <h2 className="font-headline text-3xl md:text-4xl font-extrabold text-white mt-1">
                ARENA INFRASTRUCTURE MANAGEMENT
              </h2>
              <p className="text-sm text-[#c4c9ac] mt-1 max-w-xl">
                Configure your astroturf pitches, organize floodlit prime-time hours, and accept player match challenges with automatic Elo ranking updates.
              </p>
            </div>

            <div className="flex gap-3 z-10">
              <Link
                href="/pitches"
                className="font-headline text-base font-bold uppercase tracking-wider bg-[#c3f400] text-[#161e00] px-6 py-3 rounded-lg shadow-[0_0_15px_rgba(195,244,0,0.35)] hover:bg-[#abd600] transition-all"
              >
                MANAGE PITCHES
              </Link>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="layer-1 rounded-xl p-5 border border-white/5 glow-hover transition-all">
              <div className="text-[#8e9379] font-mono text-xs uppercase tracking-wider">Active Pitches</div>
              <div className="font-mono text-3xl font-bold text-white mt-2">3</div>
              <div className="text-xs text-[#00fd93] mt-1">100% Operational</div>
            </div>

            <div className="layer-1 rounded-xl p-5 border border-white/5 glow-hover transition-all">
              <div className="text-[#8e9379] font-mono text-xs uppercase tracking-wider">Today's Bookings</div>
              <div className="font-mono text-3xl font-bold text-[#c3f400] mt-2">12</div>
              <div className="text-xs text-[#c4c9ac] mt-1">Next kickoff: 21:00</div>
            </div>

            <div className="layer-1 rounded-xl p-5 border border-white/5 glow-hover transition-all">
              <div className="text-[#8e9379] font-mono text-xs uppercase tracking-wider">Match Quality Index</div>
              <div className="font-mono text-3xl font-bold text-[#00fd93] mt-2">96%</div>
              <div className="text-xs text-[#00fd93] mt-1">Elite partner status</div>
            </div>

            <div className="layer-1 rounded-xl p-5 border border-white/5 glow-hover transition-all">
              <div className="text-[#8e9379] font-mono text-xs uppercase tracking-wider">Estimated Revenue</div>
              <div className="font-mono text-3xl font-bold text-white mt-2">48,000 <span className="text-sm font-sans text-[#8e9379]">DZD</span></div>
              <div className="text-xs text-[#00fd93] mt-1">+18% vs last week</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
