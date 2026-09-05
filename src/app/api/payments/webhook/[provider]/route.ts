import { ApiError } from "@/contracts/errors";
import { requireProviderParam, route } from "@/server/http";
import { reportError } from "@/server/observability/errors";
import { razorpayPaymentProvider, razorpayWebhookConfigured } from "@/server/payments/razorpay-provider";
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
      if (error instanceof ApiError && error.code === "WEBHOOK_EVENT_IGNORED") {
        return { received: true, ignored: true };
      }
      throw error;
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
