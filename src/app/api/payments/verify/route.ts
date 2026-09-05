import { NextRequest } from "next/server";
import { razorpayCheckoutResponseContract } from "@/contracts/checkout";
import { assertMutationSecurity } from "@/server/auth/cookies";
import { requireCheckoutSession } from "@/server/auth/checkout-session";
import { parseJson, route } from "@/server/http";
import { verifyRazorpayCheckoutPayment } from "@/server/services/payment-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    assertMutationSecurity(request, "checkout");
    const session = await requireCheckoutSession(request);
    const input = await parseJson(request, razorpayCheckoutResponseContract);
    return verifyRazorpayCheckoutPayment({ ...input, sessionBookingId: session.bookingId });
  });
}
