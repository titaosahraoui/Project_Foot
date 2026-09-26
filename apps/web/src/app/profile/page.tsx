"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  updateProfileSchema,
  type AuthUser,
  type PlayerPosition,
  type SkillLevel,
  type UpdateProfileInput,
} from "@footconnect/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const POSITIONS: readonly (PlayerPosition | null)[] = [
  null,
  "GK",
  "DEF",
  "MID",
  "FWD",
  "FLEX",
];
const SKILL_LEVELS: readonly (SkillLevel | null)[] = [
  null,
  "BEGINNER",
  "INTERMEDIATE",
  "ADVANCED",
  "PRO",
];

type ProfileField = keyof UpdateProfileInput;
type FieldErrors = Partial<Record<ProfileField, string>>;

function numberField(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

function profileInput(values: {
  displayName: string;
  position: PlayerPosition | null;
  skillLevel: SkillLevel | null;
  bio: string;
  avatarUrl: string;
  latitude: string;
  longitude: string;
}): { data?: UpdateProfileInput; errors: FieldErrors } {
  const lat = numberField(values.latitude);
  const lng = numberField(values.longitude);
  const coordinates =
    lat === undefined && lng === undefined
      ? { lat: null, lng: null }
      : {
          ...(lat === undefined ? {} : { lat }),
          ...(lng === undefined ? {} : { lng }),
        };
  const result = updateProfileSchema.safeParse({
    displayName: values.displayName,
    position: values.position,
    skillLevel: values.skillLevel,
    bio: values.bio.trim() === "" ? null : values.bio,
    avatarUrl: values.avatarUrl.trim() === "" ? null : values.avatarUrl.trim(),
    ...coordinates,
  });

  if (result.success) return { data: result.data, errors: {} };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as ProfileField] = issue.message;
    }
  }
  return { errors };
}

const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-gray-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-50";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-sm text-red-600">{message}</p> : null;
}

function ProfileEditor({ profile }: { profile: AuthUser }) {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [position, setPosition] = useState<PlayerPosition | null>(profile.position);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(profile.skillLevel);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [latitude, setLatitude] = useState(profile.lat?.toString() ?? "");
  const [longitude, setLongitude] = useState(profile.lng?.toString() ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const mutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => api.updateMyProfile(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(["me", updated.id], updated);
      setUser(updated);
      setDisplayName(updated.displayName);
      setPosition(updated.position);
      setSkillLevel(updated.skillLevel);
      setBio(updated.bio ?? "");
      setAvatarUrl(updated.avatarUrl ?? "");
      setLatitude(updated.lat?.toString() ?? "");
      setLongitude(updated.lng?.toString() ?? "");
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = profileInput({
      displayName,
      position,
      skillLevel,
      bio,
      avatarUrl,
      latitude,
      longitude,
    });
    setFieldErrors(result.errors);
    if (result.data) mutation.mutate(result.data);
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <label className="grid gap-1 text-sm font-medium">
        Display name
        <input
          className={inputClass}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
        <FieldError message={fieldErrors.displayName} />
      </label>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Preferred position</legend>
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((value) => (
            <button
              type="button"
              key={value ?? "not-set"}
              aria-pressed={position === value}
              onClick={() => setPosition(value)}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                position === value
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-gray-300 hover:border-emerald-500 dark:border-gray-700"
              }`}
            >
              {value ?? "Not set"}
            </button>
          ))}
        </div>
        <FieldError message={fieldErrors.position} />
      </fieldset>

      <label className="grid gap-1 text-sm font-medium">
        Skill level
        <select
          className={inputClass}
          value={skillLevel ?? ""}
          onChange={(event) =>
            setSkillLevel((event.target.value || null) as SkillLevel | null)
          }
        >
          {SKILL_LEVELS.map((value) => (
            <option key={value ?? "not-set"} value={value ?? ""}>
              {value?.toLowerCase() ?? "Not set"}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors.skillLevel} />
      </label>

      <label className="grid gap-1 text-sm font-medium">
        Bio
        <textarea
          className={`${inputClass} min-h-28`}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
        />
        <FieldError message={fieldErrors.bio} />
      </label>

      <label className="grid gap-1 text-sm font-medium">
        Avatar HTTPS URL
        <input
          type="url"
          className={inputClass}
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
        />
        <FieldError message={fieldErrors.avatarUrl} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Latitude
          <input
            inputMode="decimal"
            className={inputClass}
            value={latitude}
            onChange={(event) => setLatitude(event.target.value)}
          />
          <FieldError message={fieldErrors.lat} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Longitude
          <input
            inputMode="decimal"
            className={inputClass}
            value={longitude}
            onChange={(event) => setLongitude(event.target.value)}
          />
          <FieldError message={fieldErrors.lng} />
        </label>
      </div>

      {mutation.isError ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950">
          Could not save your profile. Your unsaved values are preserved; submit again to retry.
        </p>
      ) : null}
      {mutation.isSuccess ? (
        <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950">
          Profile updated successfully.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {mutation.isPending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const profile = useQuery({
    queryKey: ["me", user?.id],
    queryFn: () => api.getMyProfile(),
    initialData: user ?? undefined,
    enabled: Boolean(user),
  });

  if (loading || profile.isLoading) {
    return <main className="mx-auto max-w-2xl p-8">Loading profile...</main>;
  }
  if (!user) {
    return (
      <main className="mx-auto grid max-w-2xl gap-4 p-8">
        <h1 className="text-3xl font-bold">Profile settings</h1>
        <p>Sign in to edit your FootConnect profile.</p>
        <Link href="/login" className="font-semibold text-emerald-600 underline">
          Sign in
        </Link>
      </main>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <main className="mx-auto grid max-w-2xl gap-4 p-8">
        <p role="alert">Could not load your profile.</p>
        <button
          type="button"
          onClick={() => void profile.refetch()}
          className="w-fit rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-6 p-6 sm:p-10">
      <div>
        <Link href="/" className="text-sm text-emerald-600 underline">
          Back to dashboard
        </Link>
        <h1 className="mt-3 text-3xl font-bold">Profile settings</h1>
        <p className="mt-2 text-gray-500">Update the identity players see across FootConnect.</p>
      </div>
      <ProfileEditor key={profile.data.id} profile={profile.data} />
    </main>
  );
}
