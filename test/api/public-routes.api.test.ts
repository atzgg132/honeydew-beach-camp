import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { addDays, todayIstDate } from "@/lib/dates";
import { db } from "@/server/db/client";

/**
 * Route-handler tests. These exercise the real handlers against a real database — the
 * layer between the HTTP contract and the services, which unit tests cannot reach and
 * browser tests only cover incidentally.
 *
 * The emphasis is on the boundaries that protect money and inventory: validation, the
 * authentication boundary, quote signing, and the guarantee that development-only
 * endpoints cannot exist in production.
 */

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

function post(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://127.0.0.1:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function readJson(response: Response) {
  return (await response.json()) as {
    data?: Record<string, unknown>;
    error?: { code?: string; message?: string; fields?: Record<string, string[]> };
  };
}

const stay = () => {
  const checkIn = addDays(todayIstDate(), 90);
  return { checkIn, checkOut: addDays(checkIn, 2) };
};

const oneAdult = { adults: 1, childrenUnder5: 0, children5to10: 0 };

describe.skipIf(!testDatabaseUrl)("public API routes", () => {
  beforeAll(async () => {
    const rooms = await db().room.count();
    if (rooms !== 7) {
      throw new Error("Apply migrations and seed TEST_DATABASE_URL before running API tests.");
    }
  });

  describe("POST /api/availability/search", () => {
    it("returns live inventory and priced arrangements", async () => {
      const { POST } = await import("@/app/api/availability/search/route");
      const { checkIn, checkOut } = stay();
      const response = await POST(post("/api/availability/search", { checkIn, checkOut, composition: oneAdult }));
      expect(response.status).toBe(200);

      const body = await readJson(response);
      // Seven physical rooms: four single-bed, three double-bed.
      expect(body.data?.availability).toEqual({ "single-bed": 4, "double-bed": 3 });
      expect(Array.isArray(body.data?.arrangements)).toBe(true);
      expect(body.data?.currency).toBe("INR");
    });

    it("rejects a stay that starts in the past", async () => {
      const { POST } = await import("@/app/api/availability/search/route");
      const yesterday = addDays(todayIstDate(), -1);
      const response = await POST(
        post("/api/availability/search", { checkIn: yesterday, checkOut: todayIstDate(), composition: oneAdult }),
      );
      expect(response.status).toBe(400);
      expect((await readJson(response)).error?.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a malformed body without reaching the service", async () => {
      const { POST } = await import("@/app/api/availability/search/route");
      const response = await POST(post("/api/availability/search", { checkIn: "not-a-date" }));
      expect(response.status).toBe(400);
      expect((await readJson(response)).error?.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/quotes", () => {
    const quoteBody = () => {
      const { checkIn, checkOut } = stay();
      return {
        checkIn,
        checkOut,
        composition: oneAdult,
        rooms: [
          { clientId: "room-1", roomGroupId: "single-bed", acMode: "non-ac", composition: oneAdult },
        ],
      };
    };

    it("issues a signed quote carrying the tariff and policy revision", async () => {
      const { POST } = await import("@/app/api/quotes/route");
      const response = await POST(post("/api/quotes", quoteBody()));
      expect(response.status).toBe(200);

      const body = await readJson(response);
      const data = body.data as { quoteToken: string; price: { subtotalPaise: number; advancePaise: number } };
      // A lone guest in a single-bed room is billed on the one-guest Non-AC tariff:
      // 119900 paise a night, over two nights.
      expect(data.price.subtotalPaise).toBe(239_800);
      // Thirty percent advance, half-up rounding, in paise.
      expect(data.price.advancePaise).toBe(71_940);
      expect(data.quoteToken.split(".")).toHaveLength(2);
    });

    it("refuses a quote whose per-room guests do not add up to the booking total", async () => {
      const { POST } = await import("@/app/api/quotes/route");
      const body = quoteBody();
      body.composition = { adults: 3, childrenUnder5: 0, children5to10: 0 };
      const response = await POST(post("/api/quotes", body));
      expect(response.status).toBe(400);
      expect((await readJson(response)).error?.code).toBe("INVALID_ALLOCATION");
    });

    it("refuses more rooms of a group than the camp physically has", async () => {
      const { POST } = await import("@/app/api/quotes/route");
      const { checkIn, checkOut } = stay();
      const rooms = Array.from({ length: 5 }, (_, index) => ({
        clientId: `room-${index}`,
        roomGroupId: "single-bed" as const,
        acMode: "non-ac" as const,
        composition: oneAdult,
      }));
      const response = await POST(
        post("/api/quotes", {
          checkIn,
          checkOut,
          composition: { adults: 5, childrenUnder5: 0, children5to10: 0 },
          rooms,
        }),
      );
      // Only four single-bed rooms exist.
      expect(response.status).toBe(409);
      expect((await readJson(response)).error?.code).toBe("AVAILABILITY_CHANGED");
    });
  });

  describe("authentication boundary", () => {
    it("refuses Manage Booking without a session", async () => {
      const { GET } = await import("@/app/api/manage-booking/route");
      const request = new NextRequest("http://127.0.0.1:3000/api/manage-booking");
      const response = await GET(request);
      expect(response.status).toBe(401);
      expect((await readJson(response)).error?.code).toBe("MANAGE_SESSION_REQUIRED");
    });

    it("refuses a checkout status read without the checkout session", async () => {
      const { GET } = await import("@/app/api/checkout/holds/[holdId]/route");
      const holdId = "00000000-0000-4000-8000-000000000000";
      const request = new NextRequest(`http://127.0.0.1:3000/api/checkout/holds/${holdId}`);
      const response = await GET(request, { params: Promise.resolve({ holdId }) });
      expect(response.status).toBe(401);
      expect((await readJson(response)).error?.code).toBe("CHECKOUT_SESSION_REQUIRED");
    });

    it("refuses the hold-expiry job without the shared secret", async () => {
      const { POST } = await import("@/app/api/internal/holds/expire/route");
      const response = await POST(post("/api/internal/holds/expire"));
      expect(response.status).toBe(401);
      expect((await readJson(response)).error?.code).toBe("UNAUTHORIZED");
    });
  });

  describe("payments", () => {
    it("reports that no production payment provider is configured", async () => {
      const { POST } = await import("@/app/api/payments/webhook/[provider]/route");
      const response = await POST(post("/api/payments/webhook/cashfree"), {
        params: Promise.resolve({ provider: "cashfree" }),
      });
      expect(response.status).toBe(404);
      expect((await readJson(response)).error?.code).toBe("PAYMENT_PROVIDER_NOT_CONFIGURED");
    });

    it("rejects a provider name that is not a plain slug", async () => {
      const { POST } = await import("@/app/api/payments/webhook/[provider]/route");
      const response = await POST(post("/api/payments/webhook/x"), {
        params: Promise.resolve({ provider: "../../etc/passwd" }),
      });
      expect(response.status).toBe(400);
      expect((await readJson(response)).error?.code).toBe("VALIDATION_ERROR");
    });
  });
});
