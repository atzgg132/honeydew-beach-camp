import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, todayIstDate } from "@/lib/dates";
import { db } from "@/server/db/client";
import type { VerifiedPaymentEvent } from "@/server/payments/provider";
import { expireStaleHolds } from "@/server/services/availability-service";
import { createHold } from "@/server/services/checkout-service";
import { settleVerifiedPayment } from "@/server/services/payment-settlement";
import { createQuote } from "@/server/services/quote-service";

/**
 * Settlement is where money meets inventory, and it is the only place a booking becomes
 * confirmed. These tests cover the cases a real payment provider will actually produce:
 * duplicates, redeliveries after the hold has gone, wrong amounts, and unknown orders.
 *
 * The final case is the one that matters most — a payment arriving at the same moment the
 * cleanup job releases the rooms. Getting that wrong either overbooks the camp or silently
 * keeps a guest's money.
 */

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const contact = { fullName: "Settlement Guest", phone: "9876500011", email: "settlement@example.com" };

async function cleanBusinessData() {
  const prisma = db();
  await prisma.$transaction([
    prisma.paymentTransaction.deleteMany(),
    prisma.paymentOrder.deleteMany(),
    prisma.webhookEvent.deleteMany(),
    prisma.cancellation.deleteMany(),
    prisma.manageSession.deleteMany(),
    prisma.checkoutSession.deleteMany(),
    prisma.idempotencyRequest.deleteMany(),
    prisma.bookingEvent.deleteMany(),
    prisma.roomReservation.deleteMany(),
    prisma.bookingRoom.deleteMany(),
    prisma.booking.deleteMany(),
  ]);
}

/** Creates a held booking with a payment order ready to settle. */
async function heldBookingWithOrder(dayOffset: number) {
  const checkIn = addDays(todayIstDate(), dayOffset);
  const checkOut = addDays(checkIn, 1);
  const intent = {
    checkIn,
    checkOut,
    composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
    rooms: [
      {
        clientId: "room-1",
        roomGroupId: "single-bed" as const,
        acMode: "non-ac" as const,
        composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
      },
    ],
  };
  const quote = await createQuote(intent);
  const hold = await createHold({ quoteToken: quote.quoteToken, contact, idempotencyKey: crypto.randomUUID() });
  const bookingId = hold.data.holdId;

  const booking = await db().booking.findUniqueOrThrow({ where: { id: bookingId } });
  const order = await db().paymentOrder.create({
    data: {
      bookingId,
      provider: "test",
      providerOrderId: `test_order_${bookingId}`,
      status: "PENDING",
      amountPaise: booking.advanceDuePaise,
      currency: booking.currency,
      providerExpiresAt: booking.holdExpiresAt,
    },
  });
  return { bookingId, order, booking };
}

function eventFor(order: { providerOrderId: string | null; amountPaise: number; currency: string }, overrides: Partial<VerifiedPaymentEvent> = {}): VerifiedPaymentEvent {
  return {
    provider: "test",
    providerEventId: `evt_${crypto.randomUUID()}`,
    eventType: "payment.succeeded",
    providerOrderId: order.providerOrderId!,
    providerPaymentId: `pay_${crypto.randomUUID()}`,
    amountPaise: order.amountPaise,
    currency: order.currency as "INR",
    paidAt: new Date(),
    ...overrides,
  };
}

describe.skipIf(!testDatabaseUrl)("payment settlement", () => {
  beforeAll(async () => {
    const rooms = await db().room.count();
    if (rooms !== 7) {
      throw new Error("Apply migrations and seed TEST_DATABASE_URL before integration tests.");
    }
  });

  beforeEach(cleanBusinessData);
  afterAll(async () => {
    await cleanBusinessData();
    await db().$disconnect();
  });

  it("confirms the booking, holds the rooms and records the money", async () => {
    const { bookingId, order, booking } = await heldBookingWithOrder(120);
    const result = await settleVerifiedPayment(eventFor(order));

    expect(result.status).toBe("confirmed");

    const confirmed = await db().booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.reference).toMatch(/^HD-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(confirmed.advancePaidPaise).toBe(booking.advanceDuePaise);
    expect(confirmed.outstandingPaise).toBe(booking.subtotalPaise - booking.advanceDuePaise);

    const reservations = await db().roomReservation.findMany({ where: { bookingRoom: { bookingId } } });
    expect(reservations).toHaveLength(1);
    expect(reservations[0].state).toBe("CONFIRMED");
    // A confirmed reservation must not carry an expiry, or the cleanup job could reclaim it.
    expect(reservations[0].expiresAt).toBeNull();

    const paid = await db().paymentOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(paid.status).toBe("PAID");
    expect(await db().paymentTransaction.count({ where: { paymentOrderId: order.id } })).toBe(1);
  });

  it("treats a redelivered event as already settled without charging twice", async () => {
    const { bookingId, order } = await heldBookingWithOrder(121);
    const event = eventFor(order);

    const first = await settleVerifiedPayment(event);
    const second = await settleVerifiedPayment(event);

    expect(first.status).toBe("confirmed");
    expect(second.status).toBe("already_confirmed");
    if (first.status === "confirmed" && second.status === "already_confirmed") {
      expect(second.reference).toBe(first.reference);
    }

    // One payment, one transaction row, one confirmation event.
    expect(await db().paymentTransaction.count({ where: { paymentOrderId: order.id } })).toBe(1);
    expect(await db().bookingEvent.count({ where: { bookingId, type: "BOOKING_CONFIRMED" } })).toBe(1);
  });

  it("treats a distinct event for an already-settled order as already settled", async () => {
    const { order } = await heldBookingWithOrder(122);
    await settleVerifiedPayment(eventFor(order));
    // A provider retrying with a fresh event id must not produce a second confirmation.
    const again = await settleVerifiedPayment(eventFor(order));
    expect(again.status).toBe("already_confirmed");
    expect(await db().paymentTransaction.count({ where: { paymentOrderId: order.id } })).toBe(1);
  });

  it("refuses an amount that does not match the order", async () => {
    const { bookingId, order } = await heldBookingWithOrder(123);
    await expect(
      settleVerifiedPayment(eventFor(order, { amountPaise: order.amountPaise - 100 })),
    ).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_MISMATCH" });

    // The booking stays unconfirmed and no money is recorded against it.
    const booking = await db().booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(booking.status).toBe("PENDING_PAYMENT");
    expect(await db().paymentTransaction.count({ where: { paymentOrderId: order.id } })).toBe(0);
  });

  it("refuses a currency that does not match the order", async () => {
    const { order } = await heldBookingWithOrder(124);
    await expect(
      settleVerifiedPayment(eventFor(order, { currency: "USD" as "INR" })),
    ).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_MISMATCH" });
  });

  it("refuses an event for an order that does not exist rather than discarding the money", async () => {
    await expect(
      settleVerifiedPayment(
        eventFor({ providerOrderId: "test_order_missing", amountPaise: 1_000, currency: "INR" }),
      ),
    ).rejects.toMatchObject({ code: "PAYMENT_ORDER_UNKNOWN" });
  });

  describe("cleanup versus payment", () => {
    it("records the money as unallocated when the hold has already been released", async () => {
      const { bookingId, order } = await heldBookingWithOrder(125);

      // Force the hold past its deadline, then run the cleanup job exactly as the scheduler
      // would. This is the race: the guest paid, but the rooms went back on sale first.
      await db().booking.update({
        where: { id: bookingId },
        data: { holdExpiresAt: new Date(Date.now() - 60_000) },
      });
      await expireStaleHolds();

      const expired = await db().booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(expired.status).toBe("EXPIRED");

      const result = await settleVerifiedPayment(eventFor(order));
      expect(result.status).toBe("paid_unallocated");

      // The money is recorded, the booking is NOT confirmed, and no reservation is revived.
      const settled = await db().paymentOrder.findUniqueOrThrow({ where: { id: order.id } });
      expect(settled.status).toBe("PAID_UNALLOCATED");
      expect(await db().paymentTransaction.count({ where: { paymentOrderId: order.id } })).toBe(1);

      const booking = await db().booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.status).toBe("EXPIRED");
      expect(booking.reference).toBeNull();

      const reservations = await db().roomReservation.findMany({ where: { bookingRoom: { bookingId } } });
      expect(reservations.every((reservation) => reservation.state === "RELEASED")).toBe(true);

      // Staff have something to act on.
      expect(await db().bookingEvent.count({ where: { bookingId, type: "PAYMENT_PAID_UNALLOCATED" } })).toBe(1);
    });

    it("does not release a hold whose payment has already succeeded", async () => {
      const { bookingId, order } = await heldBookingWithOrder(126);
      await settleVerifiedPayment(eventFor(order));

      // Even with an expiry in the past, a paid booking must never have its rooms reclaimed.
      await db().booking.update({
        where: { id: bookingId },
        data: { holdExpiresAt: new Date(Date.now() - 60_000) },
      });
      await expireStaleHolds();

      const booking = await db().booking.findUniqueOrThrow({ where: { id: bookingId } });
      expect(booking.status).toBe("CONFIRMED");
      const reservations = await db().roomReservation.findMany({ where: { bookingRoom: { bookingId } } });
      expect(reservations.every((reservation) => reservation.state === "CONFIRMED")).toBe(true);
    });

    it("stays unallocated on redelivery instead of confirming later", async () => {
      const { bookingId, order } = await heldBookingWithOrder(127);
      await db().booking.update({
        where: { id: bookingId },
        data: { holdExpiresAt: new Date(Date.now() - 60_000) },
      });
      await expireStaleHolds();

      const first = await settleVerifiedPayment(eventFor(order));
      const second = await settleVerifiedPayment(eventFor(order));
      expect(first.status).toBe("paid_unallocated");
      expect(second.status).toBe("paid_unallocated");
      // The second delivery must not add a second payment record.
      expect(await db().paymentTransaction.count({ where: { paymentOrderId: order.id } })).toBe(1);
    });
  });

  it("records every processed event for replay detection", async () => {
    const { order } = await heldBookingWithOrder(128);
    const event = eventFor(order);
    await settleVerifiedPayment(event);

    const recorded = await db().webhookEvent.findUniqueOrThrow({
      where: { provider_providerEventId: { provider: "test", providerEventId: event.providerEventId } },
    });
    expect(recorded.signatureValid).toBe(true);
    expect(recorded.processedAt).not.toBeNull();
    expect(recorded.resultCode).toBe("CONFIRMED");
  });
});
