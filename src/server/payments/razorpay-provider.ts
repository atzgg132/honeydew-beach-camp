import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { ApiError } from "@/contracts/errors";
import { reportError } from "@/server/observability/errors";
import type { PaymentProvider, ProviderOrder, VerifiedPaymentEvent } from "@/server/payments/provider";

const PROVIDER = "razorpay";
const MIN_AMOUNT_PAISE = 100;

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function razorpayKeyId(): string | undefined {
  return readEnv("RAZORPAY_KEY_ID", "PAYMENT_PROVIDER_KEY_ID", "NEXT_PUBLIC_RAZORPAY_KEY_ID");
}

function razorpayKeySecret(): string | undefined {
  return readEnv("RAZORPAY_KEY_SECRET", "PAYMENT_PROVIDER_KEY_SECRET");
}

function razorpayWebhookSecret(): string | undefined {
  return readEnv("RAZORPAY_WEBHOOK_SECRET", "PAYMENT_WEBHOOK_SECRET");
}

export function razorpayConfigured(): boolean {
  return Boolean(razorpayKeyId() && razorpayKeySecret());
}

export function razorpayWebhookConfigured(): boolean {
  return razorpayConfigured() && Boolean(razorpayWebhookSecret());
}

export function requireRazorpayKeys() {
  const keyId = razorpayKeyId();
  const keySecret = razorpayKeySecret();
  if (!keyId || !keySecret) {
    throw new ApiError(503, "PAYMENT_PROVIDER_UNAVAILABLE", "Online payment is not available yet.");
  }
  return { keyId, keySecret };
}

function razorpayClient() {
  const { keyId, keySecret } = requireRazorpayKeys();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export function signaturesMatch(expected: string, actual: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(actual);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function razorpayCheckoutSignature(orderId: string, paymentId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

export function verifyRazorpayCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = razorpayKeySecret();
  if (!secret) return false;
  const expected = razorpayCheckoutSignature(input.orderId, input.paymentId, secret);
  return signaturesMatch(expected, input.signature);
}

function mapRazorpayError(error: unknown, fallback: string): never {
  const statusCode =
    typeof error === "object" && error && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode)
      : undefined;
  if (statusCode === 401) {
    throw new ApiError(401, "PAYMENT_PROVIDER_AUTH_FAILED", "Razorpay authentication failed.");
  }
  reportError({
    kind: "api.unhandled",
    message: fallback,
    error,
    context: { providerName: PROVIDER, statusCode },
  });
  throw new ApiError(500, "PAYMENT_PROVIDER_ERROR", fallback);
}

export const razorpayPaymentProvider: PaymentProvider = {
  async createOrder(input): Promise<ProviderOrder> {
    if (input.amountPaise < MIN_AMOUNT_PAISE) {
      throw new ApiError(400, "VALIDATION_ERROR", "The payment amount is below the minimum.", {
        amount: ["Minimum amount is 100 paise."],
      });
    }
    const keyId = razorpayKeyId();
    if (!keyId) {
      throw new ApiError(503, "PAYMENT_PROVIDER_UNAVAILABLE", "Online payment is not available yet.");
    }

    const receipt = `hd${input.metadata.bookingId.replaceAll("-", "")}`.slice(0, 40);
    let order: { id: string; amount: number | string; currency: string };
    try {
      order = await razorpayClient().orders.create({
        amount: input.amountPaise,
        currency: input.currency,
        receipt,
        notes: { bookingId: input.metadata.bookingId },
      });
    } catch (error) {
      mapRazorpayError(error, "Could not create the payment order.");
    }

    const amountPaise = typeof order.amount === "string" ? Number(order.amount) : order.amount;
    if (!order.id || !Number.isInteger(amountPaise) || amountPaise < MIN_AMOUNT_PAISE) {
      throw new ApiError(500, "PAYMENT_PROVIDER_ERROR", "Could not create the payment order.");
    }

    return {
      provider: PROVIDER,
      providerOrderId: order.id,
      amountPaise,
      currency: "INR",
      expiresAt: input.expiresAt,
      clientData: {
        keyId,
        providerOrderId: order.id,
      },
    };
  },

  async verifyWebhook(input): Promise<VerifiedPaymentEvent> {
    const secret = razorpayWebhookSecret();
    if (!secret) {
      throw new ApiError(404, "PAYMENT_PROVIDER_NOT_CONFIGURED", "Payment provider razorpay is not configured.");
    }
    const signature = input.headers.get("x-razorpay-signature")?.trim();
    if (!signature) {
      throw new ApiError(400, "WEBHOOK_SIGNATURE_INVALID", "The webhook signature is missing.");
    }
    const raw = Buffer.from(input.rawBody).toString("utf8");
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    if (!signaturesMatch(expected, signature)) {
      reportError({
        kind: "payment.webhook_unverified",
        message: "Razorpay webhook signature mismatch",
        context: { providerName: PROVIDER },
      });
      throw new ApiError(400, "WEBHOOK_SIGNATURE_INVALID", "The webhook signature is invalid.");
    }

    let body: RazorpayWebhookBody;
    try {
      body = JSON.parse(raw) as RazorpayWebhookBody;
    } catch {
      throw new ApiError(400, "VALIDATION_ERROR", "The webhook body must be valid JSON.");
    }

    const payment = body.payload?.payment?.entity;
    const eventType = body.event ?? "";
    if (!payment?.id || !payment.order_id || (eventType !== "payment.captured" && eventType !== "order.paid")) {
      throw new ApiError(400, "WEBHOOK_EVENT_IGNORED", "This webhook event is not a captured payment.");
    }
    if (payment.currency !== "INR") {
      throw new ApiError(409, "PAYMENT_AMOUNT_MISMATCH", "The payment currency is not INR.");
    }
    const amountPaise = typeof payment.amount === "string" ? Number(payment.amount) : payment.amount;
    if (typeof amountPaise !== "number" || !Number.isInteger(amountPaise)) {
      throw new ApiError(409, "PAYMENT_AMOUNT_MISMATCH", "The payment amount does not match the order.");
    }

    return {
      provider: PROVIDER,
      providerEventId: payment.id,
      eventType,
      providerOrderId: payment.order_id,
      providerPaymentId: payment.id,
      amountPaise,
      currency: "INR",
      paidAt: payment.created_at ? new Date(payment.created_at * 1000) : new Date(),
    };
  },
};

export async function fetchRazorpayPayment(paymentId: string): Promise<{
  id: string;
  orderId: string;
  amountPaise: number;
  currency: "INR";
  status: string;
  captured: boolean;
  paidAt: Date;
}> {
  let payment: {
    id: string;
    order_id: string;
    amount: number | string;
    currency: string;
    status: string;
    captured?: boolean;
    created_at?: number;
  };
  try {
    payment = await razorpayClient().payments.fetch(paymentId);
  } catch (error) {
    mapRazorpayError(error, "Could not confirm the payment with Razorpay.");
  }
  const amountPaise = typeof payment.amount === "string" ? Number(payment.amount) : payment.amount;
  if (!payment.id || !payment.order_id || typeof amountPaise !== "number" || !Number.isInteger(amountPaise)) {
    throw new ApiError(500, "PAYMENT_PROVIDER_ERROR", "Could not confirm the payment with Razorpay.");
  }
  if (payment.currency !== "INR") {
    throw new ApiError(409, "PAYMENT_AMOUNT_MISMATCH", "The payment currency is not INR.");
  }
  return {
    id: payment.id,
    orderId: payment.order_id,
    amountPaise,
    currency: "INR",
    status: payment.status,
    captured: payment.captured === true || payment.status === "captured",
    paidAt: payment.created_at ? new Date(payment.created_at * 1000) : new Date(),
  };
}

interface RazorpayWebhookBody {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number | string;
        currency?: string;
        created_at?: number;
      };
    };
  };
}
