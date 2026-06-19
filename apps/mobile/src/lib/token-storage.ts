import * as SecureStore from "expo-secure-store";

const KEY = "fc_refresh_token";

export function saveRefreshToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(KEY, token);
}

export function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export function clearRefreshToken(): Promise<void> {
  return SecureStore.deleteItemAsync(KEY);
}
