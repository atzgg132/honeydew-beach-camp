import "server-only";
import { ApiError } from "@/contracts/errors";
import { devPaymentProvider, devPaymentsEnabled } from "@/server/payments/dev-provider";
import type { PaymentProvider } from "@/server/payments/provider";
import { razorpayConfigured, razorpayPaymentProvider } from "@/server/payments/razorpay-provider";

export type CheckoutProviderName = "razorpay" | "dev";

/**
 * Which adapter checkout will use.
 *
 * `PAYMENT_PROVIDER=razorpay` always wins when the Razorpay keys are present. CI and the
 * browser suite set `PAYMENT_PROVIDER=dev` with `ENABLE_DEV_PAYMENT=true` so they keep the
 * local simulator. An unknown name (including leftover Cashfree) is treated as unconfigured.
 */
export function checkoutProviderName(): CheckoutProviderName | null {
  const named = (process.env.PAYMENT_PROVIDER ?? "").trim().toLowerCase();
  if (named === "razorpay") return razorpayConfigured() ? "razorpay" : null;
  if (named === "dev") return devPaymentsEnabled() ? "dev" : null;
  if (named) return null;
  if (razorpayConfigured()) return "razorpay";
  if (devPaymentsEnabled()) return "dev";
  return null;
}

export function onlinePaymentsEnabled(): boolean {
  return checkoutProviderName() !== null;
}

export function requireOnlinePayments() {
  if (!onlinePaymentsEnabled()) {
    throw new ApiError(503, "PAYMENT_PROVIDER_UNAVAILABLE", "Online payment is not available yet.");
  }
}

export function getCheckoutPaymentProvider(): PaymentProvider {
  const name = checkoutProviderName();
  if (name === "razorpay") return razorpayPaymentProvider;
  if (name === "dev") return devPaymentProvider;
  throw new ApiError(503, "PAYMENT_PROVIDER_UNAVAILABLE", "Online payment is not available yet.");
}
