import { describe, expect, it } from "vitest";
import { toCustomerBooking, toPaymentException } from "@/server/dto";

type CustomerRecord = Parameters<typeof toCustomerBooking>[0];

const stamp = new Date("2026-09-06T10:00:00.000Z");

function bookingRecord(payments: CustomerRecord["payments"]): CustomerRecord {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    reference: "HD-PAID99",
    status: "CONFIRMED",
    checkIn: new Date("2026-12-10T00:00:00.000Z"),
    checkOut: new Date("2026-12-12T00:00:00.000Z"),
    contactFullName: "Paid Guest",
    contactPhoneE164: "+919876500011",
    contactEmail: "paid@example.com",
    adults: 1,
    childrenUnder5: 0,
    children5To10: 0,
    nights: 2,
    subtotalPaise: 10_000,
    advanceBasisPoints: 3000,
    advanceDuePaise: 3000,
    advancePaidPaise: 0,
    outstandingPaise: 10_000,
    rooms: [
      {
        id: "44444444-4444-4444-8444-444444444444",
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
    cancellation: null,
    payments,
    createdAt: stamp,
    updatedAt: stamp,
  } as unknown as CustomerRecord;
}

describe("toPaymentException", () => {
  it("returns undefined without unallocated orders", () => {
    expect(toPaymentException(undefined)).toBeUndefined();
    expect(toPaymentException(null)).toBeUndefined();
    expect(toPaymentException([])).toBeUndefined();
  });

  it("maps the latest unallocated order to rupees and an ISO timestamp", () => {
    const paidAt = new Date("2026-09-06T09:41:00.000Z");
    expect(toPaymentException([{ amountPaise: 3000, createdAt: paidAt }])).toEqual({
      state: "paid_unallocated",
      amountPaid: 30,
      paidAt: paidAt.toISOString(),
    });
  });
});

describe("guest-visible paid-unallocated state", () => {
  it("exposes the recorded payment on the booking without changing money fields", () => {
    const paidAt = new Date("2026-09-06T09:41:00.000Z");
    const dto = toCustomerBooking(
      bookingRecord([{ amountPaise: 3000, currency: "INR", createdAt: paidAt }]),
    );
    expect(dto.paymentException).toEqual({
      state: "paid_unallocated",
      amountPaid: 30,
      paidAt: paidAt.toISOString(),
    });
    // The booking is still unconfirmed money-wise: no advance recorded, balance intact.
    expect(dto.advancePaid).toBe(0);
    expect(dto.outstanding).toBe(100);
    expect(dto.status).toBe("confirmed");
  });

  it("omits the key entirely when every order allocated cleanly", () => {
    const dto = toCustomerBooking(bookingRecord([]));
    expect("paymentException" in dto).toBe(false);
  });
});
