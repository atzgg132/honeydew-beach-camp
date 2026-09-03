import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { quoteCancellationPaise } from "@/domain/booking/cancellation";
import { addDays, todayIstDate } from "@/lib/dates";
import { db } from "@/server/db/client";
import { bootstrapFirstAdmin } from "@/server/auth/admin-session";
import { listStaffBookings } from "@/server/services/admin-booking-query";
import { allocatePaidUnallocated, createStaffBooking, notePaidUnallocatedRefund } from "@/server/services/admin-booking-write";
import { createRoomBlock, reassignBookingRoom, releaseRoomBlock } from "@/server/services/admin-inventory";
import { getAdminPricing, publishPolicyRevision, publishTariffRevision } from "@/server/services/admin-config";
import { listPendingRefunds, recordHotelCollection, updateRefundStatus } from "@/server/services/admin-refunds";
import { dateOnlyToUtc, expireStaleHolds, getAvailabilityForDates } from "@/server/services/availability-service";
import { createHold } from "@/server/services/checkout-service";
import { cancelManagedBooking, getCancellationQuote } from "@/server/services/manage-booking-service";
import type { VerifiedPaymentEvent } from "@/server/payments/provider";
import { settleVerifiedPayment } from "@/server/services/payment-settlement";
import { createQuote } from "@/server/services/quote-service";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const actor = { id: "00000000-0000-4000-8000-000000000001", email: "desk@honeydew.example" };

async function clean() {
  const prisma = db();
  await prisma.$transaction([
    prisma.paymentTransaction.deleteMany(),
    prisma.paymentOrder.deleteMany(),
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

describe.skipIf(!testDatabaseUrl)("admin desk services", () => {
  beforeAll(async () => {
    const rooms = await db().room.count();
    if (rooms !== 7) throw new Error("Apply migrations and seed TEST_DATABASE_URL before integration tests.");
  });

  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await db().$disconnect();
  });

  async function quoteOneAdult(offset = 60) {
    const checkIn = addDays(todayIstDate(), offset);
    const checkOut = addDays(checkIn, 2);
    const intent = {
      checkIn,
      checkOut,
      composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
      rooms: [
        {
          clientId: "r1",
          roomGroupId: "single-bed" as const,
          acMode: "non-ac" as const,
          composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
        },
      ],
    };
    return { intent, quote: await createQuote(intent) };
  }

  it("creates a walk-in booking that consumes inventory", async () => {
    const { intent, quote } = await quoteOneAdult();
    const before = await getAvailabilityForDates(intent.checkIn, intent.checkOut);
    const booking = await createStaffBooking({
      source: "WALK_IN",
      quoteToken: quote.quoteToken,
      contact: { fullName: "Walk In Guest", phone: "9876500099", email: "walkin@example.com" },
      collectedPaise: 0,
      idempotencyKey: "walk-in-1",
      actor,
    });
    expect(booking.rawStatus).toBe("CONFIRMED");
    expect(booking.reference).toMatch(/^HD-/);
    expect(booking.rooms[0]?.assignedPhysicalRoomNumber).toBeTruthy();
    const after = await getAvailabilityForDates(intent.checkIn, intent.checkOut);
    expect(after["single-bed"]).toBe(before["single-bed"] - 1);
  });

  it("blocks a room and hides it from customer availability", async () => {
    const checkIn = addDays(todayIstDate(), 70);
    const checkOut = addDays(checkIn, 2);
    const before = await getAvailabilityForDates(checkIn, checkOut);
    const room = await db().room.findFirstOrThrow({ where: { roomGroupId: "single-bed" } });
    const block = await createRoomBlock({
      roomId: room.id,
      checkIn,
      checkOut,
      reason: "Painting",
      actor,
    });
    const after = await getAvailabilityForDates(checkIn, checkOut);
    expect(after["single-bed"]).toBe(before["single-bed"] - 1);
    await releaseRoomBlock(block.id, actor);
    const restored = await getAvailabilityForDates(checkIn, checkOut);
    expect(restored["single-bed"]).toBe(before["single-bed"]);
  });

  it("publishes a tariff that changes new quotes but not a snapshotted booking", async () => {
    const { quote } = await quoteOneAdult(80);
    const booking = await createStaffBooking({
      source: "PHONE",
      quoteToken: quote.quoteToken,
      contact: { fullName: "Phone Guest", phone: "9876500088", email: "phone@example.com" },
      collectedPaise: 0,
      idempotencyKey: "phone-1",
      actor,
    });
    const frozen = booking.subtotalPaise;
    const current = await getAdminPricing();
    await publishTariffRevision(
      current.rates.map((rate) => ({
        ...rate,
        ratePerPersonPaise: rate.ratePerPersonPaise + 200,
      })),
      actor,
    );
    const later = await quoteOneAdult(90);
    expect(later.quote.price.subtotalPaise).not.toBe(frozen);
    const stored = await db().booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(stored.subtotalPaise).toBe(frozen);
    expect(await db().tariffRevision.count({ where: { retiredAt: null } })).toBe(1);
    await expect(
      publishTariffRevision(
        current.rates.map((rate) => ({ ...rate, ratePerPersonPaise: rate.ratePerPersonPaise + 1 })),
        actor,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await publishTariffRevision(current.rates, actor);
  });

  it("publishes a new advance percentage for future quotes only", async () => {
    const { quote } = await quoteOneAdult(100);
    const booking = await createStaffBooking({
      source: "PHONE",
      quoteToken: quote.quoteToken,
      contact: { fullName: "Advance Guest", phone: "9876500077", email: "advance@example.com" },
      collectedPaise: 0,
      idempotencyKey: "advance-1",
      actor,
    });
    await publishPolicyRevision(10, actor);
    const later = await quoteOneAdult(110);
    expect(later.quote.price.advanceBasisPoints).toBe(1000);
    const stored = await db().booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(stored.advanceBasisPoints).toBe(booking.advanceBasisPoints);
    expect(await db().bookingPolicyRevision.count({ where: { retiredAt: null } })).toBe(1);
    await publishPolicyRevision(30, actor);
  });

  it("finds a desk booking by reference, phone, and assigned room", async () => {
    const { intent, quote } = await quoteOneAdult(200);
    const booking = await createStaffBooking({
      source: "WALK_IN",
      quoteToken: quote.quoteToken,
      contact: { fullName: "Filter Guest", phone: "9876500012", email: "filter@example.com" },
      collectedPaise: 0,
      idempotencyKey: "filter-1",
      actor,
    });
    const roomNumber = booking.rooms[0]?.assignedPhysicalRoomNumber;
    expect(roomNumber).toBeTruthy();
    const byReference = await listStaffBookings({ reference: booking.reference ?? undefined });
    expect(byReference.bookings.map((row) => row.id)).toContain(booking.id);
    const byPhone = await listStaffBookings({ phone: "9876500012" });
    expect(byPhone.bookings.map((row) => row.id)).toContain(booking.id);
    const byRoom = await listStaffBookings({ roomNumber: roomNumber ?? "", from: intent.checkIn, to: intent.checkOut });
    expect(byRoom.bookings.map((row) => row.id)).toContain(booking.id);
    const byStatus = await listStaffBookings({ status: "CONFIRMED", source: "WALK_IN" });
    expect(byStatus.bookings.map((row) => row.id)).toContain(booking.id);
  });

  it("refuses a fifth single-bed booking when the last room is taken", async () => {
    const checkIn = addDays(todayIstDate(), 210);
    const checkOut = addDays(checkIn, 2);
    const intent = {
      checkIn,
      checkOut,
      composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
      rooms: [
        {
          clientId: "r1",
          roomGroupId: "single-bed" as const,
          acMode: "non-ac" as const,
          composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
        },
      ],
    };
    for (let index = 0; index < 4; index += 1) {
      const quote = await createQuote({ ...intent, rooms: [{ ...intent.rooms[0], clientId: `full-${index}` }] });
      await createStaffBooking({
        source: "PHONE",
        quoteToken: quote.quoteToken,
        contact: {
          fullName: `Full ${index}`,
          phone: `98765021${10 + index}`,
          email: `full${index}@example.com`,
        },
        collectedPaise: 0,
        idempotencyKey: `full-${index}`,
        actor,
      });
    }
    await expect(createQuote(intent)).rejects.toMatchObject({ code: "AVAILABILITY_CHANGED" });
  });

  it("reassigns to a free room and rejects a busy one", async () => {
    const { intent, quote } = await quoteOneAdult(220);
    const first = await createStaffBooking({
      source: "PHONE",
      quoteToken: quote.quoteToken,
      contact: { fullName: "Move Guest", phone: "9876500021", email: "move@example.com" },
      collectedPaise: 0,
      idempotencyKey: "reassign-1",
      actor,
    });
    const secondQuote = await createQuote({
      ...intent,
      rooms: [{ ...intent.rooms[0], clientId: "r2" }],
    });
    const second = await createStaffBooking({
      source: "PHONE",
      quoteToken: secondQuote.quoteToken,
      contact: { fullName: "Stay Guest", phone: "9876500022", email: "stay@example.com" },
      collectedPaise: 0,
      idempotencyKey: "reassign-2",
      actor,
    });
    const currentId = first.rooms[0]?.assignedRoomId;
    const busyId = second.rooms[0]?.assignedRoomId;
    const bookingRoomId = first.rooms[0]?.id;
    expect(currentId && busyId && bookingRoomId).toBeTruthy();
    const free = await db().room.findFirstOrThrow({
      where: { roomGroupId: "single-bed", id: { notIn: [currentId ?? "", busyId ?? ""] } },
    });
    const moved = await reassignBookingRoom({
      bookingId: first.id,
      bookingRoomId: bookingRoomId ?? "",
      roomId: free.id,
      actor,
      idempotencyKey: "reassign-ok",
    });
    expect(moved.rooms[0]?.assignedPhysicalRoomNumber).toBe(free.roomNumber);
    await expect(
      reassignBookingRoom({
        bookingId: first.id,
        bookingRoomId: bookingRoomId ?? "",
        roomId: busyId ?? "",
        actor,
        idempotencyKey: "reassign-busy",
      }),
    ).rejects.toMatchObject({ code: "AVAILABILITY_CHANGED" });
  });

  it("lets staff cancel after the guest window and releases the rooms", async () => {
    const { quote } = await quoteOneAdult(230);
    const booking = await createStaffBooking({
      source: "PHONE",
      quoteToken: quote.quoteToken,
      contact: { fullName: "Late Cancel", phone: "9876500031", email: "late@example.com" },
      collectedPaise: 0,
      idempotencyKey: "cancel-late",
      actor,
    });
    await db().booking.update({
      where: { id: booking.id },
      data: { checkIn: dateOnlyToUtc(addDays(todayIstDate(), -1)) },
    });
    await expect(cancelManagedBooking(booking.id, "guest-late", { kind: "customer" })).rejects.toMatchObject({
      code: "SELF_SERVICE_CLOSED",
    });
    await cancelManagedBooking(booking.id, "admin-late", { kind: "admin", id: actor.id });
    const reservations = await db().roomReservation.findMany({ where: { bookingRoom: { bookingId: booking.id } } });
    expect(reservations.every((row) => row.state === "RELEASED")).toBe(true);
  });

  it("quotes the shared cancellation slab and queues a refund", async () => {
    const { quote } = await quoteOneAdult(235);
    const booking = await createStaffBooking({
      source: "PHONE",
      quoteToken: quote.quoteToken,
      contact: { fullName: "Refund Guest", phone: "9876500035", email: "refund@example.com" },
      collectedPaise: quote.price.advancePaise,
      idempotencyKey: "cancel-refund",
      actor,
    });
    const quoted = await getCancellationQuote(booking.id, { kind: "admin", id: actor.id });
    const expected = quoteCancellationPaise(quoted.hoursUntilCheckIn, booking.advancePaidPaise);
    expect(quoted.refundablePaise).toBe(expected.refundablePaise);
    expect(quoted.deductionPaise).toBe(expected.deductionPaise);
    expect(quoted.refundablePaise).toBeGreaterThan(0);
    await cancelManagedBooking(booking.id, "admin-refund", { kind: "admin", id: actor.id });
    const cancellation = await db().cancellation.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(cancellation.refundStatus).toBe("PENDING_HOTEL_REVIEW");
    expect(cancellation.refundablePaise).toBe(quoted.refundablePaise);
    const queue = await listPendingRefunds();
    expect(queue.some((row) => row.booking.id === booking.id)).toBe(true);
    await updateRefundStatus({ cancellationId: cancellation.id, actor, action: "approve" });
    const processed = await updateRefundStatus({
      cancellationId: cancellation.id,
      actor,
      action: "process",
      actualRefundPaise: cancellation.refundablePaise,
      reference: "UPI-1",
    });
    expect(processed.cancellation?.refundStatus).toBe("PROCESSED");
  });

  it("does not queue a zero-refund cancellation", async () => {
    const { quote } = await quoteOneAdult(240);
    const booking = await createStaffBooking({
      source: "WALK_IN",
      quoteToken: quote.quoteToken,
      contact: { fullName: "Zero Refund", phone: "9876500032", email: "zero@example.com" },
      collectedPaise: 0,
      idempotencyKey: "cancel-zero",
      actor,
    });
    await cancelManagedBooking(booking.id, "admin-zero", { kind: "admin", id: actor.id });
    const cancellation = await db().cancellation.findUniqueOrThrow({ where: { bookingId: booking.id } });
    expect(cancellation.refundStatus).toBe("NOT_REQUIRED");
    const queue = await listPendingRefunds();
    expect(queue.some((row) => row.booking.id === booking.id)).toBe(false);
  });

  it("records hotel collections up to outstanding only", async () => {
    const { quote } = await quoteOneAdult(250);
    const booking = await createStaffBooking({
      source: "WALK_IN",
      quoteToken: quote.quoteToken,
      contact: { fullName: "Collect Guest", phone: "9876500033", email: "collect@example.com" },
      collectedPaise: 0,
      idempotencyKey: "collect-1",
      actor,
    });
    await expect(
      recordHotelCollection({
        bookingId: booking.id,
        amountPaise: booking.outstandingPaise + 2,
        actor,
        idempotencyKey: "collect-over",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const updated = await recordHotelCollection({
      bookingId: booking.id,
      amountPaise: 200,
      note: "Cash at desk",
      actor,
      idempotencyKey: "collect-ok",
    });
    expect(updated.outstandingPaise).toBe(booking.outstandingPaise - 200);
    expect(updated.advancePaidPaise).toBe(Math.min(200, booking.advanceDuePaise));
  });

  it("allocates a paid-unallocated payment without a second charge", async () => {
    const { intent, quote } = await quoteOneAdult(260);
    const hold = await createHold({
      quoteToken: quote.quoteToken,
      contact: { fullName: "Late Pay", phone: "9876500034", email: "latepay@example.com" },
      idempotencyKey: "hold-unallocated",
    });
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
    await db().booking.update({
      where: { id: bookingId },
      data: { holdExpiresAt: new Date(Date.now() - 60_000) },
    });
    await expireStaleHolds();
    const event: VerifiedPaymentEvent = {
      provider: "test",
      providerEventId: `evt_${bookingId}`,
      eventType: "payment.succeeded",
      providerOrderId: order.providerOrderId ?? `test_order_${bookingId}`,
      providerPaymentId: `pay_${bookingId}`,
      amountPaise: order.amountPaise,
      currency: order.currency as "INR",
      paidAt: new Date(),
    };
    await settleVerifiedPayment(event);
    const noted = await notePaidUnallocatedRefund(bookingId, actor, "Guest asked for rooms first", "note-1");
    expect(noted.events.some((row) => row.type === "PAYMENT_UNALLOCATED_NOTED")).toBe(true);
    const confirmed = await allocatePaidUnallocated(bookingId, actor, "allocate-1");
    expect(confirmed.rawStatus).toBe("CONFIRMED");
    expect(confirmed.reference).toMatch(/^HD-/);
    expect(confirmed.payments.filter((payment) => payment.status === "PAID")).toHaveLength(1);
    expect(confirmed.payments.some((payment) => payment.status === "PAID_UNALLOCATED")).toBe(false);
    expect(await db().paymentTransaction.count({ where: { paymentOrderId: order.id } })).toBe(1);
    const availability = await getAvailabilityForDates(intent.checkIn, intent.checkOut);
    expect(availability["single-bed"]).toBeLessThan(4);
  });

  it("refuses a second bootstrap once an administrator exists", async () => {
    await bootstrapFirstAdmin("owner@honeydew.example");
    await expect(bootstrapFirstAdmin("other@honeydew.example")).rejects.toThrow(/already exists/);
  });
});
