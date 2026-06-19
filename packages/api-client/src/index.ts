import type {
  AuthResponse,
  HealthStatus,
  LoginInput,
  RegisterInput,
} from "@footconnect/shared";

export interface ApiClientOptions {
  /** Base URL of the API, e.g. http://localhost:4000 */
  baseUrl: string;
  /** Optional token provider for the Authorization header. */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Send cookies with requests (web uses this for the httpOnly refresh cookie). */
  withCredentials?: boolean;
}

/** Error thrown for non-2xx API responses. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, data?: unknown): Promise<T>;
  put<T>(path: string, data?: unknown): Promise<T>;
  patch<T>(path: string, data?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
  health(): Promise<HealthStatus>;
  // Auth
  register(input: RegisterInput): Promise<AuthResponse>;
  login(input: LoginInput): Promise<AuthResponse>;
  /** Pass a refresh token (mobile); omit to rely on the httpOnly cookie (web). */
  refresh(refreshToken?: string): Promise<AuthResponse>;
  logout(refreshToken?: string): Promise<void>;
}

/**
 * Creates a typed REST client shared by the web and mobile apps.
 * Relies on the global `fetch` (Node 22+, browsers, React Native).
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = options.getToken ? await options.getToken() : undefined;
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetch(`${options.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: options.withCredentials ? "include" : init.credentials,
    });
    const text = await res.text();
    const body: unknown = text ? JSON.parse(text) : undefined;

    if (!res.ok) {
      const message =
        typeof body === "object" && body !== null && "message" in body
          ? String((body as { message: unknown }).message)
          : res.statusText;
      throw new ApiError(res.status, message, body);
    }
    return body as T;
  }

  const json = (data?: unknown) => (data === undefined ? undefined : JSON.stringify(data));
  const post = <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: json(data) });

  return {
    request,
    get: <T>(path: string) => request<T>(path),
    post,
    put: <T>(path: string, data?: unknown) =>
      request<T>(path, { method: "PUT", body: json(data) }),
    patch: <T>(path: string, data?: unknown) =>
      request<T>(path, { method: "PATCH", body: json(data) }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
    health: () => request<HealthStatus>("/health"),
    register: (input) => post<AuthResponse>("/api/v1/auth/register", input),
    login: (input) => post<AuthResponse>("/api/v1/auth/login", input),
    refresh: (refreshToken) =>
      post<AuthResponse>("/api/v1/auth/refresh", refreshToken ? { refreshToken } : {}),
    logout: async (refreshToken) => {
      await post<void>("/api/v1/auth/logout", refreshToken ? { refreshToken } : {});
    },
  };
}
