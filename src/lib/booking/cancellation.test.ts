import { describe, expect, it } from "vitest";
import { quoteCancellation, slabForHours } from "@/lib/booking/cancellation";
import { istDateTime } from "@/lib/dates";

describe("cancellation slabs", () => {
  it("uses 100% within 24 hours", () => {
    expect(slabForHours(24).deductionPercent).toBe(100);
    expect(slabForHours(0).deductionPercent).toBe(100);
  });

  it("uses 50% after 24 and through 48 hours", () => {
    expect(slabForHours(24.01).deductionPercent).toBe(50);
    expect(slabForHours(48).deductionPercent).toBe(50);
  });

  it("uses 30% through 7 days", () => {
    expect(slabForHours(48.01).deductionPercent).toBe(30);
    expect(slabForHours(7 * 24).deductionPercent).toBe(30);
  });

  it("uses 20% through 15 days", () => {
    expect(slabForHours(7 * 24 + 0.01).deductionPercent).toBe(20);
    expect(slabForHours(15 * 24).deductionPercent).toBe(20);
  });

  it("uses 10% through 30 days", () => {
    expect(slabForHours(15 * 24 + 0.01).deductionPercent).toBe(10);
    expect(slabForHours(30 * 24).deductionPercent).toBe(10);
  });

  it("uses 0% beyond 30 days", () => {
    expect(slabForHours(30 * 24 + 0.01).deductionPercent).toBe(0);
  });
});

describe("11:00 Asia/Kolkata threshold", () => {
  const checkIn = "2026-12-20";
  const checkInInstant = istDateTime(checkIn, "11:00");

  it("treats exactly 24 hours before 11:00 IST as the 100% slab", () => {
    const now = new Date(checkInInstant.getTime() - 24 * 3600_000);
    const quote = quoteCancellation({ checkIn, advancePaid: 1000, now });
    expect(quote.deductionPercent).toBe(100);
    expect(quote.refundable).toBe(0);
  });

  it("treats 24 hours and 1 ms before 11:00 IST as the 50% slab", () => {
    const now = new Date(checkInInstant.getTime() - 24 * 3600_000 - 1);
    const quote = quoteCancellation({ checkIn, advancePaid: 1000, now });
    expect(quote.deductionPercent).toBe(50);
    expect(quote.charge).toBe(500);
    expect(quote.refundable).toBe(500);
  });

  it("does not depend on the host timezone offset of the Date object", () => {
    const now = new Date("2026-11-01T00:00:00.000Z");
    const quote = quoteCancellation({ checkIn, advancePaid: 2000, now });
    expect(quote.deductionPercent).toBe(0);
    expect(quote.refundable).toBe(2000);
  });
});
