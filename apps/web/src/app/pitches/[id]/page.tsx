"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreatePitchSlotInput, PitchDetail, PitchSlot } from "@footconnect/shared";
import { formatPitchPrice } from "@footconnect/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DEFAULT_HOURS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00",
];

export default function PitchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedDay, setSelectedDay] = useState(1); // Monday default
  const [selectedHours, setSelectedHours] = useState<string[]>(["18:00", "19:00", "20:00", "21:00"]);
  const [message, setMessage] = useState<string | null>(null);

  const { data: pitch, isLoading, error } = useQuery<PitchDetail>({
    queryKey: ["pitch", id],
    queryFn: () => api.getPitch(id),
  });

  const slotsMutation = useMutation({
    mutationFn: (newSlots: CreatePitchSlotInput[]) => api.createPitchSlots(id, newSlots),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pitch", id] });
      setMessage("Availability slots updated successfully! ✨");
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const toggleHour = (hour: string) => {
    setSelectedHours((prev) =>
      prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour],
    );
  };

  const handleSaveSlots = () => {
    const slots: CreatePitchSlotInput[] = selectedHours.map((h) => {
      const [hh, mm] = h.split(":").map(Number);
      const nextH = (hh + 1).toString().padStart(2, "0");
      return {
        dayOfWeek: selectedDay,
        startTime: h,
        endTime: `${nextH}:${mm.toString().padStart(2, "0")}`,
        isBookable: true,
      };
    });

    slotsMutation.mutate(slots);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-zinc-400">
        Loading pitch details...
      </div>
    );
  }

  if (error || !pitch) {
    return (
      <div className="mx-auto max-w-xl p-12 text-center">
        <h2 className="text-xl font-bold text-red-500">Pitch not found</h2>
        <Link href="/pitches" className="text-sm text-emerald-500 underline mt-4 block">
          ← Back to My Pitches
        </Link>
      </div>
    );
  }

  const daySlots = pitch.slots.filter((s) => s.dayOfWeek === selectedDay);

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8 space-y-8">
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
            📍 {pitch.address}, {pitch.city} · {formatPitchPrice(pitch.hourlyRate)}/hr · {pitch.format.replace("_", " ")} ({pitch.surface.replace("_", " ")})
          </p>
        </div>

        <Link
          href="/pitches"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← Back to Pitches
        </Link>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: Slot Availability Manager */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              Availability & Bookable Hours 📅
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
              Select a day of the week to set recurring available time slots for player bookings.
            </p>

            {/* Day Selector */}
            <div className="flex overflow-x-auto gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-6">
              {DAYS_OF_WEEK.map((dayName, index) => {
                const isSelected = selectedDay === index;
                const slotCount = pitch.slots.filter((s) => s.dayOfWeek === index && s.isBookable).length;

                return (
                  <button
                    key={dayName}
                    onClick={() => {
                      setSelectedDay(index);
                      const currentDaySlots = pitch.slots
                        .filter((s) => s.dayOfWeek === index && s.isBookable)
                        .map((s) => s.startTime);
                      if (currentDaySlots.length > 0) {
                        setSelectedHours(currentDaySlots);
                      }
                    }}
                    className={`flex flex-col items-center rounded-xl px-4 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                      isSelected
                        ? "bg-emerald-600 text-white shadow-md"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                    }`}
                  >
                    <span>{dayName.slice(0, 3)}</span>
                    <span className={`text-[10px] ${isSelected ? "text-emerald-100" : "text-zinc-400"}`}>
                      {slotCount} slots
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Hour slot grid */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Bookable Slots for {DAYS_OF_WEEK[selectedDay]}
              </h3>

              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                {DEFAULT_HOURS.map((h) => {
                  const isSelected = selectedHours.includes(h);
                  return (
                    <button
                      key={h}
                      onClick={() => toggleHour(h)}
                      className={`rounded-xl py-2.5 text-xs font-semibold border transition-all ${
                        isSelected
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm scale-[1.02]"
                          : "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700/80 hover:border-emerald-500"
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleSaveSlots}
                  disabled={slotsMutation.isPending}
                  className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50 transition-all"
                >
                  {slotsMutation.isPending ? "Saving..." : `Save ${DAYS_OF_WEEK[selectedDay]} Schedule`}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Pitch summary info */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Pitch Specifications</h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Surface</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {pitch.surface.replace("_", " ")}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Size</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {pitch.size.replace("_", " ")}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Hourly Rate</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatPitchPrice(pitch.hourlyRate)} / hour
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Total Slots Configured</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {pitch.slots.length}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">Amenities</h4>
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
          </div>
        </div>
      </div>
    </div>
  );
}
