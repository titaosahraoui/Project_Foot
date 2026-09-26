import { createApiClient } from "@footconnect/api-client";

// Access token lives in memory; the auth context updates it. The refresh token
// is an httpOnly cookie, so the client is created with withCredentials.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const api = createApiClient({
  baseUrl: apiBaseUrl,
  withCredentials: true,
  getToken: () => accessToken,
});
