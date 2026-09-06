import { describe, expect, it } from "vitest";
import { hotel } from "@/data/hotel";
import { formatTimeLabel } from "@/lib/dates";
import { formatInr } from "@/lib/format";
import type { BookedRoom, Booking } from "@/types";
import {
  MAX_VOUCHER_PAGES,
  OVERFLOW_NOTE,
  buildVoucherLines,
  buildVoucherPdf,
  countVoucherPdfPages,
  sanitizePdfText,
  toVoucherResponse,
} from "@/server/voucher/voucher";

function roomFixture(index: number): BookedRoom {
  return {
    id: `33333333-3333-4333-8333-33333333333${index}`,
    roomGroupId: "single-bed",
    acMode: "ac",
    composition: { adults: 2, childrenUnder5: 0, children5to10: 1 },
    physicalOccupancy: 3,
    tariffOccupancy: 3,
    assignedPhysicalRoomNumber: null,
    pricing: {
      roomGroupId: "single-bed",
      acMode: "ac",
      physicalOccupancy: 3,
      tariffOccupancy: 3,
      composition: { adults: 2, childrenUnder5: 0, children5to10: 1 },
      tariffPerPerson: 2500,
      billableUnits: 2.5,
      nightlyTotal: 6250,
      nights: 2,
      stayTotal: 12500,
    },
  };
}

function bookingFixture(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    reference: "HD-VOUCH1",
    isDemo: false,
    status: "confirmed",
    paymentStatus: "balance_due_at_hotel",
    checkIn: "2026-12-10",
    checkOut: "2026-12-12",
    composition: { adults: 2, childrenUnder5: 0, children5to10: 1 },
    contact: { fullName: "Voucher Guest", phone: "+917980841770", email: "guest@example.com" },
    rooms: [roomFixture(1)],
    pricing: {
      rooms: [],
      nights: 2,
      subtotal: 12500,
      advancePercent: 30,
      advance: 3750,
      balance: 8750,
    },
    advancePaid: 3750,
    outstanding: 8750,
    createdAt: "2026-09-06T10:00:00.000Z",
    updatedAt: "2026-09-06T10:00:00.000Z",
    ...overrides,
  };
}

function cancelledFixture(): Booking {
  return bookingFixture({
    status: "cancelled",
    paymentStatus: "refunded",
    outstanding: 0,
    cancellationQuote: {
      slab: {
        id: "within-48h",
        maxHoursBeforeCheckIn: 48,
        deductionPercent: 50,
        label: "Within 48 hours",
        explanation: "Any refund is reviewed and processed by Honey Dew Beach Camp.",
      },
      hoursUntilCheckIn: 30,
      advancePaid: 3750,
      deductionPercent: 50,
      charge: 1875,
      refundable: 1875,
      refundControlledByHotel: true,
      refund: { actualRefund: 1875, processedAt: "2026-09-05T08:30:00.000Z", reference: "123456789012" },
    },
  });
}

function pdfText(pdf: Uint8Array): string {
  return new TextDecoder("latin1").decode(pdf);
}

describe("voucher content", () => {
  it("carries reference, guest, dates with times, rooms, and amounts", () => {
    const booking = bookingFixture();
    const text = buildVoucherLines(booking).join("\n");
    expect(text).toContain("HD-VOUCH1");
    expect(text).toContain("Voucher Guest");
    expect(text).toContain("+917980841770");
    expect(text).toContain("guest@example.com");
    expect(text).toContain(formatTimeLabel(hotel.checkInTime));
    expect(text).toContain(formatTimeLabel(hotel.checkOutTime));
    expect(text).toContain("Single-Bed Room");
    expect(text).toContain(formatInr(12500));
    expect(text).toContain(formatInr(3750));
    expect(text).toContain(formatInr(8750));
    expect(text).toContain("Balance due at the hotel");
  });

  it("carries support contacts, hours, and the ID reminder", () => {
    const text = buildVoucherLines(bookingFixture()).join("\n");
    expect(text).toContain(hotel.email);
    expect(text).toContain(hotel.supportHours);
    for (const phone of hotel.phones) expect(text).toContain(phone.display);
    expect(text).toContain(hotel.idProof);
  });

  it("omits the cancellation section when the stay is not cancelled", () => {
    const text = buildVoucherLines(bookingFixture()).join("\n");
    expect(text).not.toContain("Cancellation");
    expect(text).not.toContain("RRN");
  });

  it("carries the slab, refund amount, and RRN once a refund is processed", () => {
    const text = buildVoucherLines(cancelledFixture()).join("\n");
    expect(text).toContain("Within 48 hours");
    expect(text).toContain(formatInr(1875));
    expect(text).toContain("123456789012");
    expect(text).toContain("Refunded");
  });
});

describe("voucher PDF envelope", () => {
  it("returns a downloadable PDF response for the route handlers", async () => {
    const response = toVoucherResponse(bookingFixture());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="voucher-HD-VOUCH1.pdf"');
    expect(response.headers.get("cache-control")).toBe("no-store");
    const pdf = new Uint8Array(await response.arrayBuffer());
    expect(pdfText(pdf).startsWith("%PDF")).toBe(true);
    expect(pdfText(pdf)).toContain("HD-VOUCH1");
    expect(countVoucherPdfPages(pdf)).toBeLessThanOrEqual(MAX_VOUCHER_PAGES);
    expect(response.headers.get("x-voucher-pages")).toBe(String(countVoucherPdfPages(pdf)));
  });

  it("keeps every byte ASCII so Helvetica literal strings stay valid", () => {
    expect(sanitizePdfText("₹3,750 – confirmed")).toBe("Rs. 3,750 - confirmed");
    const pdf = buildVoucherPdf(["₹ check – “quoted” (note) \\ done"]);
    const text = pdfText(pdf);
    expect(text).toContain("Rs.  check -");
    for (const byte of pdf) expect(byte).toBeLessThan(128);
  });
});

describe("voucher 2-page limit", () => {
  it("never exceeds 2 pages even for a very large party", () => {
    const rooms = Array.from({ length: 60 }, (_, index) => roomFixture(index % 10));
    const pdf = buildVoucherPdf(buildVoucherLines(bookingFixture({ rooms })));
    expect(countVoucherPdfPages(pdf)).toBeLessThanOrEqual(MAX_VOUCHER_PAGES);
    expect(countVoucherPdfPages(pdf)).toBe(MAX_VOUCHER_PAGES);
    expect(pdfText(pdf)).toContain("Further room detail omitted to keep this voucher to 2 pages.");
    // The reference still survives truncation on page one.
    expect(pdfText(pdf)).toContain("HD-VOUCH1");
  });

  it("fits a normal booking without the overflow note", () => {
    const pdf = buildVoucherPdf(buildVoucherLines(cancelledFixture()));
    expect(countVoucherPdfPages(pdf)).toBeLessThanOrEqual(MAX_VOUCHER_PAGES);
    expect(pdfText(pdf)).not.toContain(sanitizePdfText(OVERFLOW_NOTE));
  });
});
