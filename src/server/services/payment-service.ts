import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { PaymentOrderDto } from "@/contracts/checkout";
import { ApiError } from "@/contracts/errors";
import { sha256 } from "@/server/crypto";
import { db } from "@/server/db/client";
import { requireDevPayments } from "@/server/payments/dev-provider";
import { reportError } from "@/server/observability/errors";
import { getCheckoutPaymentProvider } from "@/server/payments/runtime";
import {
  fetchRazorpayPayment,
  razorpayKeyId,
  verifyRazorpayCheckoutSignature,
} from "@/server/payments/razorpay-provider";
import { settleVerifiedPayment } from "@/server/services/payment-settlement";

const MIN_AMOUNT_PAISE = 100;

function orderClientData(provider: string, providerOrderId: string): Record<string, string> {
  if (provider === "razorpay") {
    const keyId = razorpayKeyId() ?? "";
    return { keyId, providerOrderId };
  }
  return { mode: "development", providerOrderId };
}

function toPaymentOrderDto(order: {
  id: string;
  provider: string;
  providerOrderId: string | null;
  amountPaise: number;
  currency: string;
  providerExpiresAt: Date | null;
}, fallbackExpiresAt: Date, clientData?: Record<string, string>): PaymentOrderDto {
  const providerOrderId = order.providerOrderId ?? "";
  return {
    orderId: order.id,
    provider: order.provider,
    amountPaise: order.amountPaise,
    currency: order.currency,
    expiresAt: (order.providerExpiresAt ?? fallbackExpiresAt).toISOString(),
    clientData: clientData ?? orderClientData(order.provider, providerOrderId),
  };
}

export async function createPaymentOrder(input: { bookingId: string; idempotencyKey: string }) {
  const provider = getCheckoutPaymentProvider();
  const prisma = db();
  const keyHash = sha256(input.idempotencyKey);
  const requestHash = sha256(input.bookingId);
  const scope = `payment-order:${input.bookingId}`;
  const replay = await prisma.idempotencyRequest.findUnique({ where: { scope_keyHash: { scope, keyHash } } });
  if (replay) {
    if (replay.requestHash !== requestHash || !replay.responseBody) {
      throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "That idempotency key was used for another request.");
    }
    return replay.responseBody as unknown as PaymentOrderDto;
  }
  const booking = await prisma.booking.findUnique({ where: { id: input.bookingId }, include: { payments: true } });
  if (!booking) throw new ApiError(404, "NOT_FOUND", "The checkout was not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new ApiError(409, "INVALID_STATE", "This checkout cannot accept payment.");
  if (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date()) throw new ApiError(409, "HOLD_EXPIRED", "The room hold has expired.");
  if (booking.advanceDuePaise < MIN_AMOUNT_PAISE) {
    throw new ApiError(400, "VALIDATION_ERROR", "The payment amount is below the minimum.", {
      amount: ["Minimum amount is 100 paise."],
    });
  }
  const existingOrder = booking.payments.find((order) => order.status === "PENDING" || order.status === "CREATED");
  if (existingOrder) {
    return toPaymentOrderDto(existingOrder, booking.holdExpiresAt);
  }
  const providerOrder = await provider.createOrder({
    idempotencyKey: input.idempotencyKey,
    amountPaise: booking.advanceDuePaise,
    currency: "INR",
    expiresAt: booking.holdExpiresAt,
    metadata: { bookingId: booking.id },
  });
  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${booking.id}::uuid FOR UPDATE`);
    const current = await transaction.booking.findUnique({ where: { id: booking.id }, include: { payments: true } });
    if (!current || current.status !== "PENDING_PAYMENT") throw new ApiError(409, "INVALID_STATE", "This checkout cannot accept payment.");
    if (!current.holdExpiresAt || current.holdExpiresAt <= new Date()) throw new ApiError(409, "HOLD_EXPIRED", "The room hold has expired.");
    const concurrentOrder = current.payments.find((order) => order.status === "PENDING" || order.status === "CREATED");
    const order = concurrentOrder ?? await transaction.paymentOrder.create({
      data: {
        bookingId: booking.id,
        provider: providerOrder.provider,
        providerOrderId: providerOrder.providerOrderId,
        status: "PENDING",
        amountPaise: providerOrder.amountPaise,
        currency: providerOrder.currency,
        providerExpiresAt: providerOrder.expiresAt,
      },
    });
    const responseBody = toPaymentOrderDto(
      order,
      current.holdExpiresAt,
      concurrentOrder ? undefined : providerOrder.clientData,
    );
    await transaction.idempotencyRequest.create({
      data: {
        scope,
        keyHash,
        requestHash,
        bookingId: booking.id,
        responseStatus: 200,
        responseBody: { ...responseBody },
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      },
    });
      return responseBody;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentReplay = await prisma.idempotencyRequest.findUnique({ where: { scope_keyHash: { scope, keyHash } } });
      if (concurrentReplay?.requestHash === requestHash && concurrentReplay.responseBody) {
        return concurrentReplay.responseBody as unknown as PaymentOrderDto;
      }
    }
    throw error;
  }
}

export async function succeedDevPayment(orderId: string, sessionBookingId: string) {
  requireDevPayments();
  const order = await db().paymentOrder.findUnique({
    where: { id: orderId },
    select: { id: true, bookingId: true, provider: true, providerOrderId: true, amountPaise: true, currency: true },
  });
  if (!order || !order.providerOrderId) {
    throw new ApiError(404, "NOT_FOUND", "The payment order was not found.");
  }
  // The caller's checkout session must own this order. Reported as not-found rather than
  // forbidden so the endpoint does not confirm that someone else's order id exists.
  if (order.bookingId !== sessionBookingId) {
    throw new ApiError(404, "NOT_FOUND", "The payment order was not found.");
  }

  // The simulator produces the same shape a real provider adapter produces after verifying a
  // webhook, and settlement is shared. There is deliberately no separate development
  // settlement path: the code that confirms a booking is the code that will run in
  // production.
  const result = await settleVerifiedPayment({
    provider: order.provider,
    providerEventId: `dev-success-${order.id}`,
    eventType: "payment.succeeded",
    providerOrderId: order.providerOrderId,
    providerPaymentId: `dev_payment_${randomUUID()}`,
    amountPaise: order.amountPaise,
    currency: order.currency as "INR",
    paidAt: new Date(),
  });

  if (result.status === "paid_unallocated") {
    throw new ApiError(409, "PAID_UNALLOCATED", "Payment arrived after the room hold expired. The hotel must review it.");
  }
  return { bookingId: result.bookingId, status: "confirmed" as const, reference: result.reference };
}

export async function verifyRazorpayCheckoutPayment(input: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  sessionBookingId: string;
}) {
  if (!verifyRazorpayCheckoutSignature({
    orderId: input.razorpay_order_id,
    paymentId: input.razorpay_payment_id,
    signature: input.razorpay_signature,
  })) {
    throw new ApiError(400, "PAYMENT_SIGNATURE_INVALID", "The payment signature is invalid.");
  }

  const order = await db().paymentOrder.findUnique({
    where: {
      provider_providerOrderId: { provider: "razorpay", providerOrderId: input.razorpay_order_id },
    },
    select: { id: true, bookingId: true, providerOrderId: true },
  });
  if (!order || order.bookingId !== input.sessionBookingId) {
    throw new ApiError(404, "NOT_FOUND", "The payment order was not found.");
  }

  const payment = await fetchRazorpayPayment(input.razorpay_payment_id);
  if (payment.orderId !== input.razorpay_order_id) {
    throw new ApiError(400, "PAYMENT_SIGNATURE_INVALID", "The payment does not belong to this order.");
  }
  if (!payment.captured) {
    throw new ApiError(409, "PAYMENT_NOT_CAPTURED", "The payment has not been captured yet.");
  }

  const result = await settleVerifiedPayment({
    provider: "razorpay",
    providerEventId: payment.id,
    eventType: "payment.captured",
    providerOrderId: payment.orderId,
    providerPaymentId: payment.id,
    amountPaise: payment.amountPaise,
    currency: payment.currency,
    paidAt: payment.paidAt,
  });

  if (result.status === "paid_unallocated") {
    reportError({
      kind: "payment.paid_unallocated",
      message: "Razorpay payment arrived after the room hold expired",
      context: { providerName: "razorpay" },
    });
    throw new ApiError(409, "PAID_UNALLOCATED", "Payment arrived after the room hold expired. The hotel must review it.");
  }
  return {
    bookingId: result.bookingId,
    status: "confirmed" as const,
    reference: result.reference,
  };
}
