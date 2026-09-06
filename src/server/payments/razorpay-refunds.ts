import "server-only";
import { ApiError } from "@/contracts/errors";
import { db } from "@/server/db/client";
import { requireRazorpayKeys } from "@/server/payments/razorpay-provider";
import Razorpay from "razorpay";

export type RazorpayRefundStatus = "pending" | "processed" | "failed";

export interface RazorpayRefundResult {
  id: string;
  status: RazorpayRefundStatus;
}

/**
 * The receipt ties a Razorpay refund back to our cancellation, so a retry
 * after a lost response reuses the existing refund instead of paying twice.
 */
export function buildRefundRequest(input: {
  amountPaise: number;
  receipt: string;
  bookingId: string;
  cancellationId: string;
}): { amount: number; speed: "normal"; receipt: string; notes: Record<string, string> } {
  return {
    amount: input.amountPaise,
    speed: "normal",
    receipt: input.receipt,
    notes: { bookingId: input.bookingId, cancellationId: input.cancellationId },
  };
}

/** Razorpay refund state → our cancellation state. Exported for tests. */
export function mapRefundStatus(status: string): "PROCESSED" | "PROCESSING" | "FAILED" {
  if (status === "processed") return "PROCESSED";
  if (status === "failed") return "FAILED";
  return "PROCESSING";
}

/** Translate SDK failures into API errors the desk can act on. Exported for tests. */
export function normalizeRazorpayError(error: unknown): ApiError {
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: unknown }).statusCode)
      : undefined;
  const description =
    typeof error === "object" && error !== null && "error" in error
      ? String((error as { error?: { description?: unknown } }).error?.description ?? "")
      : "";
  if (statusCode === 401) {
    return new ApiError(503, "PAYMENT_PROVIDER_UNAVAILABLE", "Razorpay rejected the API keys. Check the credentials.");
  }
  if (statusCode === 400 && description) {
    return new ApiError(400, "REFUND_REJECTED", `Razorpay refused the refund: ${description.slice(0, 200)}`);
  }
  return new ApiError(502, "REFUND_PROVIDER_ERROR", "Razorpay did not complete the refund. Try again.");
}

export interface CapturedPayment {
  providerPaymentId: string;
  amountPaise: number;
  capturedTotalPaise: number;
}

/** Latest captured Razorpay payment for a booking, plus the captured total. */
export async function findLatestCapturedPayment(bookingId: string): Promise<CapturedPayment | null> {
  const rows = await db().paymentTransaction.findMany({
    where: { provider: "razorpay", status: "SUCCEEDED", paymentOrder: { bookingId } },
    orderBy: { createdAt: "desc" },
  });
  if (rows.length === 0) return null;
  return {
    providerPaymentId: rows[0].providerPaymentId,
    amountPaise: rows[0].amountPaise,
    capturedTotalPaise: rows.reduce((sum, row) => sum + row.amountPaise, 0),
  };
}

export async function createRazorpayRefund(input: {
  paymentId: string;
  amountPaise: number;
  receipt: string;
  bookingId: string;
  cancellationId: string;
}): Promise<RazorpayRefundResult> {
  const { keyId, keySecret } = requireRazorpayKeys();
  const client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  let refund: { id?: unknown; status?: unknown };
  try {
    refund = (await client.payments.refund(
      input.paymentId,
      buildRefundRequest({ amountPaise: input.amountPaise, receipt: input.receipt, bookingId: input.bookingId, cancellationId: input.cancellationId }),
    )) as { id?: unknown; status?: unknown };
  } catch (error) {
    throw normalizeRazorpayError(error);
  }
  if (typeof refund.id !== "string" || !refund.id) {
    throw new ApiError(502, "REFUND_PROVIDER_ERROR", "Razorpay returned no refund id.");
  }
  return { id: refund.id, status: refund.status === "processed" || refund.status === "failed" ? refund.status : "pending" };
}

/**
 * Idempotency guard: if a refund with our receipt already exists on this
 * payment (e.g. the first attempt succeeded but the response was lost),
 * reuse it instead of creating a second refund.
 */
export async function findExistingRefundByReceipt(
  paymentId: string,
  receipt: string,
): Promise<RazorpayRefundResult | null> {
  const { keyId, keySecret } = requireRazorpayKeys();
  const client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  let list: { items?: Array<{ id?: unknown; receipt?: unknown; status?: unknown }> };
  try {
    list = (await client.payments.fetchMultipleRefund(paymentId)) as {
      items?: Array<{ id?: unknown; receipt?: unknown; status?: unknown }>;
    };
  } catch {
    return null;
  }
  const match = list.items?.find((item) => item.receipt === receipt && typeof item.id === "string" && item.id);
  if (!match) return null;
  return {
    id: match.id as string,
    status: match.status === "processed" || match.status === "failed" ? match.status : "pending",
  };
}
