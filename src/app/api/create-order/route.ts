import { NextRequest } from "next/server";
import { assertMutationSecurity } from "@/server/auth/cookies";
import { requireCheckoutSession } from "@/server/auth/checkout-session";
import { requireIdempotencyKey, route } from "@/server/http";
import { createPaymentOrder } from "@/server/services/payment-service";

export const runtime = "nodejs";

/**
 * Creates a Razorpay order for the current checkout hold.
 *
 * Amount comes from the booking, never from the client. The hold-scoped
 * `/api/checkout/holds/:holdId/payment-order` route is the same operation.
 */
export async function POST(request: NextRequest) {
  return route(async () => {
    assertMutationSecurity(request, "checkout");
    const session = await requireCheckoutSession(request);
    const order = await createPaymentOrder({
      bookingId: session.bookingId,
      idempotencyKey: requireIdempotencyKey(request),
    });
    return {
      order_id: order.clientData.providerOrderId ?? "",
      amount: order.amountPaise,
      currency: order.currency,
      key_id: order.clientData.keyId ?? "",
      orderId: order.orderId,
      provider: order.provider,
      expiresAt: order.expiresAt,
      clientData: order.clientData,
    };
  });
}
