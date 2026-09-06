import { ApiError } from "@/contracts/errors";
import { requireProviderParam, route } from "@/server/http";
import { reportError } from "@/server/observability/errors";
import {
  razorpayPaymentProvider,
  razorpayWebhookConfigured,
  verifyRefundWebhook,
} from "@/server/payments/razorpay-provider";
import { reconcileRefundEvent } from "@/server/services/admin-refund-online";
import { settleVerifiedPayment } from "@/server/services/payment-settlement";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  return route(async () => {
    const provider = requireProviderParam((await context.params).provider);
    if (provider !== "razorpay" || !razorpayWebhookConfigured()) {
      throw new ApiError(404, "PAYMENT_PROVIDER_NOT_CONFIGURED", `Payment provider ${provider} is not configured.`);
    }
    const rawBody = new Uint8Array(await request.arrayBuffer());
    let event;
    try {
      event = await razorpayPaymentProvider.verifyWebhook({ rawBody, headers: request.headers });
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "WEBHOOK_EVENT_IGNORED") throw error;
      return reconcileRefund(rawBody, request.headers);
    }
    const result = await settleVerifiedPayment(event);
    if (result.status === "paid_unallocated") {
      reportError({
        kind: "payment.paid_unallocated",
        message: "Razorpay webhook payment arrived after the room hold expired",
        context: { providerName: "razorpay" },
      });
    }
    return { received: true, status: result.status };
  });
}

/** Second pass: async refund updates (`refund.processed` / `refund.failed`). */
async function reconcileRefund(rawBody: Uint8Array, headers: Headers) {
  let refund;
  try {
    refund = verifyRefundWebhook({ rawBody, headers });
  } catch (error) {
    if (error instanceof ApiError && error.code === "WEBHOOK_EVENT_IGNORED") {
      return { received: true, ignored: true };
    }
    throw error;
  }
  const outcome = await reconcileRefundEvent({ refundId: refund.refundId, status: refund.status });
  return { received: true, status: outcome.handled ? (outcome.status ?? "reconciled") : "ignored" };
}
