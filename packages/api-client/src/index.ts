import type {
  AuthResponse,
  AuthUser,
  CreatePitchInput,
  CreatePitchSlotInput,
  CreateTeamInput,
  FormatCode,
  HealthStatus,
  Invitation,
  LoginInput,
  Pitch,
  PitchDetail,
  PitchQuery,
  PitchSlot,
  RegisterInput,
  SetTeamLineupInput,
  TeamDetail,
  TeamLineup,
  TransferCaptainInput,
  UpdatePitchInput,
  UpdateProfileInput,
  UpdateTeamInput,
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
  // Profile
  getMyProfile(): Promise<AuthUser>;
  updateMyProfile(input: UpdateProfileInput): Promise<AuthUser>;
  // Teams
  createTeam(input: CreateTeamInput): Promise<TeamDetail>;
  getMyTeams(): Promise<TeamDetail[]>;
  getTeam(teamId: string): Promise<TeamDetail>;
  updateTeam(teamId: string, input: UpdateTeamInput): Promise<TeamDetail>;
  transferTeamCaptain(teamId: string, input: TransferCaptainInput): Promise<TeamDetail>;
  archiveTeam(teamId: string): Promise<TeamDetail>;
  reactivateTeam(teamId: string): Promise<TeamDetail>;
  getTeamLineups(teamId: string): Promise<TeamLineup[]>;
  setTeamLineup(teamId: string, format: FormatCode, input: SetTeamLineupInput): Promise<TeamLineup>;
  inviteToTeam(teamId: string, email: string): Promise<void>;
  getInvitations(): Promise<Invitation[]>;
  acceptInvitation(invitationId: string): Promise<TeamDetail>;
  declineInvitation(invitationId: string): Promise<void>;
  removeTeamMember(teamId: string, userId: string): Promise<void>;
  leaveTeam(teamId: string, userId: string): Promise<void>;
  // Pitches
  getPitches(query?: PitchQuery): Promise<Pitch[]>;
  getMyPitches(): Promise<Pitch[]>;
  getPitch(id: string): Promise<PitchDetail>;
  createPitch(input: CreatePitchInput): Promise<PitchDetail>;
  updatePitch(id: string, input: UpdatePitchInput): Promise<PitchDetail>;
  getPitchSlots(pitchId: string): Promise<PitchSlot[]>;
  createPitchSlots(pitchId: string, slots: CreatePitchSlotInput[]): Promise<PitchSlot[]>;
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
    getMyProfile: () => request<AuthUser>("/api/v1/users/me"),
    updateMyProfile: (input) =>
      request<AuthUser>("/api/v1/users/me", {
        method: "PATCH",
        body: json(input),
      }),
    createTeam: (input) => post<TeamDetail>("/api/v1/teams", input),
    getMyTeams: () => request<TeamDetail[]>("/api/v1/teams/mine"),
    getTeam: (teamId) => request<TeamDetail>(`/api/v1/teams/${teamId}`),
    updateTeam: (teamId, input) =>
      request<TeamDetail>(`/api/v1/teams/${teamId}`, {
        method: "PATCH",
        body: json(input),
      }),
    transferTeamCaptain: (teamId, input) =>
      post<TeamDetail>(`/api/v1/teams/${teamId}/captain-transfer`, input),
    archiveTeam: (teamId) => post<TeamDetail>(`/api/v1/teams/${teamId}/archive`),
    reactivateTeam: (teamId) => post<TeamDetail>(`/api/v1/teams/${teamId}/reactivate`),
    getTeamLineups: (teamId) => request<TeamLineup[]>(`/api/v1/teams/${teamId}/lineups`),
    setTeamLineup: (teamId, format, input) =>
      request<TeamLineup>(`/api/v1/teams/${teamId}/lineups/${format}`, {
        method: "PUT",
        body: json(input),
      }),
    inviteToTeam: async (teamId, email) => {
      await post<void>(`/api/v1/teams/${teamId}/invitations`, { email });
    },
    getInvitations: () => request<Invitation[]>("/api/v1/teams/invitations"),
    acceptInvitation: (invitationId) =>
      post<TeamDetail>(`/api/v1/teams/invitations/${invitationId}/accept`),
    declineInvitation: async (invitationId) => {
      await post<void>(`/api/v1/teams/invitations/${invitationId}/decline`);
    },
    removeTeamMember: async (teamId, userId) => {
      await request<void>(`/api/v1/teams/${teamId}/members/${userId}`, { method: "DELETE" });
    },
    leaveTeam: async (teamId, userId) => {
      await request<void>(`/api/v1/teams/${teamId}/members/${userId}`, { method: "DELETE" });
    },
    getPitches: (query) => {
      const params = new URLSearchParams();
      if (query?.city) params.set("city", query.city);
      if (query?.surface) params.set("surface", query.surface);
      if (query?.format) params.set("format", query.format);
      if (query?.size) params.set("size", query.size);
      if (query?.maxPriceMinor !== undefined) params.set("maxPriceMinor", String(query.maxPriceMinor));
      if (query?.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
      if (query?.lat !== undefined) params.set("lat", String(query.lat));
      if (query?.lng !== undefined) params.set("lng", String(query.lng));
      if (query?.radiusKm !== undefined) params.set("radiusKm", String(query.radiusKm));
      const qs = params.toString();
      return request<Pitch[]>(`/api/v1/pitches${qs ? `?${qs}` : ""}`);
    },
    getMyPitches: () => request<Pitch[]>("/api/v1/pitches/mine"),
    getPitch: (id) => request<PitchDetail>(`/api/v1/pitches/${id}`),
    createPitch: (input) => post<PitchDetail>("/api/v1/pitches", input),
    updatePitch: (id, input) =>
      request<PitchDetail>(`/api/v1/pitches/${id}`, {
        method: "PATCH",
        body: json(input),
      }),
    getPitchSlots: (pitchId) => request<PitchSlot[]>(`/api/v1/pitches/${pitchId}/slots`),
    createPitchSlots: (pitchId, slots) =>
      post<PitchSlot[]>(`/api/v1/pitches/${pitchId}/slots`, { slots }),
  };
}
