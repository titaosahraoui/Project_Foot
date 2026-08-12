import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { AuthResponse, AuthUser, LoginInput, RegisterInput } from "@footconnect/shared";
import { useQueryClient } from "@tanstack/react-query";
import { api, setAccessToken } from "./api";
import { clearRefreshToken, getRefreshToken, saveRefreshToken } from "./token-storage";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Persist the rotated refresh token and apply the new session.
  const applySession = useCallback(async (res: AuthResponse) => {
    setAccessToken(res.accessToken);
    if (res.refreshToken) await saveRefreshToken(res.refreshToken);
    setUser(res.user);
  }, []);

  // Restore the session on launch from the stored refresh token.
  useEffect(() => {
    (async () => {
      try {
        const stored = await getRefreshToken();
        if (stored) await applySession(await api.refresh(stored));
      } catch {
        await clearRefreshToken();
        setAccessToken(null);
        setUser(null);
        queryClient.clear();
      } finally {
        setLoading(false);
      }
    })();
  }, [applySession, queryClient]);

  const login = useCallback(
    async (input: LoginInput) => applySession(await api.login(input)),
    [applySession],
  );

  const register = useCallback(
    async (input: RegisterInput) => applySession(await api.register(input)),
    [applySession],
  );

  const logout = useCallback(async () => {
    const stored = await getRefreshToken();
    await api.logout(stored ?? undefined).catch(() => undefined);
    await clearRefreshToken();
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
