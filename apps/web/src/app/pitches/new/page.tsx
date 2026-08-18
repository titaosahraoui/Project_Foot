"use client";

import { useState } from "react";
import Link from "next/link";
import type { MatchFormat, PitchSurface } from "@footconnect/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const AMENITY_OPTIONS = [
  "SHOWERS",
  "LIGHTING",
  "PARKING",
  "LOCKERS",
  "CHANGING_ROOMS",
  "WIFI",
  "CAFE",
];

export default function NewPitchPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Algiers");
  const [lat, setLat] = useState("36.7538");
  const [lng, setLng] = useState("3.0588");
  const [surface, setSurface] = useState<PitchSurface>("ARTIFICIAL_TURF");
  const [format, setFormat] = useState<MatchFormat>("SEVEN_A_SIDE");
  const [hourlyRateDzd, setHourlyRateDzd] = useState("4000");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    "SHOWERS",
    "LIGHTING",
    "PARKING",
  ]);

  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const majorDzd = parseFloat(hourlyRateDzd) || 0;
      const pitch = await api.createPitch({
        name,
        description: description || undefined,
        address,
        city,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        surface,
        format,
        hourlyRate: {
          amountMinor: Math.round(majorDzd * 100),
          currency: "DZD",
        },
        amenities: selectedAmenities,
        photos: [],
      });

      window.location.href = `/pitches/${pitch.id}`;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create pitch");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
        <p className="text-gray-400 mb-4">You must be logged in to create a pitch.</p>
        <Link href="/login" className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Create New Pitch</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Add a new football pitch to list it for players and team challenges.
          </p>
        </div>
        <Link
          href="/pitches"
          className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Cancel
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Pitch Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Arena Hub (Dely Ibrahim)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Tell players about the turf quality, floodlights, parking, etc."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Address *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Route de Chéraga"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                City *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Algiers"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Latitude *
              </label>
              <input
                type="number"
                step="any"
                required
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Longitude *
              </label>
              <input
                type="number"
                step="any"
                required
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Surface *
              </label>
              <select
                value={surface}
                onChange={(e) => setSurface(e.target.value as PitchSurface)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ARTIFICIAL_TURF">Artificial Turf</option>
                <option value="NATURAL_GRASS">Natural Grass</option>
                <option value="INDOOR_PARQUET">Indoor Parquet</option>
                <option value="CONCRETE">Concrete</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Format *
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as MatchFormat)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="FIVE_A_SIDE">5-a-side</option>
                <option value="SEVEN_A_SIDE">7-a-side</option>
                <option value="ELEVEN_A_SIDE">11-a-side</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Hourly Rate (DZD) *
              </label>
              <input
                type="number"
                min="0"
                step="100"
                required
                placeholder="4000"
                value={hourlyRateDzd}
                onChange={(e) => setHourlyRateDzd(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              Amenities
            </label>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((amenity) => {
                const isSelected = selectedAmenities.includes(amenity);
                return (
                  <button
                    type="button"
                    key={amenity}
                    onClick={() => toggleAmenity(amenity)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    {isSelected ? "✓ " : "+ "}
                    {amenity.replace("_", " ")}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-500 transition-all disabled:opacity-50"
        >
          {loading ? "Creating pitch..." : "Create Pitch"}
        </button>
      </form>
    </div>
  );
}
