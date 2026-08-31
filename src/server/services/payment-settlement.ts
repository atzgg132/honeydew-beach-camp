import "server-only";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { ApiError } from "@/contracts/errors";
import { canTransition } from "@/domain/booking/state-machine";
import { sha256 } from "@/server/crypto";
import { db } from "@/server/db/client";
import type { VerifiedPaymentEvent } from "@/server/payments/provider";

/**
 * Settlement: turning a verified payment into a confirmed booking.
 *
 * This is the only place money is allowed to change a booking's state. It was previously
 * inlined in the development-only success endpoint, which meant a real payment webhook could
 * not reuse it and would have had to restate every rule — the amount check, the
 * paid-after-expiry path, reference generation, the reservation transition. Those rules are
 * the difference between a correct booking and an overbooked room or an unrecorded payment.
 *
 * The caller is responsible for having *verified* the event. This function trusts
 * `VerifiedPaymentEvent` completely and is deliberately provider-agnostic.
 *
 * Ordering rules that must not be relaxed:
 *
 *  - The whole thing runs at SERIALIZABLE isolation, with the booking and then the payment
 *    order locked `FOR UPDATE` in that order. Every other writer takes the same order.
 *  - No provider or notification call may happen inside this transaction. Network calls
 *    inside a database transaction hold locks for the duration of someone else's outage.
 *  - The `WebhookEvent` row is written before any decision, so a duplicate delivery is
 *    recognised even if processing then fails.
 */

export type SettlementOutcome =
  | { status: "confirmed"; bookingId: string; reference: string }
  | { status: "already_confirmed"; bookingId: string; reference: string | null }
  | { status: "paid_unallocated"; bookingId: string };

/**
 * Booking references are shown to guests, read over the phone, and written on paper. The
 * alphabet is Crockford base32 without I, L, O or U, so it cannot be misread as digits and
 * cannot accidentally spell anything. 32 characters divides 256 exactly, so taking a byte
 * modulo the alphabet length is unbiased.
 */
function generateReference(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(12);
  const characters = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `HD-${characters.slice(0, 4)}-${characters.slice(4, 8)}-${characters.slice(8, 12)}`;
}

async function allocateReference(transaction: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const reference = generateReference();
    const clash = await transaction.booking.findUnique({ where: { reference }, select: { id: true } });
    if (!clash) return reference;
  }
  // 32^12 of space; eight collisions in a row means something is badly wrong, and silently
  // looping forever inside a serializable transaction would be worse than failing.
  throw new ApiError(500, "REFERENCE_ALLOCATION_FAILED", "Could not allocate a booking reference.");
}

/**
 * Applies a verified payment.
 *
 * Idempotent by `(provider, providerEventId)`: a duplicate delivery returns the same outcome
 * without writing again. Out-of-order and late deliveries are handled by inspecting current
 * state rather than by assuming the event is the first one seen.
 */
export async function settleVerifiedPayment(event: VerifiedPaymentEvent): Promise<SettlementOutcome> {
  const now = new Date();

  return db().$transaction(
    async (transaction) => {
      const order = await transaction.paymentOrder.findUnique({
        where: { provider_providerOrderId: { provider: event.provider, providerOrderId: event.providerOrderId } },
        select: { id: true, bookingId: true },
      });
      if (!order) {
        // Money exists that we have no order for. Never silently discard it.
        throw new ApiError(404, "PAYMENT_ORDER_UNKNOWN", "No payment order matches this event.");
      }

      // Same lock order as every other writer: booking, then payment order.
      await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${order.bookingId}::uuid FOR UPDATE`);
      await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "PaymentOrder" WHERE "id" = ${order.id}::uuid FOR UPDATE`);

      const current = await transaction.paymentOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { booking: true },
      });

      // Recorded before any decision, so a redelivery is recognised even if what follows
      // fails and the transaction rolls back to this point on retry.
      await transaction.webhookEvent.upsert({
        where: { provider_providerEventId: { provider: event.provider, providerEventId: event.providerEventId } },
        create: {
          provider: event.provider,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          payloadHash: sha256(
            JSON.stringify({
              providerOrderId: event.providerOrderId,
              providerPaymentId: event.providerPaymentId,
              amountPaise: event.amountPaise,
              currency: event.currency,
            }),
          ),
          signatureValid: true,
        },
        update: {},
      });

      const finish = async (resultCode: string) => {
        await transaction.webhookEvent.update({
          where: { provider_providerEventId: { provider: event.provider, providerEventId: event.providerEventId } },
          data: { processedAt: now, resultCode },
        });
      };

      // Already settled. A duplicate or out-of-order delivery lands here.
      if (current.status === "PAID" && current.booking.status === "CONFIRMED") {
        await finish("ALREADY_CONFIRMED");
        return { status: "already_confirmed", bookingId: current.bookingId, reference: current.booking.reference };
      }
      if (current.status === "PAID_UNALLOCATED") {
        await finish("PAID_UNALLOCATED");
        return { status: "paid_unallocated", bookingId: current.bookingId };
      }

      // The provider must have charged exactly what we asked for. A mismatch is never
      // reconciled automatically; it is an exception for staff to resolve.
      if (event.amountPaise !== current.amountPaise || event.currency !== current.currency) {
        await finish("AMOUNT_MISMATCH");
        throw new ApiError(409, "PAYMENT_AMOUNT_MISMATCH", "The payment amount does not match the order.");
      }
      if (current.amountPaise !== current.booking.advanceDuePaise) {
        await finish("AMOUNT_MISMATCH");
        throw new ApiError(409, "PAYMENT_AMOUNT_MISMATCH", "The payment amount does not match the booking.");
      }

      const transactionRow = {
        paymentOrderId: current.id,
        provider: event.provider,
        providerPaymentId: event.providerPaymentId,
        status: "SUCCEEDED" as const,
        amountPaise: event.amountPaise,
        currency: event.currency,
        providerPaidAt: event.paidAt,
      };

      const heldReservations = await transaction.roomReservation.count({
        where: { bookingRoom: { bookingId: current.bookingId }, state: "HELD" },
      });

      // The payment is good but the rooms are gone: the hold lapsed, or the booking was
      // already expired or cancelled. The money is recorded and the booking is NOT
      // confirmed. Staff resolve it by reallocating a room or refunding. Confirming here
      // would overbook the camp.
      const holdLapsed =
        current.booking.status !== "PENDING_PAYMENT" ||
        !current.booking.holdExpiresAt ||
        now >= current.booking.holdExpiresAt ||
        heldReservations === 0;

      if (holdLapsed) {
        await transaction.paymentTransaction.create({ data: transactionRow });
        await transaction.paymentOrder.update({ where: { id: current.id }, data: { status: "PAID_UNALLOCATED" } });
        await transaction.bookingEvent.create({
          data: {
            bookingId: current.bookingId,
            type: "PAYMENT_PAID_UNALLOCATED",
            actorType: "PAYMENT_WEBHOOK",
            data: { paymentOrderId: current.id, providerPaymentId: event.providerPaymentId },
          },
        });
        await finish("PAID_UNALLOCATED");
        return { status: "paid_unallocated", bookingId: current.bookingId };
      }

      if (!canTransition(current.booking.status, "CONFIRMED")) {
        await finish("INVALID_STATE");
        throw new ApiError(409, "INVALID_STATE", "The booking cannot be confirmed.");
      }

      const reference = await allocateReference(transaction);

      await transaction.paymentTransaction.create({ data: transactionRow });
      await transaction.paymentOrder.update({ where: { id: current.id }, data: { status: "PAID" } });
      await transaction.roomReservation.updateMany({
        where: { bookingRoom: { bookingId: current.bookingId }, state: "HELD" },
        data: { state: "CONFIRMED", expiresAt: null },
      });
      await transaction.booking.update({
        where: { id: current.bookingId },
        data: {
          status: "CONFIRMED",
          reference,
          advancePaidPaise: event.amountPaise,
          outstandingPaise: Math.max(0, current.booking.subtotalPaise - event.amountPaise),
          confirmedAt: now,
          events: {
            create: {
              type: "BOOKING_CONFIRMED",
              actorType: "PAYMENT_WEBHOOK",
              data: {
                paymentOrderId: current.id,
                // The provider payment id is a financial identifier; the hash is enough to
                // correlate two events without copying it into the audit trail.
                paymentHash: sha256(event.providerPaymentId),
              },
            },
          },
        },
      });
      await finish("CONFIRMED");

      return { status: "confirmed", bookingId: current.bookingId, reference };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 },
  );
}
