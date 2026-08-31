import { describe, expect, it } from "vitest";
import { __testing } from "@/server/observability/logger";

const { sanitize, shouldRedact } = __testing;

/**
 * Log redaction is a privacy control, not a formatting preference. Logs are retained beyond
 * the request and readable by anyone with project access, so these assertions are the thing
 * standing between a guest's phone number and a log drain.
 */
describe("log redaction", () => {
  it("redacts every field that can identify a guest", () => {
    const output = sanitize({
      contactEmail: "guest@example.com",
      contactPhoneE164: "+919876543210",
      contactFullName: "A Guest",
      fullName: "A Guest",
      address: "Mousuni Island",
    }) as Record<string, unknown>;

    for (const value of Object.values(output)) {
      expect(value).toBe("[redacted]");
    }
    expect(JSON.stringify(output)).not.toContain("9876543210");
    expect(JSON.stringify(output)).not.toContain("guest@example.com");
  });

  it("redacts credentials and signatures", () => {
    const output = sanitize({
      authorization: "Bearer abcdef",
      cookie: "hd_manage=xyz",
      apiKey: "live_key",
      webhookSignature: "c2ln",
      password: "hunter2",
      token: "opaque",
    }) as Record<string, unknown>;

    for (const value of Object.values(output)) {
      expect(value).toBe("[redacted]");
    }
  });

  it("keeps the identifiers that make a log useful", () => {
    const output = sanitize({
      bookingId: "0f1e2d3c-4b5a-4000-8000-000000000000",
      requestId: "req-1",
      paymentOrderId: "order-1",
      amountPaise: 143_880,
      status: "CONFIRMED",
      roomNumber: "401",
    }) as Record<string, unknown>;

    expect(output.bookingId).toBe("0f1e2d3c-4b5a-4000-8000-000000000000");
    expect(output.amountPaise).toBe(143_880);
    expect(output.status).toBe("CONFIRMED");
    expect(output.roomNumber).toBe("401");
  });

  it("redacts nested guest data, not just top-level fields", () => {
    const output = sanitize({
      booking: { id: "b1", contact: { email: "guest@example.com" } },
    }) as { booking: Record<string, unknown> };

    expect(output.booking.id).toBe("b1");
    expect(output.booking.contact).toBe("[redacted]");
    expect(JSON.stringify(output)).not.toContain("guest@example.com");
  });

  it("does not redact keys that merely contain an allowed word", () => {
    expect(shouldRedact("roomGroupName")).toBe(false);
    expect(shouldRedact("providerName")).toBe(false);
    expect(shouldRedact("keyHash")).toBe(false);
    // ...but the bare forms still are.
    expect(shouldRedact("name")).toBe(true);
    expect(shouldRedact("key")).toBe(true);
  });

  it("reduces an Error to its name and message, never its stack", () => {
    const error = new Error("boom");
    const output = sanitize({ error }) as { error: Record<string, unknown> };
    expect(output.error).toEqual({ name: "Error", message: "boom" });
    expect(JSON.stringify(output)).not.toContain("at ");
  });

  it("bounds strings, arrays and depth so one log line cannot flood the drain", () => {
    const long = sanitize({ note: "x".repeat(2_000) }) as { note: string };
    expect(long.note.length).toBeLessThan(600);
    expect(long.note.endsWith("...")).toBe(true);

    const wide = sanitize({ items: Array.from({ length: 500 }, (_, i) => i) }) as { items: number[] };
    expect(wide.items).toHaveLength(50);

    let deep: Record<string, unknown> = { value: "bottom" };
    for (let i = 0; i < 12; i += 1) deep = { nested: deep };
    expect(JSON.stringify(sanitize(deep))).toContain("[truncated]");
  });
});
