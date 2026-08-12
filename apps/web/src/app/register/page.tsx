"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  getRegistrationErrorMessage,
  registerSchema,
} from "@footconnect/shared";
import { apiBaseUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = registerSchema.safeParse({ displayName, email, password });
    if (!parsed.success) {
      setError("Check your name, email, and a password of 8+ characters.");
      return;
    }

    setSubmitting(true);
    try {
      await register(parsed.data);
      router.push("/");
    } catch (registrationError) {
      setError(getRegistrationErrorMessage(registrationError, apiBaseUrl));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-gray-200 p-6 dark:border-gray-800"
      >
        <h1 className="text-2xl font-bold">Create account</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Start your FootConnect profile.
        </p>
        <input
          type="text"
          autoComplete="name"
          placeholder="Display name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
        />
        <input
          type="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Password (8+ characters)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded border border-gray-300 px-3 py-2 dark:border-gray-700 dark:bg-transparent"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-green-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Already registered?{" "}
          <Link
            href="/login"
            className="font-medium text-green-600 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
