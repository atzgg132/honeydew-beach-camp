import { describe, expect, it } from "vitest";
import { priceBookingPaise, roundBasisPoints } from "@/domain/booking/pricing";
import { quoteCancellationPaise } from "@/domain/booking/cancellation";

const rates = [
  { roomGroupId: "single-bed", tariffOccupancy: 1, acMode: "ac" as const, ratePerPersonPaise: 149_900 },
  { roomGroupId: "single-bed", tariffOccupancy: 2, acMode: "ac" as const, ratePerPersonPaise: 149_900 },
  { roomGroupId: "single-bed", tariffOccupancy: 3, acMode: "ac" as const, ratePerPersonPaise: 139_900 },
];

describe("server-authoritative paise pricing", () => {
  it("uses the one-guest tier for one guest", () => {
    const priced = priceBookingPaise(
      {
        checkIn: "2026-12-10",
        checkOut: "2026-12-11",
        composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
        rooms: [
          {
            clientId: "room-1",
            roomGroupId: "single-bed",
            acMode: "ac",
            composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
          },
        ],
      },
      rates,
      3000,
    );
    expect(priced.subtotalPaise).toBe(149_900);
    expect(priced.advancePaise).toBe(44_970);
  });

  it("charges a 5-10 child as one half-unit without floating point", () => {
    const priced = priceBookingPaise(
      {
        checkIn: "2026-12-10",
        checkOut: "2026-12-11",
        composition: { adults: 2, childrenUnder5: 0, children5to10: 1 },
        rooms: [
          {
            clientId: "room-1",
            roomGroupId: "single-bed",
            acMode: "ac",
            composition: { adults: 2, childrenUnder5: 0, children5to10: 1 },
          },
        ],
      },
      rates,
      3000,
    );
    expect(priced.rooms[0].billingHalfUnits).toBe(5);
    expect(priced.subtotalPaise).toBe(349_750);
  });

  it("rounds basis-point calculations half-up", () => {
    expect(roundBasisPoints(101, 5000)).toBe(51);
  });
});

describe("server cancellation money", () => {
  it("deducts from advance paid, not total", () => {
    expect(quoteCancellationPaise(72, 100_000)).toMatchObject({
      slabId: "within-7d",
      deductionPaise: 30_000,
      refundablePaise: 70_000,
    });
  });

  it.each([
    [24, 10_000],
    [24.000_001, 5_000],
    [48, 5_000],
    [48.000_001, 3_000],
    [7 * 24, 3_000],
    [7 * 24 + 0.000_001, 2_000],
    [15 * 24, 2_000],
    [15 * 24 + 0.000_001, 1_000],
    [30 * 24, 1_000],
    [30 * 24 + 0.000_001, 0],
  ])("uses the exact policy boundary at %s hours", (hours, expectedBasisPoints) => {
    expect(quoteCancellationPaise(hours, 100_000).deductionBasisPoints).toBe(expectedBasisPoints);
  });
});
