import { useCallback, useState } from "react";

/**
 * Generates an RFC4122 v4 UUID string.
 * Works across React Native (Hermes), Expo, Web, and Node.
 */
export function generateIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through to pseudo-random fallback
    }
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Hook to manage an idempotency key per user intent.
 * The key remains stable across component re-renders, state updates,
 * and network retries so retry attempts send the exact same key.
 * Calling resetKey() generates a new key for a fresh user intent.
 */
export function useIdempotencyKey(): {
  idempotencyKey: string;
  resetKey: () => void;
} {
  const [key, setKey] = useState<string>(() => generateIdempotencyKey());
  const resetKey = useCallback(() => {
    setKey(generateIdempotencyKey());
  }, []);

  return { idempotencyKey: key, resetKey };
}
