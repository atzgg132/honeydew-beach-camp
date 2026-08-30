import { NextRequest } from "next/server";
import { assertMutationSecurity } from "@/server/auth/cookies";
import { requireCheckoutSession } from "@/server/auth/checkout-session";
import { requireUuidParam, route } from "@/server/http";
import { succeedDevPayment } from "@/server/services/payment-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ orderId: string }> }) {
  return route(async () => {
    if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
    assertMutationSecurity(request, "checkout");
    await requireCheckoutSession(request);
    const orderId = requireUuidParam((await context.params).orderId, "orderId");
    return succeedDevPayment(orderId);
  });
}
