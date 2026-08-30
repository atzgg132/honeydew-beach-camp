import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/contracts/errors";
import { canTransition } from "@/domain/booking/state-machine";
import { sha256 } from "@/server/crypto";
import { db } from "@/server/db/client";
import { devPaymentProvider, requireDevPayments } from "@/server/payments/dev-provider";

function productionReference(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(12);
  const characters = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `HD-${characters.slice(0, 4)}-${characters.slice(4, 8)}-${characters.slice(8, 12)}`;
}

export async function createDevPaymentOrder(input: { bookingId: string; idempotencyKey: string }) {
  requireDevPayments();
  const prisma = db();
  const keyHash = sha256(input.idempotencyKey);
  const requestHash = sha256(input.bookingId);
  const scope = `payment-order:${input.bookingId}`;
  const replay = await prisma.idempotencyRequest.findUnique({ where: { scope_keyHash: { scope, keyHash } } });
  if (replay) {
    if (replay.requestHash !== requestHash || !replay.responseBody) {
      throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "That idempotency key was used for another request.");
    }
    return replay.responseBody as {
      orderId: string;
      provider: string;
      amountPaise: number;
      currency: string;
      expiresAt: string;
      clientData: Record<string, string>;
    };
  }
  const booking = await prisma.booking.findUnique({ where: { id: input.bookingId }, include: { payments: true } });
  if (!booking) throw new ApiError(404, "NOT_FOUND", "The checkout was not found.");
  if (booking.status !== "PENDING_PAYMENT") throw new ApiError(409, "INVALID_STATE", "This checkout cannot accept payment.");
  if (!booking.holdExpiresAt || booking.holdExpiresAt <= new Date()) throw new ApiError(409, "HOLD_EXPIRED", "The room hold has expired.");
  const existingOrder = booking.payments.find((order) => order.status === "PENDING" || order.status === "CREATED");
  if (existingOrder) {
    return {
      orderId: existingOrder.id,
      provider: existingOrder.provider,
      amountPaise: existingOrder.amountPaise,
      currency: existingOrder.currency,
      expiresAt: existingOrder.providerExpiresAt?.toISOString() ?? booking.holdExpiresAt.toISOString(),
      clientData: { mode: "development", providerOrderId: existingOrder.providerOrderId ?? "" },
    };
  }
  const providerOrder = await devPaymentProvider.createOrder({
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
    const responseBody = {
      orderId: order.id,
      provider: order.provider,
      amountPaise: order.amountPaise,
      currency: order.currency,
      expiresAt: order.providerExpiresAt?.toISOString() ?? current.holdExpiresAt.toISOString(),
      clientData: concurrentOrder
        ? { mode: "development", providerOrderId: concurrentOrder.providerOrderId ?? "" }
        : providerOrder.clientData,
    };
    await transaction.idempotencyRequest.create({
      data: {
        scope,
        keyHash,
        requestHash,
        bookingId: booking.id,
        responseStatus: 200,
        responseBody,
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      },
    });
      return responseBody;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentReplay = await prisma.idempotencyRequest.findUnique({ where: { scope_keyHash: { scope, keyHash } } });
      if (concurrentReplay?.requestHash === requestHash && concurrentReplay.responseBody) {
        return concurrentReplay.responseBody as {
          orderId: string;
          provider: string;
          amountPaise: number;
          currency: string;
          expiresAt: string;
          clientData: Record<string, string>;
        };
      }
    }
    throw error;
  }
}

export async function succeedDevPayment(orderId: string) {
  requireDevPayments();
  const now = new Date();
  const result = await db().$transaction(
    async (transaction) => {
      const initialOrder = await transaction.paymentOrder.findUnique({ where: { id: orderId }, select: { bookingId: true } });
      if (!initialOrder) throw new ApiError(404, "NOT_FOUND", "The payment order was not found.");
      await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${initialOrder.bookingId}::uuid FOR UPDATE`);
      await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentOrder" WHERE "id" = ${orderId}::uuid FOR UPDATE`);
      const order = await transaction.paymentOrder.findUnique({ where: { id: orderId }, include: { booking: true } });
      if (!order) throw new ApiError(404, "NOT_FOUND", "The payment order was not found.");
      const providerEventId = `dev-success-${order.id}`;
      await transaction.webhookEvent.upsert({
        where: { provider_providerEventId: { provider: "dev", providerEventId } },
        create: {
          provider: "dev",
          providerEventId,
          eventType: "payment.succeeded",
          payloadHash: sha256(JSON.stringify({ orderId: order.id, amountPaise: order.amountPaise, currency: order.currency })),
          signatureValid: true,
        },
        update: {},
      });
      if (order.status === "PAID" && order.booking.status === "CONFIRMED") {
        await transaction.webhookEvent.update({
          where: { provider_providerEventId: { provider: "dev", providerEventId } },
          data: { processedAt: now, resultCode: "ALREADY_CONFIRMED" },
        });
        return { bookingId: order.bookingId, status: "confirmed" as const };
      }
      if (order.status === "PAID_UNALLOCATED") {
        await transaction.webhookEvent.update({
          where: { provider_providerEventId: { provider: "dev", providerEventId } },
          data: { processedAt: now, resultCode: "PAID_UNALLOCATED" },
        });
        return { bookingId: order.bookingId, status: "paid_unallocated" as const };
      }
      if (order.amountPaise !== order.booking.advanceDuePaise || order.currency !== order.booking.currency) {
        throw new ApiError(409, "PAYMENT_AMOUNT_MISMATCH", "The payment amount does not match the booking.");
      }
      const activeReservations = await transaction.roomReservation.count({
        where: { bookingRoom: { bookingId: order.bookingId }, state: "HELD" },
      });
      if (
        order.booking.status !== "PENDING_PAYMENT" ||
        !order.booking.holdExpiresAt ||
        now >= order.booking.holdExpiresAt ||
        activeReservations === 0
      ) {
        await transaction.paymentTransaction.create({
          data: {
            paymentOrderId: order.id,
            provider: "dev",
            providerPaymentId: `dev_payment_${randomUUID()}`,
            status: "SUCCEEDED",
            amountPaise: order.amountPaise,
            currency: order.currency,
            providerPaidAt: now,
          },
        });
        await transaction.paymentOrder.update({ where: { id: order.id }, data: { status: "PAID_UNALLOCATED" } });
        await transaction.bookingEvent.create({
          data: {
            bookingId: order.bookingId,
            type: "PAYMENT_PAID_UNALLOCATED",
            actorType: "PAYMENT_WEBHOOK",
            data: { paymentOrderId: order.id },
          },
        });
        await transaction.webhookEvent.update({
          where: { provider_providerEventId: { provider: "dev", providerEventId } },
          data: { processedAt: now, resultCode: "PAID_UNALLOCATED" },
        });
        return { bookingId: order.bookingId, status: "paid_unallocated" as const };
      }
      if (!canTransition(order.booking.status, "CONFIRMED")) {
        throw new ApiError(409, "INVALID_STATE", "The booking cannot be confirmed.");
      }
      let reference = productionReference();
      while (await transaction.booking.findUnique({ where: { reference }, select: { id: true } })) {
        reference = productionReference();
      }
      await transaction.paymentTransaction.create({
        data: {
          paymentOrderId: order.id,
          provider: "dev",
          providerPaymentId: `dev_payment_${randomUUID()}`,
          status: "SUCCEEDED",
          amountPaise: order.amountPaise,
          currency: order.currency,
          providerPaidAt: now,
        },
      });
      await transaction.paymentOrder.update({ where: { id: order.id }, data: { status: "PAID" } });
      await transaction.roomReservation.updateMany({
        where: { bookingRoom: { bookingId: order.bookingId }, state: "HELD" },
        data: { state: "CONFIRMED", expiresAt: null },
      });
      await transaction.booking.update({
        where: { id: order.bookingId },
        data: {
          status: "CONFIRMED",
          reference,
          advancePaidPaise: order.amountPaise,
          outstandingPaise: Math.max(0, order.booking.subtotalPaise - order.amountPaise),
          confirmedAt: now,
          events: {
            create: {
              type: "BOOKING_CONFIRMED",
              actorType: "PAYMENT_WEBHOOK",
              data: { paymentOrderId: order.id, paymentHash: sha256(order.providerOrderId ?? order.id) },
            },
          },
        },
      });
      await transaction.webhookEvent.update({
        where: { provider_providerEventId: { provider: "dev", providerEventId } },
        data: { processedAt: now, resultCode: "CONFIRMED" },
      });
      return { bookingId: order.bookingId, status: "confirmed" as const, reference };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 },
  );
  if (result.status === "paid_unallocated") {
    throw new ApiError(409, "PAID_UNALLOCATED", "Payment arrived after the room hold expired. The hotel must review it.");
  }
  return result;
}
