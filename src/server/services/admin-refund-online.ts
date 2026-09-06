import "server-only";
import { ApiError } from "@/contracts/errors";
import type { AdminActor } from "@/server/auth/admin-session";
import { db } from "@/server/db/client";
import { staffBookingInclude, toStaffBooking } from "@/server/dto-admin";
import { reportError } from "@/server/observability/errors";
import {
  createRazorpayRefund,
  findExistingRefundByReceipt,
  findLatestCapturedPayment,
  mapRefundStatus,
} from "@/server/payments/razorpay-refunds";
import { consumeRefundOtp } from "@/server/refunds/refund-otp";

export interface OnlineRefundEligibility {
  bookingId: string;
  eligible: boolean;
  capturedPaise: number;
}

/**
 * Which bookings can be refunded automatically: the booking needs a captured
 * Razorpay payment. Batch-safe for the refunds queue page.
 */
export async function refundOnlineEligibility(bookingIds: string[]): Promise<OnlineRefundEligibility[]> {
  if (bookingIds.length === 0) return [];
  const rows = await db().paymentTransaction.findMany({
    where: { provider: "razorpay", status: "SUCCEEDED", paymentOrder: { bookingId: { in: bookingIds } } },
    select: { amountPaise: true, paymentOrder: { select: { bookingId: true } } },
  });
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.paymentOrder.bookingId, (totals.get(row.paymentOrder.bookingId) ?? 0) + row.amountPaise);
  }
  return bookingIds.map((bookingId) => {
    const capturedPaise = totals.get(bookingId) ?? 0;
    return { bookingId, eligible: capturedPaise > 0, capturedPaise };
  });
}

export interface ExecuteOnlineRefundInput {
  cancellationId: string;
  actor: AdminActor;
  challengeId: string;
  otp: string;
  actualRefundPaise: number;
}

/**
 * OTP-gated automated refund. The OTP is consumed and the cancellation claimed
 * (APPROVED → PROCESSING) in one transaction, so a code can never pay twice.
 * The Razorpay call happens outside the transaction; a lost response is safe
 * because re-execution finds the existing refund by receipt and reuses it.
 */
export async function executeOnlineRefund(input: ExecuteOnlineRefundInput) {
  if (!Number.isInteger(input.actualRefundPaise) || input.actualRefundPaise <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Enter a refund amount greater than zero.");
  }
  const claimed = await db().$transaction(async (tx) => {
    const cancellation = await tx.cancellation.findUnique({
      where: { id: input.cancellationId },
      include: { booking: true },
    });
    if (!cancellation) throw new ApiError(404, "NOT_FOUND", "The cancellation was not found.");
    if (cancellation.refundStatus !== "APPROVED") {
      throw new ApiError(409, "INVALID_STATE", "Only an approved refund can be paid online.");
    }
    if (input.actualRefundPaise > cancellation.refundablePaise) {
      throw new ApiError(400, "VALIDATION_ERROR", "The refund cannot exceed the refundable total.");
    }
    await consumeRefundOtp(tx, { cancellationId: cancellation.id, challengeId: input.challengeId, otp: input.otp });
    await tx.cancellation.update({
      where: { id: cancellation.id },
      data: { refundStatus: "PROCESSING", actualRefundPaise: input.actualRefundPaise },
    });
    return { bookingId: cancellation.bookingId, reference: cancellation.booking.reference ?? cancellation.booking.id };
  });

  const payment = await findLatestCapturedPayment(claimed.bookingId);
  if (!payment) {
    await revertToApproved(input.cancellationId, input.actor.id, "no captured online payment");
    throw new ApiError(409, "NO_ONLINE_PAYMENT", "No captured online payment found. Record the refund out of band.");
  }
  if (input.actualRefundPaise > payment.capturedTotalPaise) {
    await revertToApproved(input.cancellationId, input.actor.id, "amount exceeds captured total");
    throw new ApiError(400, "VALIDATION_ERROR", "The refund cannot exceed what was paid online.");
  }

  const receipt = input.cancellationId;
  const existing = await findExistingRefundByReceipt(payment.providerPaymentId, receipt);
  const refund = existing ??
    (await createRazorpayRefund({
      paymentId: payment.providerPaymentId,
      amountPaise: input.actualRefundPaise,
      receipt,
      bookingId: claimed.bookingId,
      cancellationId: input.cancellationId,
    }));
  const status = mapRefundStatus(refund.status);
  const now = new Date();

  if (status === "FAILED") {
    await revertToApproved(input.cancellationId, input.actor.id, `provider refund ${refund.id} failed`);
    throw new ApiError(409, "REFUND_REJECTED", "Razorpay reported the refund as failed. It is queued for review again.");
  }
  await db().$transaction(async (tx) => {
    await tx.cancellation.update({
      where: { id: input.cancellationId },
      data: {
        refundStatus: status,
        providerRefundReference: refund.id,
        ...(status === "PROCESSED" ? { processedAt: now } : {}),
      },
    });
    await tx.bookingEvent.create({
      data: {
        bookingId: claimed.bookingId,
        type: "REFUND_UPDATED",
        actorType: "ADMIN",
        actorId: input.actor.id,
        data: { action: "process_online", actualRefundPaise: input.actualRefundPaise, providerRefundId: refund.id, status },
      },
    });
  });
  return {
    booking: toStaffBooking(
      await db().booking.findUniqueOrThrow({ where: { id: claimed.bookingId }, include: staffBookingInclude }),
    ),
    refundId: refund.id,
    status,
  };
}

async function revertToApproved(cancellationId: string, actorId: string, reason: string): Promise<void> {
  await db().$transaction(async (tx) => {
    const cancellation = await tx.cancellation.findUnique({ where: { id: cancellationId } });
    if (!cancellation || cancellation.refundStatus !== "PROCESSING") return;
    await tx.cancellation.update({ where: { id: cancellationId }, data: { refundStatus: "APPROVED" } });
    await tx.bookingEvent.create({
      data: {
        bookingId: cancellation.bookingId,
        type: "REFUND_UPDATED",
        actorType: "ADMIN",
        actorId,
        data: { action: "process_online_reverted", reason },
      },
    });
  });
}

export interface RefundWebhookOutcome {
  handled: boolean;
  status?: string;
}

/**
 * Reconcile an async Razorpay refund event (`refund.processed` /
 * `refund.failed`) against the cancellation holding its refund id.
 * Unknown references are ignored: they belong to dashboard-initiated or
 * unrelated refunds. Returns whether the guest mail should be queued.
 */
export async function reconcileRefundEvent(input: {
  refundId: string;
  status: string;
}): Promise<RefundWebhookOutcome> {
  const status = mapRefundStatus(input.status);
  const outcome = await db().$transaction(async (tx) => {
    const cancellation = await tx.cancellation.findFirst({ where: { providerRefundReference: input.refundId } });
    if (!cancellation) return { handled: false as const };
    if (status === "PROCESSED") {
      if (cancellation.refundStatus === "PROCESSED") return { handled: true as const, notify: false };
      await tx.cancellation.update({
        where: { id: cancellation.id },
        data: { refundStatus: "PROCESSED", processedAt: new Date() },
      });
      await tx.bookingEvent.create({
        data: {
          bookingId: cancellation.bookingId,
          type: "REFUND_UPDATED",
          actorType: "PAYMENT_WEBHOOK",
          data: { action: "process_online_webhook", providerRefundId: input.refundId },
        },
      });
      return { handled: true as const, notify: true, cancellationId: cancellation.id };
    }
    if (status === "FAILED") {
      if (cancellation.refundStatus !== "PROCESSING") return { handled: true as const, notify: false };
      await tx.cancellation.update({ where: { id: cancellation.id }, data: { refundStatus: "APPROVED" } });
      await tx.bookingEvent.create({
        data: {
          bookingId: cancellation.bookingId,
          type: "REFUND_UPDATED",
          actorType: "PAYMENT_WEBHOOK",
          data: { action: "process_online_failed", providerRefundId: input.refundId },
        },
      });
      reportError({
        kind: "payment.refund_failed",
        message: "Razorpay reported a refund as failed; it is queued for review again.",
        context: { cancellationId: cancellation.id, providerRefundId: input.refundId },
      });
      return { handled: true as const, notify: false };
    }
    return { handled: true as const, notify: false };
  });
  if (outcome.handled && "notify" in outcome && outcome.notify) {
    const { notifyRefundProcessed } = await import("@/server/notifications/notify");
    await notifyRefundProcessed({ cancellationId: (outcome as { cancellationId: string }).cancellationId });
  }
  return { handled: outcome.handled, status };
}
