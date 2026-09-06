import { describe, expect, it } from "vitest";
import { RefundStatus } from "@prisma/client";
import { toCustomerBooking } from "@/server/dto";

type CustomerRecord = Parameters<typeof toCustomerBooking>[0];

const processedAt = new Date("2026-09-05T08:30:00.000Z");
const stamp = new Date("2026-09-06T10:00:00.000Z");

function cancellationRecord(overrides: Record<string, unknown> = {}) {
  return {
    slabId: "within-48h",
    slabLabel: "Within 48 hours",
    hoursUntilCheckIn: 30,
    advancePaidPaise: 3000,
    deductionBasisPoints: 5000,
    deductionPaise: 1500,
    refundablePaise: 1500,
    refundStatus: RefundStatus.PENDING_HOTEL_REVIEW,
    actualRefundPaise: null,
    providerRefundReference: null,
    cancelledAt: stamp,
    approvedAt: null,
    processedAt: null,
    ...overrides,
  };
}

function bookingRecord(cancellation: ReturnType<typeof cancellationRecord> | null = null): CustomerRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    reference: "HD-ABC123",
    status: "CANCELLED",
    checkIn: new Date("2026-12-10T00:00:00.000Z"),
    checkOut: new Date("2026-12-12T00:00:00.000Z"),
    contactFullName: "Refund Guest",
    contactPhoneE164: "+919876500099",
    contactEmail: "guest@example.com",
    adults: 1,
    childrenUnder5: 0,
    children5To10: 0,
    nights: 2,
    subtotalPaise: 10_000,
    advanceBasisPoints: 3000,
    advanceDuePaise: 3000,
    advancePaidPaise: 3000,
    outstandingPaise: 0,
    rooms: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        roomGroupId: "single-bed",
        acMode: "NON_AC",
        adults: 1,
        childrenUnder5: 0,
        children5To10: 0,
        physicalOccupancy: 1,
        billingHalfUnits: 2,
        tariffOccupancy: 1,
        ratePerPersonPaise: 5000,
        nightlyTotalPaise: 5000,
        nights: 2,
        stayTotalPaise: 10_000,
      },
    ],
    cancellation,
    createdAt: stamp,
    updatedAt: stamp,
  } as unknown as CustomerRecord;
}

describe("customer refund visibility", () => {
  it.each([RefundStatus.PENDING_HOTEL_REVIEW, RefundStatus.APPROVED, RefundStatus.PROCESSING])(
    "hides the refund receipt while the status is %s",
    (refundStatus) => {
      const dto = toCustomerBooking(bookingRecord(cancellationRecord({ refundStatus })));
      expect(dto.paymentStatus).toBe("refund_pending_hotel");
      expect(dto.cancellationQuote).toBeDefined();
      expect(dto.cancellationQuote?.refundable).toBe(15);
      expect("refund" in (dto.cancellationQuote ?? {})).toBe(false);
    },
  );

  it("hides the receipt for rejected and not-required refunds", () => {
    for (const refundStatus of [RefundStatus.REJECTED, RefundStatus.NOT_REQUIRED]) {
      const dto = toCustomerBooking(bookingRecord(cancellationRecord({ refundStatus })));
      expect(dto.paymentStatus).toBe("refund_pending_hotel");
      expect("refund" in (dto.cancellationQuote ?? {})).toBe(false);
    }
  });

  it("never leaks a stored reference before the refund is processed", () => {
    const dto = toCustomerBooking(
      bookingRecord(
        cancellationRecord({ refundStatus: RefundStatus.APPROVED, providerRefundReference: "123456789012" }),
      ),
    );
    expect(JSON.stringify(dto)).not.toContain("123456789012");
  });

  it("exposes actual refund, processed date and RRN once processed", () => {
    const dto = toCustomerBooking(
      bookingRecord(
        cancellationRecord({
          refundStatus: RefundStatus.PROCESSED,
          actualRefundPaise: 1400,
          providerRefundReference: "123456789012",
          processedAt,
        }),
      ),
    );
    expect(dto.paymentStatus).toBe("refunded");
    expect(dto.cancellationQuote?.refund).toEqual({
      actualRefund: 14,
      processedAt: processedAt.toISOString(),
      reference: "123456789012",
    });
  });

  it("falls back to the refundable total when no actual amount was recorded", () => {
    const dto = toCustomerBooking(
      bookingRecord(cancellationRecord({ refundStatus: RefundStatus.PROCESSED })),
    );
    expect(dto.paymentStatus).toBe("refunded");
    expect(dto.cancellationQuote?.refund).toEqual({
      actualRefund: 15,
      processedAt: null,
      reference: null,
    });
  });

  it("omits the cancellation quote entirely without a cancellation", () => {
    const dto = toCustomerBooking(bookingRecord(null));
    expect(dto.paymentStatus).toBe("balance_due_at_hotel");
    expect(dto.cancellationQuote).toBeUndefined();
  });
});
