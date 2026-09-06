import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, todayIstDate } from "@/lib/dates";
import { db } from "@/server/db/client";
import { setErrorReporter } from "@/server/observability/errors";
import { setEmailProviderForTests, type EmailProvider } from "@/server/notifications/provider";
import {
  enqueueNotification,
  listNotifications,
  processDueNotifications,
  requeueStuckDeliveries,
  retryNotification,
} from "@/server/notifications/outbox";
import { POST as deliverOutbox } from "@/app/api/internal/notifications/deliver/route";
import { applyGuestChange, cancelManagedBooking, quoteGuestChange } from "@/server/services/manage-booking-service";
import { settleVerifiedPayment } from "@/server/services/payment-settlement";
import { createHold } from "@/server/services/checkout-service";
import { createQuote } from "@/server/services/quote-service";
import type { VerifiedPaymentEvent } from "@/server/payments/provider";

/**
 * Outbox delivery end to end, without moving real mail: every send goes through an
 * injected fake provider, and the default `console` adapter is never pointed at a
 * real inbox. Covers enqueue idempotency, the worker (success, backoff, dead-letter,
 * stuck-claim recovery), the cron endpoint auth, the staff retry action, and the
 * enqueue hooks on the settlement / cancel / guest-change paths.
 */

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const contact = { fullName: "Notify Guest", phone: "9876500022", email: "notify@example.com" };

const okProvider: EmailProvider = {
  name: "fake-ok",
  send: async () => ({ providerMessageId: "fake-msg-1" }),
};

const failingProvider: EmailProvider = {
  name: "fake-fail",
  send: async () => {
    throw new Error("provider outage");
  },
};

const reports: Array<{ kind: string; message: string }> = [];

async function cleanBusinessData() {
  const prisma = db();
  await prisma.$transaction([
    prisma.notificationAttempt.deleteMany(),
    prisma.notificationOutbox.deleteMany(),
    prisma.paymentTransaction.deleteMany(),
    prisma.paymentOrder.deleteMany(),
    prisma.webhookEvent.deleteMany(),
    prisma.cancellation.deleteMany(),
    prisma.manageSession.deleteMany(),
    prisma.checkoutSession.deleteMany(),
    prisma.idempotencyRequest.deleteMany(),
    prisma.bookingEvent.deleteMany(),
    prisma.roomReservation.deleteMany(),
    prisma.roomBlock.deleteMany(),
    prisma.bookingRoom.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.adminSession.deleteMany(),
    prisma.adminInvitation.deleteMany(),
    prisma.adminUser.deleteMany(),
  ]);
}

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

function eventFor(order: { providerOrderId: string | null; amountPaise: number; currency: string }): VerifiedPaymentEvent {
  return {
    provider: "test",
    providerEventId: `evt_${crypto.randomUUID()}`,
    eventType: "payment.succeeded",
    providerOrderId: order.providerOrderId!,
    providerPaymentId: `pay_${crypto.randomUUID()}`,
    amountPaise: order.amountPaise,
    currency: order.currency as "INR",
    paidAt: new Date(),
  };
}

async function outboxTemplatesFor(bookingId: string): Promise<string[]> {
  const rows = await db().notificationOutbox.findMany({ where: { bookingId }, select: { template: true } });
  return rows.map((row) => row.template).sort();
}

describe.skipIf(!testDatabaseUrl)("notification outbox", () => {
  const savedEnv = { ...process.env };

  beforeAll(async () => {
    const rooms = await db().room.count();
    if (rooms !== 7) {
      throw new Error("Apply migrations and seed TEST_DATABASE_URL before integration tests.");
    }
    process.env.EMAIL_PROVIDER = "console";
    process.env.STAFF_ALERT_EMAIL = "desk@example.test";
    process.env.CRON_SECRET = "test-cron-secret";
    setErrorReporter({ report: (report) => void reports.push({ kind: report.kind, message: report.message }) });
  });

  beforeEach(async () => {
    reports.length = 0;
    setEmailProviderForTests(null);
    await cleanBusinessData();
  });

  afterAll(async () => {
    process.env.EMAIL_PROVIDER = savedEnv.EMAIL_PROVIDER;
    process.env.STAFF_ALERT_EMAIL = savedEnv.STAFF_ALERT_EMAIL;
    if (savedEnv.CRON_SECRET === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = savedEnv.CRON_SECRET;
    setEmailProviderForTests(null);
    await cleanBusinessData();
    await db().$disconnect();
  });

  it("enqueues idempotently on the dedupe key", async () => {
    const first = await enqueueNotification({
      template: "booking_confirmation",
      to: "guest@example.com",
      subject: "Confirmed",
      text: "confirmed",
      html: "<p>confirmed</p>",
      dedupeKey: "test-dedupe-1",
    });
    const second = await enqueueNotification({
      template: "booking_confirmation",
      to: "guest@example.com",
      subject: "Confirmed again",
      text: "confirmed",
      html: "<p>confirmed</p>",
      dedupeKey: "test-dedupe-1",
    });
    expect(second.id).toBe(first.id);
    expect(await db().notificationOutbox.count({ where: { dedupeKey: "test-dedupe-1" } })).toBe(1);
  });

  it("delivers due messages and records the attempt history", async () => {
    await enqueueNotification({
      template: "payment_receipt",
      to: "guest@example.com",
      subject: "Receipt",
      text: "receipt",
      html: "<p>receipt</p>",
      bookingId: undefined,
      dedupeKey: "test-deliver-1",
    });
    const result = await processDueNotifications({ provider: okProvider });
    expect(result).toMatchObject({ checked: 1, sent: 1, failed: 0, deadLettered: 0 });

    const row = await db().notificationOutbox.findUniqueOrThrow({ where: { dedupeKey: "test-deliver-1" } });
    expect(row.status).toBe("SENT");
    expect(row.providerMessageId).toBe("fake-msg-1");
    expect(row.sentAt).not.toBeNull();
    const attempts = await db().notificationAttempt.findMany({ where: { outboxId: row.id } });
    expect(attempts).toHaveLength(1);
    expect(attempts[0].ok).toBe(true);
  });

  it("backs off on failure and dead-letters after the final attempt", async () => {
    await enqueueNotification({
      template: "payment_receipt",
      to: "guest@example.com",
      subject: "Receipt",
      text: "receipt",
      html: "<p>receipt</p>",
      dedupeKey: "test-retry-1",
      maxAttempts: 2,
    });

    const first = await processDueNotifications({ provider: failingProvider });
    expect(first).toMatchObject({ checked: 1, sent: 0, failed: 1, deadLettered: 0 });
    const queued = await db().notificationOutbox.findUniqueOrThrow({ where: { dedupeKey: "test-retry-1" } });
    expect(queued.status).toBe("QUEUED");
    expect(queued.attempts).toBe(1);
    expect(queued.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(queued.lastError).toContain("provider outage");

    // The backoff has not elapsed, so an immediate rerun finds nothing due.
    const idle = await processDueNotifications({ provider: failingProvider });
    expect(idle.checked).toBe(0);

    const second = await processDueNotifications({
      provider: failingProvider,
      now: new Date(Date.now() + 61_000),
    });
    expect(second).toMatchObject({ checked: 1, deadLettered: 1 });
    const dead = await db().notificationOutbox.findUniqueOrThrow({ where: { dedupeKey: "test-retry-1" } });
    expect(dead.status).toBe("DEAD_LETTER");
    expect(reports.some((report) => report.kind === "notification.dead_letter")).toBe(true);
    const attempts = await db().notificationAttempt.findMany({
      where: { outboxId: dead.id },
      orderBy: { attemptNo: "asc" },
    });
    expect(attempts.map((attempt) => attempt.ok)).toEqual([false, false]);
  });

  it("recovers messages stuck in SENDING and retries dead letters on staff request", async () => {
    const enqueued = await enqueueNotification({
      template: "booking_cancelled",
      to: "guest@example.com",
      subject: "Cancelled",
      text: "cancelled",
      html: "<p>cancelled</p>",
      dedupeKey: "test-stuck-1",
    });
    await db().notificationOutbox.update({
      where: { id: enqueued.id },
      data: { status: "SENDING", updatedAt: new Date(Date.now() - 60 * 60_000) },
    });
    const { requeued } = await requeueStuckDeliveries();
    expect(requeued).toBe(1);
    expect((await db().notificationOutbox.findUniqueOrThrow({ where: { id: enqueued.id } })).status).toBe("QUEUED");

    await db().notificationOutbox.update({
      where: { id: enqueued.id },
      data: { status: "DEAD_LETTER", attempts: 5, lastError: "provider outage" },
    });
    const retried = await retryNotification(enqueued.id);
    expect(retried.status).toBe("QUEUED");
    const fresh = await db().notificationOutbox.findUniqueOrThrow({ where: { id: enqueued.id } });
    expect(fresh.attempts).toBe(0);
    expect(fresh.lastError).toBeNull();

    // Retrying a delivered message is refused, not silently duplicated.
    await db().notificationOutbox.update({ where: { id: enqueued.id }, data: { status: "SENT" } });
    await expect(retryNotification(enqueued.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(retryNotification("00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lists delivery history filtered by booking and status", async () => {
    const { bookingId } = await heldBookingWithOrder(120);
    await enqueueNotification({
      template: "booking_confirmation",
      to: "guest@example.com",
      subject: "Confirmed",
      text: "confirmed",
      html: "<p>confirmed</p>",
      bookingId,
      dedupeKey: "test-list-1",
    });
    await enqueueNotification({
      template: "staff_new_booking",
      to: "desk@example.test",
      subject: "New booking",
      text: "new",
      html: "<p>new</p>",
      bookingId,
      dedupeKey: "test-list-2",
    });
    const all = await listNotifications({ bookingId });
    expect(all).toHaveLength(2);
    expect(all[0].deliveryAttempts).toEqual([]);
    const queued = await listNotifications({ bookingId, status: "QUEUED" });
    expect(queued).toHaveLength(2);
    const sent = await listNotifications({ bookingId, status: "SENT" });
    expect(sent).toHaveLength(0);
  });

  it("queues confirmation, receipt and staff alert when settlement confirms", async () => {
    const { bookingId, order } = await heldBookingWithOrder(120);
    const result = await settleVerifiedPayment(eventFor(order));
    expect(result.status).toBe("confirmed");
    expect(await outboxTemplatesFor(bookingId)).toEqual(["booking_confirmation", "payment_receipt", "staff_new_booking"]);

    const guest = await db().notificationOutbox.findFirstOrThrow({
      where: { bookingId, template: "booking_confirmation" },
    });
    expect(guest.toAddress).toBe(contact.email);
    expect(guest.subject).toContain("Booking confirmed");

    // A duplicate delivery confirms idempotently and queues nothing further.
    const replay = await settleVerifiedPayment(eventFor(order));
    expect(replay.status).toBe("already_confirmed");
    expect(await outboxTemplatesFor(bookingId)).toEqual(["booking_confirmation", "payment_receipt", "staff_new_booking"]);
  });

  it("queues a staff payment exception when money cannot be allocated", async () => {
    const { bookingId, order } = await heldBookingWithOrder(120);
    // Let the hold lapse so the payment arrives with nowhere to go.
    await db().booking.update({ where: { id: bookingId }, data: { holdExpiresAt: new Date(Date.now() - 1_000) } });
    const result = await settleVerifiedPayment(eventFor(order));
    expect(result.status).toBe("paid_unallocated");
    const alert = await db().notificationOutbox.findFirstOrThrow({
      where: { bookingId, template: "staff_payment_exception" },
    });
    expect(alert.toAddress).toBe("desk@example.test");
  });

  it("queues guest and staff mail when a confirmed booking is cancelled", async () => {
    const { bookingId, order } = await heldBookingWithOrder(120);
    await settleVerifiedPayment(eventFor(order));
    await cancelManagedBooking(bookingId, crypto.randomUUID());
    const templates = await outboxTemplatesFor(bookingId);
    expect(templates).toContain("booking_cancelled");
    expect(templates).toContain("staff_booking_cancelled");
  });

  it("queues an amendment mail when guests change", async () => {
    const { bookingId, order } = await heldBookingWithOrder(120);
    await settleVerifiedPayment(eventFor(order));
    const quote = await quoteGuestChange(bookingId, { adults: 2, childrenUnder5: 0, children5to10: 0 });
    await applyGuestChange(bookingId, quote.quoteToken, crypto.randomUUID());
    const templates = await outboxTemplatesFor(bookingId);
    expect(templates).toContain("booking_amended");
    expect(templates).toContain("staff_booking_modified");
    const amended = await db().notificationOutbox.findFirstOrThrow({
      where: { bookingId, template: "booking_amended" },
    });
    expect(amended.bodyText).toContain("Guests now: 2 adults");
  });

  it("delivers through the cron endpoint only with the secret", async () => {
    await enqueueNotification({
      template: "payment_receipt",
      to: "guest@example.com",
      subject: "Receipt",
      text: "receipt",
      html: "<p>receipt</p>",
      dedupeKey: "test-cron-1",
    });
    setEmailProviderForTests(okProvider);

    const denied = await deliverOutbox(new Request("http://localhost/api/internal/notifications/deliver", { method: "POST" }));
    expect(denied.status).toBe(401);

    const request = new Request("http://localhost/api/internal/notifications/deliver", {
      method: "POST",
      headers: { authorization: "Bearer test-cron-secret" },
    });
    const response = await deliverOutbox(request);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { sent: number; checked: number } };
    expect(body.data.sent).toBe(1);
    expect(body.data.checked).toBe(1);
  });
});
