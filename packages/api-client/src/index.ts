import type {
  AuthResponse,
  AuthUser,
  AvailableSlot,
  AvailableSlotQuery,
  BookingDetailDto,
  BookingDto,
  CancelBookingInput,
  ConfirmBookingInput,
  CreateBookingInput,
  CreateMatchChallengeInput,
  CreatePitchBlockInput,
  CreatePitchInput,
  CreateTeamAvailabilityInput,
  CreateTeamInput,
  DeclineBookingInput,
  FormatCode,
  HealthStatus,
  Invitation,
  ListBookingsQuery,
  LoginInput,
  MatchChallengeDetail,
  MatchChallengesQuery,
  PaginatedBookings,
  PaginatedMatchChallenges,
  PaginatedRecommendations,
  PaginationQuery,
  Pitch,
  PitchAvailabilityRule,
  PitchBlock,
  PitchDetail,
  PitchQuery,
  RegisterInput,
  SetPitchAvailabilityRulesInput,
  SetTeamLineupInput,
  TeamAvailability,
  TeamDetail,
  TeamLineup,
  TransferCaptainInput,
  UpdatePitchInput,
  UpdateProfileInput,
  UpdateTeamAvailabilityInput,
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

  // Health
  health(): Promise<HealthStatus>;

  // Auth
  register(input: RegisterInput): Promise<AuthResponse>;
  login(input: LoginInput): Promise<AuthResponse>;
  refresh(refreshToken?: string): Promise<AuthResponse>;
  logout(refreshToken?: string): Promise<void>;

  // Users
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
  setTeamLineup(
    teamId: string,
    format: FormatCode,
    input: SetTeamLineupInput,
  ): Promise<TeamLineup>;
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
  getPitchAvailabilityRules(pitchId: string): Promise<PitchAvailabilityRule[]>;
  setPitchAvailabilityRules(
    pitchId: string,
    input: SetPitchAvailabilityRulesInput,
  ): Promise<PitchAvailabilityRule[]>;
  createPitchBlock(pitchId: string, input: CreatePitchBlockInput): Promise<PitchBlock>;
  cancelPitchBlock(pitchId: string, blockId: string): Promise<void>;
  getAvailableSlots(pitchId: string, query: AvailableSlotQuery): Promise<AvailableSlot[]>;

  // Matchmaking
  createAvailability(input: CreateTeamAvailabilityInput): Promise<TeamAvailability>;
  getMyAvailability(): Promise<TeamAvailability[]>;
  getAvailability(id: string): Promise<TeamAvailability>;
  updateAvailability(
    id: string,
    input: UpdateTeamAvailabilityInput,
  ): Promise<TeamAvailability>;
  cancelAvailability(id: string): Promise<TeamAvailability>;
  getRecommendations(
    availabilityId: string,
    query?: PaginationQuery,
  ): Promise<PaginatedRecommendations>;

  // Match Challenges (Milestone 07)
  createChallenge(
    input: CreateMatchChallengeInput,
    idempotencyKey?: string,
  ): Promise<MatchChallengeDetail>;
  getChallengeInbox(
    query?: MatchChallengesQuery,
  ): Promise<PaginatedMatchChallenges>;
  getInboxChallenges(
    query?: MatchChallengesQuery,
  ): Promise<PaginatedMatchChallenges>;
  getChallengeOutbox(
    query?: MatchChallengesQuery,
  ): Promise<PaginatedMatchChallenges>;
  getOutboxChallenges(
    query?: MatchChallengesQuery,
  ): Promise<PaginatedMatchChallenges>;
  getChallenge(id: string): Promise<MatchChallengeDetail>;
  acceptChallenge(
    id: string,
    idempotencyKey?: string,
  ): Promise<MatchChallengeDetail>;
  declineChallenge(
    id: string,
    idempotencyKey?: string,
  ): Promise<MatchChallengeDetail>;
  cancelChallenge(
    id: string,
    idempotencyKey?: string,
  ): Promise<MatchChallengeDetail>;

  // Bookings (Milestone 08)
  createBooking(
    input: CreateBookingInput,
    idempotencyKey: string,
  ): Promise<BookingDto>;
  getMyBookings(
    query?: ListBookingsQuery,
  ): Promise<PaginatedBookings>;
  getOwnerBookings(
    query?: ListBookingsQuery,
  ): Promise<PaginatedBookings>;
  getBooking(id: string): Promise<BookingDetailDto>;
  confirmBooking(
    id: string,
    idempotencyKey: string,
    input?: ConfirmBookingInput,
  ): Promise<BookingDto>;
  declineBooking(
    id: string,
    idempotencyKey: string,
    input?: DeclineBookingInput,
  ): Promise<BookingDto>;
  cancelBooking(
    id: string,
    input?: CancelBookingInput,
    idempotencyKey?: string,
  ): Promise<BookingDto>;
  listBookings(
    query?: ListBookingsQuery,
  ): Promise<PaginatedBookings>;
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
  const put = <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: json(data) });

  return {
    request,
    get: <T>(path: string) => request<T>(path),
    post,
    put,
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
      put<TeamLineup>(`/api/v1/teams/${teamId}/lineups/${format}`, input),
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
      if (query?.maxPriceMinor !== undefined)
        params.set("maxPriceMinor", String(query.maxPriceMinor));
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
    getPitchAvailabilityRules: (pitchId) =>
      request<PitchAvailabilityRule[]>(`/api/v1/pitches/${pitchId}/availability-rules`),
    setPitchAvailabilityRules: (pitchId, input) =>
      put<PitchAvailabilityRule[]>(`/api/v1/pitches/${pitchId}/availability-rules`, input),
    createPitchBlock: (pitchId, input) =>
      post<PitchBlock>(`/api/v1/pitches/${pitchId}/blocks`, input),
    cancelPitchBlock: async (pitchId, blockId) => {
      await request<void>(`/api/v1/pitches/${pitchId}/blocks/${blockId}`, {
        method: "DELETE",
      });
    },
    getAvailableSlots: (pitchId, query) => {
      const params = new URLSearchParams();
      params.set("from", query.from);
      params.set("to", query.to);
      if (query.durationMinutes !== undefined) {
        params.set("durationMinutes", String(query.durationMinutes));
      }
      return request<AvailableSlot[]>(
        `/api/v1/pitches/${pitchId}/available-slots?${params.toString()}`,
      );
    },
    // Matchmaking
    createAvailability: (input) =>
      post<TeamAvailability>("/api/v1/matchmaking/availability", input),
    getMyAvailability: () =>
      request<TeamAvailability[]>("/api/v1/matchmaking/availability/mine"),
    getAvailability: (id) =>
      request<TeamAvailability>(`/api/v1/matchmaking/availability/${id}`),
    updateAvailability: (id, input) =>
      request<TeamAvailability>(`/api/v1/matchmaking/availability/${id}`, {
        method: "PATCH",
        body: json(input),
      }),
    cancelAvailability: (id) =>
      request<TeamAvailability>(`/api/v1/matchmaking/availability/${id}`, {
        method: "DELETE",
      }),
    getRecommendations: (availabilityId, query) => {
      const params = new URLSearchParams();
      if (query?.page !== undefined) params.set("page", String(query.page));
      if (query?.pageSize !== undefined) params.set("pageSize", String(query.pageSize));
      const qs = params.toString();
      return request<PaginatedRecommendations>(
        `/api/v1/matchmaking/availability/${availabilityId}/recommendations${qs ? `?${qs}` : ""}`,
      );
    },
    // Match Challenges (Milestone 07)
    createChallenge: (input, idempotencyKey) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
      return request<MatchChallengeDetail>("/api/v1/matchmaking/challenges", {
        method: "POST",
        headers,
        body: json(input),
      });
    },
    getChallengeInbox: (query) => {
      const params = new URLSearchParams();
      if (query?.page !== undefined) params.set("page", String(query.page));
      if (query?.pageSize !== undefined)
        params.set("pageSize", String(query.pageSize));
      if (query?.teamId) params.set("teamId", query.teamId);
      if (query?.status) params.set("status", query.status);
      const qs = params.toString();
      return request<PaginatedMatchChallenges>(
        `/api/v1/matchmaking/challenges/inbox${qs ? `?${qs}` : ""}`,
      );
    },
    getInboxChallenges: (query) => {
      const params = new URLSearchParams();
      if (query?.page !== undefined) params.set("page", String(query.page));
      if (query?.pageSize !== undefined)
        params.set("pageSize", String(query.pageSize));
      if (query?.teamId) params.set("teamId", query.teamId);
      if (query?.status) params.set("status", query.status);
      const qs = params.toString();
      return request<PaginatedMatchChallenges>(
        `/api/v1/matchmaking/challenges/inbox${qs ? `?${qs}` : ""}`,
      );
    },
    getChallengeOutbox: (query) => {
      const params = new URLSearchParams();
      if (query?.page !== undefined) params.set("page", String(query.page));
      if (query?.pageSize !== undefined)
        params.set("pageSize", String(query.pageSize));
      if (query?.teamId) params.set("teamId", query.teamId);
      if (query?.status) params.set("status", query.status);
      const qs = params.toString();
      return request<PaginatedMatchChallenges>(
        `/api/v1/matchmaking/challenges/outbox${qs ? `?${qs}` : ""}`,
      );
    },
    getOutboxChallenges: (query) => {
      const params = new URLSearchParams();
      if (query?.page !== undefined) params.set("page", String(query.page));
      if (query?.pageSize !== undefined)
        params.set("pageSize", String(query.pageSize));
      if (query?.teamId) params.set("teamId", query.teamId);
      if (query?.status) params.set("status", query.status);
      const qs = params.toString();
      return request<PaginatedMatchChallenges>(
        `/api/v1/matchmaking/challenges/outbox${qs ? `?${qs}` : ""}`,
      );
    },
    getChallenge: (id) =>
      request<MatchChallengeDetail>(`/api/v1/matchmaking/challenges/${id}`),
    acceptChallenge: (id, idempotencyKey) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
      return request<MatchChallengeDetail>(
        `/api/v1/matchmaking/challenges/${id}/accept`,
        { method: "POST", headers },
      );
    },
    declineChallenge: (id, idempotencyKey) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
      return request<MatchChallengeDetail>(
        `/api/v1/matchmaking/challenges/${id}/decline`,
        { method: "POST", headers },
      );
    },
    cancelChallenge: (id, idempotencyKey) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
      return request<MatchChallengeDetail>(
        `/api/v1/matchmaking/challenges/${id}/cancel`,
        { method: "POST", headers },
      );
    },
    // Bookings (Milestone 08)
    createBooking: (input, idempotencyKey) =>
      request<BookingDto>("/api/v1/bookings", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: json(input),
      }),
    getMyBookings: (query) => {
      const params = new URLSearchParams();
      if (query?.page !== undefined) params.set("page", String(query.page));
      if (query?.pageSize !== undefined) params.set("pageSize", String(query.pageSize));
      if (query?.limit !== undefined) params.set("limit", String(query.limit));
      if (query?.status) params.set("status", query.status);
      if (query?.pitchId) params.set("pitchId", query.pitchId);
      if (query?.challengeId) params.set("challengeId", query.challengeId);
      if (query?.teamId) params.set("teamId", query.teamId);
      const qs = params.toString();
      return request<PaginatedBookings>(`/api/v1/bookings/mine${qs ? `?${qs}` : ""}`);
    },
    getOwnerBookings: (query) => {
      const params = new URLSearchParams();
      if (query?.page !== undefined) params.set("page", String(query.page));
      if (query?.pageSize !== undefined) params.set("pageSize", String(query.pageSize));
      if (query?.limit !== undefined) params.set("limit", String(query.limit));
      if (query?.status) params.set("status", query.status);
      if (query?.pitchId) params.set("pitchId", query.pitchId);
      if (query?.challengeId) params.set("challengeId", query.challengeId);
      if (query?.teamId) params.set("teamId", query.teamId);
      const qs = params.toString();
      return request<PaginatedBookings>(`/api/v1/bookings/owner${qs ? `?${qs}` : ""}`);
    },
    getBooking: (id) =>
      request<BookingDetailDto>(`/api/v1/bookings/${id}`),
    confirmBooking: (id, idempotencyKey, input) =>
      request<BookingDto>(`/api/v1/bookings/${id}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: json(input ?? {}),
      }),
    declineBooking: (id, idempotencyKey, input) =>
      request<BookingDto>(`/api/v1/bookings/${id}/decline`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: json(input ?? {}),
      }),
    cancelBooking: (id, input, idempotencyKey) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
      return request<BookingDto>(`/api/v1/bookings/${id}/cancel`, {
        method: "POST",
        headers,
        body: json(input ?? {}),
      });
    },
    listBookings: (query) => {
      const params = new URLSearchParams();
      if (query?.page !== undefined) params.set("page", String(query.page));
      if (query?.pageSize !== undefined) params.set("pageSize", String(query.pageSize));
      if (query?.limit !== undefined) params.set("limit", String(query.limit));
      if (query?.role) params.set("role", query.role);
      if (query?.status) params.set("status", query.status);
      if (query?.pitchId) params.set("pitchId", query.pitchId);
      if (query?.challengeId) params.set("challengeId", query.challengeId);
      if (query?.teamId) params.set("teamId", query.teamId);
      const qs = params.toString();
      return request<PaginatedBookings>(`/api/v1/bookings${qs ? `?${qs}` : ""}`);
    },
  };
}
