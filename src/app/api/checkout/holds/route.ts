import { NextRequest, NextResponse } from "next/server";
import { createHoldContract } from "@/contracts/booking";
import { setOpaqueSessionCookies } from "@/server/auth/cookies";
import { parseJson, requireIdempotencyKey, route } from "@/server/http";
import { consumeRateLimit } from "@/server/rate-limit";
import { requireOnlinePayments } from "@/server/payments/runtime";
import { createHold } from "@/server/services/checkout-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    requireOnlinePayments();
    const input = await parseJson(request, createHoldContract);
    await consumeRateLimit({ request, scope: "create-hold", discriminator: input.contact.phone, windowSeconds: 15 * 60, limit: 5 });
    const result = await createHold({ ...input, idempotencyKey: requireIdempotencyKey(request) });
    const response = NextResponse.json({ data: result.data });
    setOpaqueSessionCookies(response, "checkout", result.token, result.csrf, result.cookieExpiresAt);
    return response;
  });
}
