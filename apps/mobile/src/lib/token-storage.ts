import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const KEY = "fc_refresh_token";

// expo-secure-store is native-only. On web we fall back to localStorage
// (fine for a dev preview; not used on the real iOS/Android targets).
const isWeb = Platform.OS === "web";

interface WebStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const webStore = (globalThis as { localStorage?: WebStore }).localStorage;

export async function saveRefreshToken(token: string): Promise<void> {
  if (isWeb) {
    webStore?.setItem(KEY, token);
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function getRefreshToken(): Promise<string | null> {
  if (isWeb) {
    return webStore?.getItem(KEY) ?? null;
  }
  return SecureStore.getItemAsync(KEY);
}

export async function clearRefreshToken(): Promise<void> {
  if (isWeb) {
    webStore?.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
