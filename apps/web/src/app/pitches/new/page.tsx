"use client";

import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import type { PitchSize, PitchSurface } from "@footconnect/shared";
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
  const [city, setCity] = useState("");
  const [lat, setLat] = useState("41.3851");
  const [lng, setLng] = useState("2.1734");
  const [surface, setSurface] = useState<PitchSurface>("ARTIFICIAL_TURF");
  const [size, setSize] = useState<PitchSize>("SEVEN_A_SIDE");
  const [pricePerHour, setPricePerHour] = useState("75");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(["SHOWERS", "LIGHTING", "PARKING"]);

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
      const pitch = await api.createPitch({
        name,
        description: description || undefined,
        address,
        city,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        surface,
        size,
        pricePerHour: parseFloat(pricePerHour),
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
    <div className="mx-auto max-w-3xl p-6 md:p-8 space-y-8">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
            Register New Pitch Facility
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Provide details about your football pitch to start receiving team reservations.
          </p>
        </div>
        <Link
          href="/pitches"
          className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:underline"
        >
          ← Cancel
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Basic Info</h2>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Facility / Pitch Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Camp Nou Turf Arena"
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe surface quality, changing rooms, rules..."
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Street Address *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 45 Sports Avenue"
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
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Barcelona"
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-transparent px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Latitude
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
                Longitude
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
        </div>

        <div className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Specifications</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Surface Type
              </label>
              <select
                value={surface}
                onChange={(e) => setSurface(e.target.value as PitchSurface)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ARTIFICIAL_TURF">Artificial Turf 🌿</option>
                <option value="NATURAL_GRASS">Natural Grass 🌱</option>
                <option value="INDOOR_PARQUET">Indoor Parquet 🏟️</option>
                <option value="CONCRETE">Concrete 🏀</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Match Size
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as PitchSize)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="FIVE_A_SIDE">5-a-side</option>
                <option value="SEVEN_A_SIDE">7-a-side</option>
                <option value="ELEVEN_A_SIDE">11-a-side</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Price / Hour ($) *
              </label>
              <input
                type="number"
                min="0"
                step="5"
                required
                value={pricePerHour}
                onChange={(e) => setPricePerHour(e.target.value)}
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

        <div className="flex justify-end gap-4">
          <Link
            href="/pitches"
            className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-6 py-2.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-emerald-600 px-8 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-emerald-500 disabled:opacity-50 transition-all"
          >
            {loading ? "Creating Pitch..." : "Create Pitch"}
          </button>
        </div>
      </form>
    </div>
  );
}
