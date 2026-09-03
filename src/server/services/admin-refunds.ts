import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/contracts/errors";
import type { AdminActor } from "@/server/auth/admin-session";
import { db } from "@/server/db/client";
import { staffBookingInclude, toStaffBooking, toStaffBookingListItem } from "@/server/dto-admin";

export async function listPendingRefunds() {
  const rows = await db().cancellation.findMany({
    where: { refundStatus: { in: ["PENDING_HOTEL_REVIEW", "APPROVED"] } },
    include: { booking: { include: staffBookingInclude } },
    orderBy: { cancelledAt: "asc" },
  });
  return rows.map((row) => ({
    cancellationId: row.id,
    refundStatus: row.refundStatus,
    refundablePaise: row.refundablePaise,
    deductionPaise: row.deductionPaise,
    slabLabel: row.slabLabel,
    cancelledAt: row.cancelledAt.toISOString(),
    booking: toStaffBookingListItem(row.booking),
  }));
}

export async function updateRefundStatus(input: {
  cancellationId: string;
  actor: AdminActor;
  action: "approve" | "reject" | "process";
  actualRefundPaise?: number;
  reference?: string;
}) {
  const now = new Date();
  return db().$transaction(async (transaction) => {
    const cancellation = await transaction.cancellation.findUnique({
      where: { id: input.cancellationId },
      include: { booking: true },
    });
    if (!cancellation) throw new ApiError(404, "NOT_FOUND", "The cancellation was not found.");
    if (input.action === "approve") {
      if (cancellation.refundStatus !== "PENDING_HOTEL_REVIEW") {
        throw new ApiError(409, "INVALID_STATE", "Only a queued refund can be approved.");
      }
      await transaction.cancellation.update({
        where: { id: cancellation.id },
        data: { refundStatus: "APPROVED", approvedAt: now },
      });
    } else if (input.action === "reject") {
      if (cancellation.refundStatus !== "PENDING_HOTEL_REVIEW" && cancellation.refundStatus !== "APPROVED") {
        throw new ApiError(409, "INVALID_STATE", "This refund can no longer be rejected.");
      }
      await transaction.cancellation.update({
        where: { id: cancellation.id },
        data: { refundStatus: "REJECTED" },
      });
    } else {
      if (cancellation.refundStatus !== "APPROVED") {
        throw new ApiError(409, "INVALID_STATE", "Approve the refund before marking it processed.");
      }
      const actual = input.actualRefundPaise;
      if (actual === undefined || actual < 0 || actual > cancellation.refundablePaise) {
        throw new ApiError(400, "VALIDATION_ERROR", "Enter the amount actually returned, up to the refundable total.");
      }
      await transaction.cancellation.update({
        where: { id: cancellation.id },
        data: {
          refundStatus: "PROCESSED",
          actualRefundPaise: actual,
          providerRefundReference: input.reference ?? null,
          processedAt: now,
        },
      });
    }
    await transaction.bookingEvent.create({
      data: {
        bookingId: cancellation.bookingId,
        type: "REFUND_UPDATED",
        actorType: "ADMIN",
        actorId: input.actor.id,
        data: { action: input.action, actualRefundPaise: input.actualRefundPaise ?? null },
      },
    });
    return toStaffBooking(
      await transaction.booking.findUniqueOrThrow({ where: { id: cancellation.bookingId }, include: staffBookingInclude }),
    );
  });
}

export async function recordHotelCollection(input: {
  bookingId: string;
  amountPaise: number;
  note?: string;
  actor: AdminActor;
  idempotencyKey: string;
}) {
  if (input.amountPaise <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Enter an amount greater than zero.");
  }
  const now = new Date();
  return db().$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${input.bookingId}::uuid FOR UPDATE`);
    const existing = await transaction.bookingEvent.findFirst({
      where: { bookingId: input.bookingId, type: "HOTEL_PAYMENT_RECORDED", idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return toStaffBooking(await transaction.booking.findUniqueOrThrow({ where: { id: input.bookingId }, include: staffBookingInclude }));
    }
    const booking = await transaction.booking.findUnique({ where: { id: input.bookingId } });
    if (!booking) throw new ApiError(404, "NOT_FOUND", "The booking was not found.");
    if (booking.status !== "CONFIRMED") {
      throw new ApiError(409, "INVALID_STATE", "Collections can only be recorded on a confirmed stay.");
    }
    if (input.amountPaise > booking.outstandingPaise) {
      throw new ApiError(400, "VALIDATION_ERROR", "Collected amount cannot exceed the outstanding balance.");
    }
    const remainingAdvance = Math.max(0, booking.advanceDuePaise - booking.advancePaidPaise);
    const appliedToAdvance = Math.min(input.amountPaise, remainingAdvance);
    const ids = { orderId: `hotel-${randomUUID()}`, paymentId: `hotel-tx-${randomUUID()}` };
    await transaction.paymentOrder.create({
      data: {
        bookingId: booking.id,
        provider: "hotel",
        providerOrderId: ids.orderId,
        status: "PAID",
        amountPaise: input.amountPaise,
        currency: booking.currency,
        transactions: {
          create: {
            provider: "hotel",
            providerPaymentId: ids.paymentId,
            status: "SUCCEEDED",
            amountPaise: input.amountPaise,
            currency: booking.currency,
            providerPaidAt: now,
          },
        },
      },
    });
    await transaction.booking.update({
      where: { id: booking.id },
      data: {
        advancePaidPaise: booking.advancePaidPaise + appliedToAdvance,
        outstandingPaise: booking.outstandingPaise - input.amountPaise,
        events: {
          create: {
            type: "HOTEL_PAYMENT_RECORDED",
            actorType: "ADMIN",
            actorId: input.actor.id,
            idempotencyKey: input.idempotencyKey,
            deltaPaise: -input.amountPaise,
            data: { note: input.note ?? null, amountPaise: input.amountPaise },
          },
        },
      },
    });
    return toStaffBooking(await transaction.booking.findUniqueOrThrow({ where: { id: booking.id }, include: staffBookingInclude }));
  });
}
