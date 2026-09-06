import { copy } from "@/data/copy";
import { hotel } from "@/data/hotel";
import { getRoomGroup } from "@/data/rooms";
import { formatDisplayDate, formatIstDateTime, formatTimeLabel } from "@/lib/dates";
import { formatInr } from "@/lib/format";
import type { Booking } from "@/types";

/**
 * Booking voucher PDF (Track 3).
 *
 * Dependency-light by design: the PDF is assembled by hand as minimal PDF 1.4
 * (Helvetica only, no images) instead of adding a PDF library. The voucher is
 * plain text lines, so a tiny writer is sufficient and keeps `package.json`
 * untouched.
 */

export const MAX_VOUCHER_PAGES = 2;
export const VOUCHER_LINES_PER_PAGE = 46;

export const OVERFLOW_NOTE = "(Further room detail omitted to keep this voucher to 2 pages.)";

/** Labels mirror StatusBadge so the voucher reads like the on-screen folio. */
const bookingLabel: Record<Booking["status"], string> = {
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Stay completed",
};

const paymentLabel: Record<Booking["paymentStatus"], string> = {
  advance_paid: "Advance recorded",
  balance_due_at_hotel: "Balance due at the hotel",
  refund_pending_hotel: "Refund with the hotel",
  refunded: "Refunded",
};

function compositionLine(booking: Booking): string {
  const parts = [`${booking.composition.adults} adults`];
  if (booking.composition.childrenUnder5 > 0) parts.push(`${booking.composition.childrenUnder5} under 5`);
  if (booking.composition.children5to10 > 0) parts.push(`${booking.composition.children5to10} aged 5-10`);
  return parts.join(", ");
}

function roomLine(room: Booking["rooms"][number], index: number): string {
  const group = getRoomGroup(room.roomGroupId)?.publicName ?? room.roomGroupId;
  const ac = room.acMode === "ac" ? "AC" : "Non-AC";
  const guests = room.physicalOccupancy === 1 ? "1 guest" : `${room.physicalOccupancy} guests`;
  return (
    `Room ${index + 1}: ${group} (${ac}), ${guests} - ` +
    `${formatInr(room.pricing.tariffPerPerson)} per person/night x ${room.pricing.nights} nights = ` +
    formatInr(room.pricing.stayTotal)
  );
}

/** Every content field the voucher must carry, as plain printable lines. */
export function buildVoucherLines(booking: Booking): string[] {
  const lines: string[] = [
    `${hotel.name} - Booking Voucher`,
    `Reference: ${booking.reference}`,
    `Status: ${bookingLabel[booking.status]} | Payment: ${paymentLabel[booking.paymentStatus]}`,
    "",
    "Guest",
    `Name: ${booking.contact.fullName}`,
    `Phone: ${booking.contact.phone}`,
    `Email: ${booking.contact.email}`,
    `Guests: ${compositionLine(booking)}`,
    "",
    "Stay",
    `Check-in: ${formatDisplayDate(booking.checkIn)} at ${formatTimeLabel(hotel.checkInTime)}`,
    `Check-out: ${formatDisplayDate(booking.checkOut)} at ${formatTimeLabel(hotel.checkOutTime)}`,
    `Nights: ${booking.pricing.nights}`,
    "",
    "Rooms",
    ...booking.rooms.map((room, index) => roomLine(room, index)),
    "",
    "Amounts",
    `Stay total: ${formatInr(booking.pricing.subtotal)}`,
    `Advance paid: ${formatInr(booking.advancePaid)}`,
    `Outstanding (payable at the hotel): ${formatInr(booking.outstanding)}`,
  ];

  if (booking.cancellationQuote) {
    const quote = booking.cancellationQuote;
    lines.push(
      "",
      "Cancellation",
      `Slab: ${quote.slab.label}`,
      `Cancellation charge: ${formatInr(quote.charge)} | Refundable: ${formatInr(quote.refundable)}`,
    );
    if (quote.refund) {
      lines.push(
        `Refund processed: ${formatInr(quote.refund.actualRefund)}` +
          (quote.refund.processedAt ? ` on ${formatIstDateTime(quote.refund.processedAt)}` : "") +
          `. RRN: ${quote.refund.reference ?? "not recorded"}`,
      );
    }
  }

  lines.push(
    "",
    "Support",
    ...hotel.phones.map((phone) => `Phone: +91 ${phone.display}`),
    `Email: ${hotel.email}`,
    `Support hours: ${hotel.supportHours}`,
    hotel.responseNote,
    hotel.addressLines.join(", "),
    "",
    "Good to know",
    copy.mealsIncluded,
    copy.datesLocked,
    copy.idReminder,
  );

  return lines;
}

/**
 * WinAnsi (PDF Helvetica) cannot encode characters such as the rupee sign or
 * en-dashes, so normalize to ASCII before writing literal strings.
 */
export function sanitizePdfText(value: string): string {
  return value
    .replace(/₹/g, "Rs. ")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, "-")
    .replace(/[^\x20-\x7E]/g, "");
}

function escapePdfText(value: string): string {
  return sanitizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Minimal single-font PDF writer. Lines are paginated at
 * VOUCHER_LINES_PER_PAGE; anything beyond MAX_VOUCHER_PAGES is dropped and the
 * overflow note takes the final line, so the output can never exceed 2 pages.
 */
export function buildVoucherPdf(lines: string[]): Uint8Array {
  const capacity = VOUCHER_LINES_PER_PAGE * MAX_VOUCHER_PAGES;
  let fitted = lines.slice(0, capacity);
  if (lines.length > capacity) {
    fitted = [...lines.slice(0, capacity - 1), OVERFLOW_NOTE];
  }

  const pages: string[][] = [];
  for (let index = 0; index < fitted.length; index += VOUCHER_LINES_PER_PAGE) {
    pages.push(fitted.slice(index, index + VOUCHER_LINES_PER_PAGE));
  }
  if (pages.length === 0) pages.push([""]);

  const objects: string[] = [];
  const pageRefs: number[] = [];
  // Object 1: catalog, object 2: pages directory (filled in after page refs known).
  let nextId = 3;
  const fontId = nextId++;
  objects[fontId] = `${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  const contentIds: number[] = [];
  const pageIds: number[] = [];

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const text = page
      .map((line, lineIndex) => {
        const y = 792 - lineIndex * 14.5;
        return `BT /F1 11 Tf 50 ${y.toFixed(1)} Td (${escapePdfText(line)}) Tj ET`;
      })
      .join("\n");
    const footer = `BT /F1 9 Tf 50 32 Td (Page ${pageIndex + 1} of ${pages.length} - ${escapePdfText(hotel.name)}) Tj ET`;
    const stream = `${text}\n${footer}\n`;
    const contentId = nextId++;
    contentIds.push(contentId);
    objects[contentId] =
      `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`;
    const pageId = nextId++;
    pageIds.push(pageId);
    pageRefs.push(pageId);
  }

  for (let i = 0; i < pageIds.length; i += 1) {
    const pageId = pageIds[i];
    objects[pageId] =
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentIds[i]} 0 R >>\nendobj\n`;
  }

  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageRefs.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageRefs.length} >>\nendobj\n`;

  const header = "%PDF-1.4\n";
  const ordered: string[] = [];
  for (let id = 1; id < nextId; id += 1) ordered.push(objects[id]);
  const offsets: number[] = [];
  let cursor = header.length;
  for (const body of ordered) {
    offsets.push(cursor);
    cursor += body.length;
  }
  const xrefAt = cursor;
  const xref = [
    "xref",
    `0 ${nextId}`,
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
  ].join("\n");
  const trailer =
    `\ntrailer\n<< /Size ${nextId} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new TextEncoder().encode(`${header}${ordered.join("")}${xref}${trailer}`);
}

/** Counts rendered pages by the PDF page-object markers (excludes /Pages). */
export function countVoucherPdfPages(pdf: Uint8Array): number {
  const text = new TextDecoder("latin1").decode(pdf);
  return (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
}

function voucherFilename(reference: string): string {
  const safe = reference.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "booking";
  return `voucher-${safe}.pdf`;
}

/** Shared responder for both voucher routes: PDF bytes + download headers. */
export function toVoucherResponse(booking: Booking): Response {
  const pdf = buildVoucherPdf(buildVoucherLines(booking));
  const pages = countVoucherPdfPages(pdf);
  // Undici accepts Uint8Array bodies at runtime; the DOM lib's BodyInit union
  // in this TS version does not name the generic instantiation, hence the cast.
  return new Response(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${voucherFilename(booking.reference)}"`,
      "cache-control": "no-store",
      "x-voucher-pages": String(pages),
    },
  });
}
