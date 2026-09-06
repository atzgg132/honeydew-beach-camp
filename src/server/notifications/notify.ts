import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db/client";
import { siteOrigin, staffAlertEmail } from "@/server/notifications/config";
import { enqueueNotification } from "@/server/notifications/outbox";
import { reportError } from "@/server/observability/errors";
import {
  bookingAmended,
  bookingCancelled,
  bookingConfirmation,
  paymentReceipt,
  refundProcessed,
  staffBookingCancelled,
  staffBookingModified,
  staffNewBooking,
  staffPaymentException,
} from "@/server/notifications/templates";

/**
 * Domain hooks: translate booking state changes into queued mail.
 *
 * Every helper below only writes outbox rows, never touches the network, so callers
 * invoke them *inside* the same database transaction as the state change. A confirmed
 * booking and its confirmation mail commit atomically; a rolled-back write queues
 * nothing. Delivery itself happens later in the worker (`outbox.ts`).
 *
 * Dedupe keys are scoped per (event, entity): webhook redeliveries and
 * idempotency-key replays upsert the same key instead of queueing a second mail.
 */

type Tx = Prisma.TransactionClient;

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function deskBookingUrl(bookingId: string): string {
  return `${siteOrigin()}/admin/bookings/${bookingId}`;
}

function manageBookingUrl(): string {
  return `${siteOrigin()}/manage-booking`;
}

function roomLine(room: { roomGroupNameSnapshot: string; acMode: string; adults: number; childrenUnder5: number; children5To10: number }): string {
  const guests = room.adults + room.childrenUnder5 + room.children5To10;
  return `${room.roomGroupNameSnapshot} — ${room.acMode === "AC" ? "AC" : "Non-AC"}, ${guests} guest${guests === 1 ? "" : "s"}`;
}

const bookingSelect = {
  id: true,
  reference: true,
  source: true,
  contactFullName: true,
  contactEmail: true,
  checkIn: true,
  checkOut: true,
  nights: true,
  subtotalPaise: true,
  advancePaidPaise: true,
  outstandingPaise: true,
  rooms: {
    orderBy: { displayOrder: "asc" as const },
    select: { roomGroupNameSnapshot: true, acMode: true, adults: true, childrenUnder5: true, children5To10: true },
  },
} satisfies Prisma.BookingSelect;

type BookingRow = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;

async function loadBooking(tx: Tx, bookingId: string): Promise<BookingRow | null> {
  return tx.booking.findUnique({ where: { id: bookingId }, select: bookingSelect });
}

function requireReference(booking: { reference: string | null }): string {
  return booking.reference ?? "pending";
}

async function enqueueStaff(
  tx: Tx,
  input: {
    template: "staff_new_booking" | "staff_booking_cancelled" | "staff_booking_modified";
    subject: string;
    text: string;
    html: string;
    bookingId: string;
    dedupeKey: string;
  },
) {
  const staff = staffAlertEmail();
  if (!staff) return;
  const { template, ...rest } = input;
  await enqueueNotification({ template, to: staff, ...rest, payload: { kind: "staff-alert" } }, tx);
}

/**
 * A booking just became CONFIRMED (online settlement, staff allocation of a
 * paid-unallocated order, or a staff-created booking). Queues the guest confirmation,
 * the guest payment receipt when money moved online, and the staff new-booking alert.
 */
export async function notifyBookingConfirmed(
  tx: Tx,
  input: { bookingId: string; receipt?: { orderId: string; amountPaise: number; paidAt: Date } },
): Promise<void> {
  const booking = await loadBooking(tx, input.bookingId);
  if (!booking) return;
  const reference = requireReference(booking);
  const data = {
    guestName: booking.contactFullName,
    reference,
    checkIn: dateOnly(booking.checkIn),
    checkOut: dateOnly(booking.checkOut),
    nights: booking.nights,
    roomLines: booking.rooms.map(roomLine),
    subtotalPaise: booking.subtotalPaise,
    advancePaidPaise: booking.advancePaidPaise,
    outstandingPaise: booking.outstandingPaise,
    manageUrl: manageBookingUrl(),
  };
  const confirmation = bookingConfirmation(data);
  await enqueueNotification(
    {
      template: "booking_confirmation",
      to: booking.contactEmail,
      subject: confirmation.subject,
      text: confirmation.text,
      html: confirmation.html,
      payload: { bookingId: booking.id, reference },
      bookingId: booking.id,
      dedupeKey: `booking-confirmed:${booking.id}`,
    },
    tx,
  );
  if (input.receipt) {
    const receipt = paymentReceipt({
      guestName: booking.contactFullName,
      reference,
      amountPaise: input.receipt.amountPaise,
      paidAt: input.receipt.paidAt.toISOString(),
      outstandingPaise: booking.outstandingPaise,
    });
    await enqueueNotification(
      {
        template: "payment_receipt",
        to: booking.contactEmail,
        subject: receipt.subject,
        text: receipt.text,
        html: receipt.html,
        payload: { bookingId: booking.id, orderId: input.receipt.orderId },
        bookingId: booking.id,
        dedupeKey: `payment-receipt:${input.receipt.orderId}`,
      },
      tx,
    );
  }
  const staff = staffAlertEmail();
  if (staff) {
    const alert = staffNewBooking({
      reference,
      source: booking.source,
      guestName: booking.contactFullName,
      checkIn: dateOnly(booking.checkIn),
      checkOut: dateOnly(booking.checkOut),
      subtotalPaise: booking.subtotalPaise,
      advancePaidPaise: booking.advancePaidPaise,
      deskUrl: deskBookingUrl(booking.id),
    });
    await enqueueNotification(
      {
        template: "staff_new_booking",
        to: staff,
        subject: alert.subject,
        text: alert.text,
        html: alert.html,
        payload: { bookingId: booking.id, reference },
        bookingId: booking.id,
        dedupeKey: `staff-new-booking:${booking.id}`,
      },
      tx,
    );
  }
}

/** Money arrived that the system could not allocate. Staff must resolve it by hand. */
export async function notifyPaymentException(
  tx: Tx,
  input: { bookingId: string; reference: string | null; reason: string; amountPaise: number | null; dedupeKey: string },
): Promise<void> {
  const staff = staffAlertEmail();
  if (!staff) return;
  const alert = staffPaymentException({
    reference: input.reference,
    bookingId: input.bookingId,
    reason: input.reason,
    amountPaise: input.amountPaise,
    deskUrl: deskBookingUrl(input.bookingId),
  });
  await enqueueNotification(
    {
      template: "staff_payment_exception",
      to: staff,
      subject: alert.subject,
      text: alert.text,
      html: alert.html,
      payload: { bookingId: input.bookingId, reason: input.reason },
      bookingId: input.bookingId,
      dedupeKey: input.dedupeKey,
    },
    tx,
  );
}

export type MutationActorLabel = "guest" | "desk staff";

/** A confirmed booking was cancelled. The cancellation row must already exist in `tx`. */
export async function notifyBookingCancelled(
  tx: Tx,
  input: { bookingId: string; idempotencyKey: string; actor: MutationActorLabel },
): Promise<void> {
  const booking = await tx.booking.findUnique({
    where: { id: input.bookingId },
    select: { ...bookingSelect, cancellation: true },
  });
  if (!booking?.cancellation) return;
  const reference = requireReference(booking);
  const guest = bookingCancelled({
    guestName: booking.contactFullName,
    reference,
    checkIn: dateOnly(booking.checkIn),
    checkOut: dateOnly(booking.checkOut),
    deductionPaise: booking.cancellation.deductionPaise,
    refundablePaise: booking.cancellation.refundablePaise,
  });
  await enqueueNotification(
    {
      template: "booking_cancelled",
      to: booking.contactEmail,
      subject: guest.subject,
      text: guest.text,
      html: guest.html,
      payload: { bookingId: booking.id, cancellationId: booking.cancellation.id },
      bookingId: booking.id,
      dedupeKey: `booking-cancelled:${booking.id}:${input.idempotencyKey}`,
    },
    tx,
  );
  await enqueueStaff(tx, {
    template: "staff_booking_cancelled",
    ...staffBookingCancelled({
      reference,
      guestName: booking.contactFullName,
      actor: input.actor,
      deductionPaise: booking.cancellation.deductionPaise,
      refundablePaise: booking.cancellation.refundablePaise,
      deskUrl: deskBookingUrl(booking.id),
    }),
    bookingId: booking.id,
    dedupeKey: `staff-booking-cancelled:${booking.id}:${input.idempotencyKey}`,
  });
}

/** Guest composition or AC upgrade applied. Caller describes what changed. */
export async function notifyBookingAmended(
  tx: Tx,
  input: {
    bookingId: string;
    idempotencyKey: string;
    actor: MutationActorLabel;
    changeKind: string;
    summaryLines: string[];
  },
): Promise<void> {
  const booking = await loadBooking(tx, input.bookingId);
  if (!booking) return;
  const reference = requireReference(booking);
  const guest = bookingAmended({
    guestName: booking.contactFullName,
    reference,
    changeKind: input.changeKind,
    summaryLines: input.summaryLines,
    subtotalPaise: booking.subtotalPaise,
    outstandingPaise: booking.outstandingPaise,
    manageUrl: manageBookingUrl(),
  });
  await enqueueNotification(
    {
      template: "booking_amended",
      to: booking.contactEmail,
      subject: guest.subject,
      text: guest.text,
      html: guest.html,
      payload: { bookingId: booking.id, changeKind: input.changeKind },
      bookingId: booking.id,
      dedupeKey: `booking-amended:${booking.id}:${input.idempotencyKey}`,
    },
    tx,
  );
  await enqueueStaff(tx, {
    template: "staff_booking_modified",
    ...staffBookingModified({
      reference,
      guestName: booking.contactFullName,
      actor: input.actor,
      changeKind: input.changeKind,
      summaryLines: input.summaryLines,
      deskUrl: deskBookingUrl(booking.id),
    }),
    bookingId: booking.id,
    dedupeKey: `staff-booking-modified:${booking.id}:${input.idempotencyKey}`,
  });
}

/**
 * A refund was marked PROCESSED. Runs after the refund transaction committed (the
 * refund service is owned by another track), so failures are reported, never thrown.
 */
export async function notifyRefundProcessed(input: { cancellationId: string }): Promise<void> {
  try {
    const prisma = db() as unknown as Tx;
    const cancellation = await prisma.cancellation.findUnique({
      where: { id: input.cancellationId },
      include: { booking: { select: bookingSelect } },
    });
    if (!cancellation || cancellation.refundStatus !== "PROCESSED") return;
    const booking = cancellation.booking;
    const guest = refundProcessed({
      guestName: booking.contactFullName,
      reference: requireReference(booking),
      amountPaise: cancellation.actualRefundPaise ?? cancellation.refundablePaise,
      providerReference: cancellation.providerRefundReference ?? "recorded at the camp",
    });
    await enqueueNotification({
      template: "refund_processed",
      to: booking.contactEmail,
      subject: guest.subject,
      text: guest.text,
      html: guest.html,
      payload: { bookingId: booking.id, cancellationId: cancellation.id },
      bookingId: booking.id,
      dedupeKey: `refund-processed:${cancellation.id}`,
    });
  } catch (error) {
    reportError({
      kind: "notification.dead_letter",
      message: "Refund-processed mail could not be queued.",
      error,
      context: { cancellationId: input.cancellationId },
    });
  }
}
