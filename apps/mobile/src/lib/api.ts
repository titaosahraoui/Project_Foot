import Constants from "expo-constants";
import { Platform } from "react-native";
import { createApiClient } from "@footconnect/api-client";

// Access token lives in memory; the auth context updates it via setAccessToken.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Resolves the backend API base URL depending on platform and runtime environment.
 *
 * 1. If EXPO_PUBLIC_API_URL is set to an external or public host (e.g. tunnel, public IP, domain),
 *    that URL is used as-is.
 * 2. On Web, localhost:4000 works directly since the browser executes on the host computer.
 * 3. On Native (physical phone via Expo Go or dev client), localhost/127.0.0.1 refers to the
 *    phone itself. We automatically discover the host machine's LAN IP from Expo's Metro bundler
 *    (Constants.expoConfig?.hostUri) and rewrite localhost/127.0.0.1 to that IP address.
 * 4. On Android emulator without hostUri, 10.0.2.2 is used as the standard host bridge.
 */
export function resolveApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  // If explicitly configured with a non-localhost URL (e.g. tunnel or remote domain), use it directly.
  if (envUrl && !envUrl.includes("localhost") && !envUrl.includes("127.0.0.1")) {
    return envUrl;
  }

  const base = envUrl || "http://localhost:4000";

  // Web runs directly in the host browser where localhost works
  if (Platform.OS === "web") {
    return base;
  }

  // Attempt to extract the Metro bundler's host IP (e.g. 192.168.100.116)
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
    (Constants as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoClient?.hostUri ??
    (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri) {
    const hostIp = hostUri.split(":")[0];
    if (hostIp && hostIp !== "localhost" && hostIp !== "127.0.0.1") {
      return base.replace(/localhost|127\.0\.0\.1/, hostIp);
    }
  }

  // Android emulator fallback
  if (Platform.OS === "android") {
    return base.replace(/localhost|127\.0\.0\.1/, "10.0.2.2");
  }

  return base;
}

export const apiBaseUrl = resolveApiBaseUrl();

export const api = createApiClient({
  baseUrl: apiBaseUrl,
  getToken: () => accessToken,
});

