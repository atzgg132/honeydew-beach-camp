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
    const orderId = requireUuidParam((await context.params).orderId, "orderId");

    // The session must be bound to the booking this order belongs to. Verifying only that
    // *some* valid checkout session exists would let any holder of one settle any other
    // guest's order. This endpoint is development-only and returns 404 in production, but
    // the shape must not be copied to the real webhook path, and the browser suite exercises
    // it on every run.
    const session = await requireCheckoutSession(request);
    return succeedDevPayment(orderId, session.bookingId);
  });
}
