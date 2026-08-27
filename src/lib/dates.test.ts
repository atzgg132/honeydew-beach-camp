import { describe, expect, it } from "vitest";
import { hoursUntilIst, istDateTime, nightsBetween, todayIstDate } from "@/lib/dates";

describe("date-only nights", () => {
  it("treats checkout as exclusive", () => {
    expect(nightsBetween("2026-03-31", "2026-04-02")).toBe(2);
  });

  it("returns 0 for incomplete dates", () => {
    expect(nightsBetween("", "")).toBe(0);
  });
});

describe("IST clock", () => {
  it("places 11:00 IST at 05:30 UTC", () => {
    const instant = istDateTime("2026-12-20", "11:00");
    expect(instant.toISOString()).toBe("2026-12-20T05:30:00.000Z");
  });

  it("computes today in IST around a UTC date-line", () => {
    const justBeforeIstMidnight = new Date("2026-08-25T18:29:00.000Z");
    const justAfterIstMidnight = new Date("2026-08-25T18:30:00.000Z");
    expect(todayIstDate(justBeforeIstMidnight)).toBe("2026-08-25");
    expect(todayIstDate(justAfterIstMidnight)).toBe("2026-08-26");
  });

  it("returns hours until check-in independently of local TZ", () => {
    const now = new Date("2026-12-19T05:30:00.000Z");
    expect(hoursUntilIst("2026-12-20", "11:00", now)).toBe(24);
  });
});
