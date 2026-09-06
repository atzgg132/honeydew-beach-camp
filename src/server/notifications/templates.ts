import { formatInrPaise } from "@/lib/format";

/**
 * Email templates for every message the outbox can send.
 *
 * Pure functions: given data they return `{ subject, text, html }` and touch nothing
 * else. That keeps content testable without sending mail and lets the worker render at
 * enqueue time, so a later template change cannot rewrite history already queued.
 *
 * Every interpolated value is HTML-escaped in the `html` variant. Amounts render from
 * integer paise through the shared formatter, never from floating rupees.
 */

export const GUEST_TEMPLATES = [
  "booking_confirmation",
  "payment_receipt",
  "booking_amended",
  "booking_cancelled",
  "refund_processed",
] as const;

export const STAFF_TEMPLATES = [
  "staff_new_booking",
  "staff_booking_cancelled",
  "staff_booking_modified",
  "staff_payment_exception",
  "staff_contact_enquiry",
] as const;

export const NOTIFICATION_TEMPLATES = [...GUEST_TEMPLATES, ...STAFF_TEMPLATES] as const;

export type NotificationTemplate = (typeof NOTIFICATION_TEMPLATES)[number];

export function isNotificationTemplate(value: string): value is NotificationTemplate {
  return (NOTIFICATION_TEMPLATES as readonly string[]).includes(value);
}

export interface RenderedNotification {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render(subject: string, heading: string, lines: string[], closing: string): RenderedNotification {
  const text = [`Honeydew Beach Camp — ${heading}`, "", ...lines, "", closing].join("\n");
  const html = [
    `<p>Honeydew Beach Camp — ${escapeHtml(heading)}</p>`,
    "<ul>",
    ...lines.map((line) => `<li>${escapeHtml(line)}</li>`),
    "</ul>",
    `<p>${escapeHtml(closing)}</p>`,
  ].join("\n");
  return { subject, text, html };
}

function stayLine(checkIn: string, checkOut: string, nights: number): string {
  return `Stay: ${checkIn} to ${checkOut} (${nights} night${nights === 1 ? "" : "s"})`;
}

export interface BookingConfirmationData {
  guestName: string;
  reference: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomLines: string[];
  subtotalPaise: number;
  advancePaidPaise: number;
  outstandingPaise: number;
  manageUrl: string;
}

export function bookingConfirmation(data: BookingConfirmationData): RenderedNotification {
  return render(
    `Booking confirmed — ${data.reference}`,
    `Dear ${data.guestName}, your stay is confirmed.`,
    [
      `Booking reference: ${data.reference}`,
      stayLine(data.checkIn, data.checkOut, data.nights),
      ...data.roomLines,
      `Stay total: ${formatInrPaise(data.subtotalPaise)}`,
      `Advance paid: ${formatInrPaise(data.advancePaidPaise)}`,
      `Payable at the camp: ${formatInrPaise(data.outstandingPaise)}`,
      `Manage this booking: ${data.manageUrl}`,
    ],
    "Reply to this email or call the camp for changes. See you at the beach.",
  );
}

export interface PaymentReceiptData {
  guestName: string;
  reference: string;
  amountPaise: number;
  paidAt: string;
  outstandingPaise: number;
}

export function paymentReceipt(data: PaymentReceiptData): RenderedNotification {
  return render(
    `Payment receipt — ${data.reference}`,
    `Dear ${data.guestName}, we received your payment.`,
    [
      `Booking reference: ${data.reference}`,
      `Amount received: ${formatInrPaise(data.amountPaise)}`,
      `Received at: ${data.paidAt}`,
      `Still payable at the camp: ${formatInrPaise(data.outstandingPaise)}`,
    ],
    "Keep this receipt for your records. The balance, if any, is payable at the camp.",
  );
}

export interface BookingAmendedData {
  guestName: string;
  reference: string;
  changeKind: string;
  summaryLines: string[];
  subtotalPaise: number;
  outstandingPaise: number;
  manageUrl: string;
}

export function bookingAmended(data: BookingAmendedData): RenderedNotification {
  return render(
    `Booking updated — ${data.reference}`,
    `Dear ${data.guestName}, your booking was updated (${data.changeKind}).`,
    [
      `Booking reference: ${data.reference}`,
      ...data.summaryLines,
      `Revised stay total: ${formatInrPaise(data.subtotalPaise)}`,
      `Payable at the camp: ${formatInrPaise(data.outstandingPaise)}`,
      `Manage this booking: ${data.manageUrl}`,
    ],
    "If you did not request this change, call the camp right away.",
  );
}

export interface BookingCancelledData {
  guestName: string;
  reference: string;
  checkIn: string;
  checkOut: string;
  deductionPaise: number;
  refundablePaise: number;
}

export function bookingCancelled(data: BookingCancelledData): RenderedNotification {
  const refundLine =
    data.refundablePaise > 0
      ? `Refundable to you: ${formatInrPaise(data.refundablePaise)}. The camp processes refunds to the original payment method.`
      : "No refund is due on this cancellation.";
  return render(
    `Booking cancelled — ${data.reference}`,
    `Dear ${data.guestName}, your booking was cancelled.`,
    [
      `Booking reference: ${data.reference}`,
      `Stay was: ${data.checkIn} to ${data.checkOut}`,
      `Cancellation deduction: ${formatInrPaise(data.deductionPaise)}`,
      refundLine,
    ],
    "We hope to host you another time.",
  );
}

export interface RefundProcessedData {
  guestName: string;
  reference: string;
  amountPaise: number;
  providerReference: string;
}

export function refundProcessed(data: RefundProcessedData): RenderedNotification {
  return render(
    `Refund processed — ${data.reference}`,
    `Dear ${data.guestName}, your refund was processed.`,
    [
      `Booking reference: ${data.reference}`,
      `Amount returned: ${formatInrPaise(data.amountPaise)}`,
      `Refund reference: ${data.providerReference}`,
    ],
    "The amount reaches the original payment method within 5 to 7 working days, depending on your bank.",
  );
}

export interface StaffNewBookingData {
  reference: string;
  source: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  subtotalPaise: number;
  advancePaidPaise: number;
  deskUrl: string;
}

export function staffNewBooking(data: StaffNewBookingData): RenderedNotification {
  return render(
    `New booking ${data.reference} (${data.source})`,
    "A new booking needs no action unless the desk queue says otherwise.",
    [
      `Reference: ${data.reference}`,
      `Source: ${data.source}`,
      `Guest: ${data.guestName}`,
      `Stay: ${data.checkIn} to ${data.checkOut}`,
      `Stay total: ${formatInrPaise(data.subtotalPaise)}`,
      `Advance paid: ${formatInrPaise(data.advancePaidPaise)}`,
      `Open in the desk: ${data.deskUrl}`,
    ],
    "Verify the stay in the desk if anything looks unusual.",
  );
}

export interface StaffBookingCancelledData {
  reference: string;
  guestName: string;
  actor: string;
  deductionPaise: number;
  refundablePaise: number;
  deskUrl: string;
}

export function staffBookingCancelled(data: StaffBookingCancelledData): RenderedNotification {
  return render(
    `Booking cancelled ${data.reference}`,
    `Cancelled by ${data.actor}.`,
    [
      `Reference: ${data.reference}`,
      `Guest: ${data.guestName}`,
      `Deduction: ${formatInrPaise(data.deductionPaise)}`,
      `Refundable: ${formatInrPaise(data.refundablePaise)}`,
      `Open in the desk: ${data.deskUrl}`,
    ],
    data.refundablePaise > 0 ? "Review the refund in the desk refunds queue." : "No refund is due.",
  );
}

export interface StaffBookingModifiedData {
  reference: string;
  guestName: string;
  actor: string;
  changeKind: string;
  summaryLines: string[];
  deskUrl: string;
}

export function staffBookingModified(data: StaffBookingModifiedData): RenderedNotification {
  return render(
    `Booking modified ${data.reference} (${data.changeKind})`,
    `Changed by ${data.actor}.`,
    [
      `Reference: ${data.reference}`,
      `Guest: ${data.guestName}`,
      ...data.summaryLines,
      `Open in the desk: ${data.deskUrl}`,
    ],
    "Check the stay in the desk if the change needs follow-up.",
  );
}

export interface StaffPaymentExceptionData {
  reference: string | null;
  bookingId: string;
  reason: string;
  amountPaise: number | null;
  deskUrl: string;
}

export interface StaffContactEnquiryData {
  guestName: string;
  phone: string;
  email: string;
  message: string;
}

export function staffContactEnquiry(data: StaffContactEnquiryData): RenderedNotification {
  const replyLine =
    [data.phone, data.email].filter((part) => part.length > 0).join(" · ") || "no contact left";
  return render(
    `Website enquiry from ${data.guestName}`,
    `A guest wrote from the contact page. Reply at: ${replyLine}.`,
    [
      `Name: ${data.guestName}`,
      `Phone: ${data.phone || "—"}`,
      `Email: ${data.email || "—"}`,
      `Message: ${data.message}`,
    ],
    "Reply within two business days, sooner when dates are mentioned.",
  );
}

export function staffPaymentException(data: StaffPaymentExceptionData): RenderedNotification {
  return render(
    `Payment needs review ${data.reference ?? data.bookingId}`,
    "Money arrived that the system could not allocate by itself.",
    [
      `Booking: ${data.reference ?? data.bookingId}`,
      `Reason: ${data.reason}`,
      ...(data.amountPaise !== null ? [`Amount: ${formatInrPaise(data.amountPaise)}`] : []),
      `Open in the desk: ${data.deskUrl}`,
    ],
    "Resolve from the payment exception in the desk: reallocate a room or record the refund.",
  );
}
