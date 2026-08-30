import { beforeAll, describe, expect, it } from "vitest";
import { signPayload } from "@/server/crypto";
import { readQuoteToken } from "@/server/services/quote-service";

beforeAll(() => {
  process.env.APP_TOKEN_SECRET = "test-app-token-secret-at-least-thirty-two-characters";
});

function payload(expiresAt: number) {
  return {
    purpose: "booking-quote" as const,
    checkIn: "2026-12-10",
    checkOut: "2026-12-11",
    composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
    rooms: [{
      clientId: "room-1",
      roomGroupId: "single-bed" as const,
      acMode: "non-ac" as const,
      composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
    }],
    tariffRevisionId: "11111111-1111-4111-8111-111111111111",
    policyRevisionId: "22222222-2222-4222-8222-222222222222",
    subtotalPaise: 119_900,
    advancePaise: 35_970,
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt,
  };
}

describe("booking quote tokens", () => {
  it("round-trips a signed current quote", () => {
    const value = payload(Math.floor(Date.now() / 1000) + 60);
    expect(readQuoteToken(signPayload(value, "booking-quote"))).toEqual(value);
  });

  it("rejects a tampered signature", () => {
    const token = signPayload(payload(Math.floor(Date.now() / 1000) + 60), "booking-quote");
    const [body, signature] = token.split(".");
    const altered = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    expect(() => readQuoteToken(`${body}.${altered}`)).toThrowError(expect.objectContaining({ code: "INVALID_QUOTE" }));
  });

  it("rejects an expired quote", () => {
    const token = signPayload(payload(Math.floor(Date.now() / 1000) - 1), "booking-quote");
    expect(() => readQuoteToken(token)).toThrowError(expect.objectContaining({ code: "QUOTE_EXPIRED" }));
  });
});
