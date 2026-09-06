import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";

/**
 * Contact route tests. Validation cases never reach the database (the contract
 * rejects before the rate limiter or the outbox), so they run everywhere. The
 * persistence cases need a disposable database and follow the same
 * `describe.skipIf(!TEST_DATABASE_URL)` convention as the other route suites.
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

const validEnquiry = (tag: string) => ({
  name: "Asha Guest",
  phone: "9876543210",
  email: `asha+${tag}@example.com`,
  message: "We are two adults arriving Friday. Is an early check-in possible?",
});

describe("POST /api/contact", () => {
  it("rejects an empty body without reaching the service", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const response = await POST(post("/api/contact", {}));
    expect(response.status).toBe(400);
    expect((await readJson(response)).error?.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an enquiry with no reply channel", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const response = await POST(
      post("/api/contact", { ...validEnquiry("none"), phone: "", email: "" }),
    );
    expect(response.status).toBe(400);
    expect((await readJson(response)).error?.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a too-short message", async () => {
    const { POST } = await import("@/app/api/contact/route");
    const response = await POST(post("/api/contact", { ...validEnquiry("short"), message: "Hi" }));
    expect(response.status).toBe(400);
    expect((await readJson(response)).error?.code).toBe("VALIDATION_ERROR");
  });

  describe.skipIf(!testDatabaseUrl)("against a disposable database", () => {
    it("persists a valid enquiry as a staff-visible outbox row", async () => {
      const tag = `ok-${Date.now()}`;
      const { POST } = await import("@/app/api/contact/route");
      const response = await POST(post("/api/contact", validEnquiry(tag)));
      expect(response.status).toBe(200);
      expect((await readJson(response)).data).toEqual({ received: true });

      const row = await db().notificationOutbox.findFirst({
        where: { template: "staff_contact_enquiry", toAddress: { contains: "@" } },
        orderBy: { createdAt: "desc" },
      });
      expect(row?.subject).toContain("Asha Guest");
      expect(row?.bodyText).toContain("Is an early check-in possible?");
      expect(row?.status).toBe("QUEUED");
    });

    it("rate-limits a burst from the same address", async () => {
      const tag = `burst-${Date.now()}`;
      const { POST } = await import("@/app/api/contact/route");
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await POST(post("/api/contact", validEnquiry(tag)));
        statuses.push(response.status);
      }
      expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
      expect(statuses[5]).toBe(429);
    });
  });
});
