import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./index";

describe("ApiClient - Bookings methods", () => {
  const dummyBooking = {
    id: "99999999-9999-4999-8999-999999999999",
    pitchId: "11111111-1111-4111-8111-111111111111",
    challengeId: "22222222-2222-4222-8222-222222222222",
    organizerUserId: "33333333-3333-4333-8333-333333333333",
    challengerTeamId: "44444444-4444-4444-8444-444444444444",
    opponentTeamId: "55555555-5555-4555-8555-555555555555",
    startAt: "2026-10-15T18:00:00.000Z",
    endAt: "2026-10-15T19:30:00.000Z",
    priceAmountMinor: 500000,
    currency: "DZD",
    status: "PENDING_OWNER_CONFIRMATION",
    paymentStatus: "UNPAID",
    ownerResponseDeadline: "2026-10-15T16:00:00.000Z",
    confirmedAt: null,
    declinedAt: null,
    cancelledAt: null,
    expiresAt: null,
    createdAt: "2026-10-14T10:00:00.000Z",
    updatedAt: "2026-10-14T10:00:00.000Z",
  };

  it("createBooking sends POST with Idempotency-Key and body", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return {
        ok: true,
        text: async () => JSON.stringify(dummyBooking),
      } as Response;
    });

    const client = createApiClient({
      baseUrl: "https://api.test",
      getToken: () => "test-token",
    });

    const res = await client.createBooking(
      {
        challengeId: dummyBooking.challengeId,
        pitchId: dummyBooking.pitchId,
        startAt: dummyBooking.startAt,
        endAt: dummyBooking.endAt,
      },
      "idem-key-123",
    );

    expect(capturedUrl).toBe("https://api.test/api/v1/bookings");
    expect(capturedInit?.method).toBe("POST");
    const headers = capturedInit?.headers as Headers;
    expect(headers.get("Idempotency-Key")).toBe("idem-key-123");
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(res.id).toBe(dummyBooking.id);
  });

  it("getMyBookings sends GET with query parameters", async () => {
    let capturedUrl = "";

    global.fetch = vi.fn().mockImplementation(async (url) => {
      capturedUrl = String(url);
      return {
        ok: true,
        text: async () => JSON.stringify({ items: [], page: 1, pageSize: 5, total: 0 }),
      } as Response;
    });

    const client = createApiClient({ baseUrl: "https://api.test" });
    await client.getMyBookings({ page: 2, pageSize: 5, status: "CONFIRMED" });

    expect(capturedUrl).toContain("/api/v1/bookings/mine?page=2&pageSize=5&status=CONFIRMED");
  });

  it("getOwnerBookings sends GET with query parameters", async () => {
    let capturedUrl = "";

    global.fetch = vi.fn().mockImplementation(async (url) => {
      capturedUrl = String(url);
      return {
        ok: true,
        text: async () => JSON.stringify({ items: [], page: 1, pageSize: 10, total: 0 }),
      } as Response;
    });

    const client = createApiClient({ baseUrl: "https://api.test" });
    await client.getOwnerBookings({ page: 1, pageSize: 10 });

    expect(capturedUrl).toContain("/api/v1/bookings/owner?page=1&pageSize=10");
  });

  it("getBooking sends GET with ID", async () => {
    let capturedUrl = "";

    global.fetch = vi.fn().mockImplementation(async (url) => {
      capturedUrl = String(url);
      return {
        ok: true,
        text: async () => JSON.stringify({ ...dummyBooking, pitch: { name: "Pitch 1" } }),
      } as Response;
    });

    const client = createApiClient({ baseUrl: "https://api.test" });
    await client.getBooking("test-id-123");

    expect(capturedUrl).toBe("https://api.test/api/v1/bookings/test-id-123");
  });

  it("confirmBooking sends POST with Idempotency-Key", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return {
        ok: true,
        text: async () => JSON.stringify({ ...dummyBooking, status: "CONFIRMED" }),
      } as Response;
    });

    const client = createApiClient({ baseUrl: "https://api.test" });
    await client.confirmBooking("b-123", "conf-key", { reason: "Confirmed" });

    expect(capturedUrl).toBe("https://api.test/api/v1/bookings/b-123/confirm");
    expect(capturedInit?.method).toBe("POST");
    const headers = capturedInit?.headers as Headers;
    expect(headers.get("Idempotency-Key")).toBe("conf-key");
  });

  it("declineBooking sends POST with Idempotency-Key", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return {
        ok: true,
        text: async () => JSON.stringify({ ...dummyBooking, status: "DECLINED" }),
      } as Response;
    });

    const client = createApiClient({ baseUrl: "https://api.test" });
    await client.declineBooking("b-123", "dec-key", { reason: "Slot unavailable" });

    expect(capturedUrl).toBe("https://api.test/api/v1/bookings/b-123/decline");
    expect(capturedInit?.method).toBe("POST");
    const headers = capturedInit?.headers as Headers;
    expect(headers.get("Idempotency-Key")).toBe("dec-key");
  });

  it("cancelBooking sends POST with reason and optional key", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return {
        ok: true,
        text: async () => JSON.stringify({ ...dummyBooking, status: "CANCELLED_BY_TEAM" }),
      } as Response;
    });

    const client = createApiClient({ baseUrl: "https://api.test" });
    await client.cancelBooking("b-123", { reason: "Emergency" }, "cancel-key");

    expect(capturedUrl).toBe("https://api.test/api/v1/bookings/b-123/cancel");
    expect(capturedInit?.method).toBe("POST");
    const headers = capturedInit?.headers as Headers;
    expect(headers.get("Idempotency-Key")).toBe("cancel-key");
  });
});
