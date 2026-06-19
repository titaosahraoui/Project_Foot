import { createApiClient } from "@footconnect/api-client";

// Access token lives in memory; the auth context updates it via setAccessToken.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export const api = createApiClient({
  baseUrl,
  getToken: () => accessToken,
});
