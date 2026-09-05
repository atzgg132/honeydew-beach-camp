import { NextRequest } from "next/server";
import { assertMutationSecurity } from "@/server/auth/cookies";
import { requireCheckoutSession } from "@/server/auth/checkout-session";
import { requireIdempotencyKey, requireUuidParam, route } from "@/server/http";
import { createPaymentOrder } from "@/server/services/payment-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ holdId: string }> }) {
  return route(async () => {
    const holdId = requireUuidParam((await context.params).holdId, "holdId");
    assertMutationSecurity(request, "checkout");
    await requireCheckoutSession(request, holdId);
    return createPaymentOrder({ bookingId: holdId, idempotencyKey: requireIdempotencyKey(request) });
  });
}
