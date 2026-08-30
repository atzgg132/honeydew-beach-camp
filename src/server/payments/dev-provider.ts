import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/contracts/errors";
import type { PaymentProvider } from "@/server/payments/provider";

export function devPaymentsEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_PAYMENT === "true";
}

export function requireDevPayments() {
  if (!devPaymentsEnabled()) {
    throw new ApiError(503, "PAYMENT_PROVIDER_UNAVAILABLE", "Online payment is not available yet.");
  }
}

export const devPaymentProvider: PaymentProvider = {
  async createOrder(input) {
    requireDevPayments();
    const providerOrderId = `dev_order_${randomUUID()}`;
    return {
      provider: "dev",
      providerOrderId,
      amountPaise: input.amountPaise,
      currency: input.currency,
      expiresAt: input.expiresAt,
      clientData: { mode: "development", providerOrderId },
    };
  },
  async verifyWebhook() {
    throw new ApiError(404, "NOT_FOUND", "No development webhook exists.");
  },
};
