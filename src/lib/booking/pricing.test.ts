import { describe, expect, it } from "vitest";
import { generateArrangements } from "@/lib/booking/arrangements";
import { getAvailability } from "@/lib/booking/availability";
import { billableUnits, physicalOccupancy } from "@/lib/booking/occupancy";
import { priceBooking, priceRoom, roomNightlyTotal } from "@/lib/booking/pricing";
import { fullInventory } from "@/data/rooms";
import { tariffOccupancyFor } from "@/data/tariffs";
import type { GuestComposition, RoomAllocation } from "@/types";

const adults = (n: number): GuestComposition => ({
  adults: n,
  childrenUnder5: 0,
  children5to10: 0,
});

function room(
  group: RoomAllocation["roomGroupId"],
  count: number,
  ac: RoomAllocation["acMode"] = "ac",
  id = "room-1",
): RoomAllocation {
  return {
    id,
    roomGroupId: group,
    acMode: ac,
    composition: adults(count),
  };
}

describe("single-bed per-person tariffs", () => {
  it("charges 1 guest at the 2-head rate for one person", () => {
    const priced = priceRoom({
      roomGroupId: "single-bed",
      acMode: "ac",
      composition: adults(1),
      nights: 1,
    });
    expect(priced.tariffOccupancy).toBe(2);
    expect(priced.tariffPerPerson).toBe(1499);
    expect(priced.billableUnits).toBe(1);
    expect(priced.nightlyTotal).toBe(1499);
  });

  it("charges 1 guest Non-AC at ₹1,199", () => {
    expect(
      priceRoom({
        roomGroupId: "single-bed",
        acMode: "non-ac",
        composition: adults(1),
        nights: 1,
      }).nightlyTotal,
    ).toBe(1199);
  });

  it("charges 2 guests AC at 2 × ₹1,499 = ₹2,998", () => {
    expect(
      priceRoom({
        roomGroupId: "single-bed",
        acMode: "ac",
        composition: adults(2),
        nights: 1,
      }).nightlyTotal,
    ).toBe(2998);
  });

  it("charges 2 guests Non-AC at 2 × ₹1,199 = ₹2,398", () => {
    expect(
      priceRoom({
        roomGroupId: "single-bed",
        acMode: "non-ac",
        composition: adults(2),
        nights: 1,
      }).nightlyTotal,
    ).toBe(2398);
  });

  it("charges 3 guests AC at 3 × ₹1,399 = ₹4,197", () => {
    expect(
      priceRoom({
        roomGroupId: "single-bed",
        acMode: "ac",
        composition: adults(3),
        nights: 1,
      }).nightlyTotal,
    ).toBe(4197);
  });

  it("charges 3 guests Non-AC at 3 × ₹1,099 = ₹3,297", () => {
    expect(
      priceRoom({
        roomGroupId: "single-bed",
        acMode: "non-ac",
        composition: adults(3),
        nights: 1,
      }).nightlyTotal,
    ).toBe(3297);
  });

  it("rejects more than 3 in a Single-Bed Room", () => {
    expect(() => tariffOccupancyFor("single-bed", 4)).toThrow();
  });
});

describe("double-bed per-person tariffs", () => {
  it("charges 4 guests AC at 4 × ₹1,399 = ₹5,596", () => {
    expect(
      priceRoom({
        roomGroupId: "double-bed",
        acMode: "ac",
        composition: adults(4),
        nights: 1,
      }).nightlyTotal,
    ).toBe(5596);
  });

  it("charges 4 guests Non-AC at 4 × ₹1,199 = ₹4,796", () => {
    expect(
      priceRoom({
        roomGroupId: "double-bed",
        acMode: "non-ac",
        composition: adults(4),
        nights: 1,
      }).nightlyTotal,
    ).toBe(4796);
  });

  it("charges 5 guests AC at 5 × ₹1,299 = ₹6,495", () => {
    expect(
      priceRoom({
        roomGroupId: "double-bed",
        acMode: "ac",
        composition: adults(5),
        nights: 1,
      }).nightlyTotal,
    ).toBe(6495);
  });

  it("charges 5 guests Non-AC at 5 × ₹1,099 = ₹5,495", () => {
    expect(
      priceRoom({
        roomGroupId: "double-bed",
        acMode: "non-ac",
        composition: adults(5),
        nights: 1,
      }).nightlyTotal,
    ).toBe(5495);
  });

  it("charges 6 guests AC at 6 × ₹1,199 = ₹7,194", () => {
    expect(
      priceRoom({
        roomGroupId: "double-bed",
        acMode: "ac",
        composition: adults(6),
        nights: 1,
      }).nightlyTotal,
    ).toBe(7194);
  });

  it("charges 6 guests Non-AC at 6 × ₹999 = ₹5,994", () => {
    expect(
      priceRoom({
        roomGroupId: "double-bed",
        acMode: "non-ac",
        composition: adults(6),
        nights: 1,
      }).nightlyTotal,
    ).toBe(5994);
  });

  it("rejects more than 6 in a Double-Bed Room", () => {
    expect(() => tariffOccupancyFor("double-bed", 7)).toThrow();
  });
});

describe("multi-room totals", () => {
  it("prices 4 adults in one Double-Bed AC at ₹5,596", () => {
    const quote = priceBooking({
      checkIn: "2026-12-10",
      checkOut: "2026-12-11",
      rooms: [room("double-bed", 4, "ac")],
    });
    expect(quote.subtotal).toBe(5596);
  });

  it("prices 4 adults in two Single-Bed AC rooms at ₹5,996", () => {
    const quote = priceBooking({
      checkIn: "2026-12-10",
      checkOut: "2026-12-11",
      rooms: [room("single-bed", 2, "ac", "a"), room("single-bed", 2, "ac", "b")],
    });
    expect(quote.rooms[0].nightlyTotal).toBe(2998);
    expect(quote.rooms[1].nightlyTotal).toBe(2998);
    expect(quote.subtotal).toBe(5996);
  });

  it("prices 5 guests as 2 + 3 Single-Bed AC", () => {
    const quote = priceBooking({
      checkIn: "2026-12-10",
      checkOut: "2026-12-11",
      rooms: [room("single-bed", 2, "ac", "a"), room("single-bed", 3, "ac", "b")],
    });
    expect(quote.rooms[0].nightlyTotal).toBe(2998);
    expect(quote.rooms[1].nightlyTotal).toBe(4197);
    expect(quote.subtotal).toBe(7195);
  });

  it("prices 6 guests as 3 + 3 Single-Bed AC", () => {
    const quote = priceBooking({
      checkIn: "2026-12-10",
      checkOut: "2026-12-11",
      rooms: [room("single-bed", 3, "ac", "a"), room("single-bed", 3, "ac", "b")],
    });
    expect(quote.subtotal).toBe(8394);
  });

  it("prices 6 guests as 2 + 2 + 2 Single-Bed AC", () => {
    const quote = priceBooking({
      checkIn: "2026-12-10",
      checkOut: "2026-12-11",
      rooms: [
        room("single-bed", 2, "ac", "a"),
        room("single-bed", 2, "ac", "b"),
        room("single-bed", 2, "ac", "c"),
      ],
    });
    expect(quote.subtotal).toBe(8994);
  });

  it("multiplies by nights", () => {
    const quote = priceBooking({
      checkIn: "2026-12-10",
      checkOut: "2026-12-13",
      rooms: [room("double-bed", 4, "ac")],
    });
    expect(quote.nights).toBe(3);
    expect(quote.subtotal).toBe(5596 * 3);
  });
});

describe("children", () => {
  it("counts under-5 toward occupancy but not billing", () => {
    const composition = { adults: 2, childrenUnder5: 1, children5to10: 0 };
    expect(physicalOccupancy(composition)).toBe(3);
    expect(billableUnits(composition)).toBe(2);
    const priced = priceRoom({
      roomGroupId: "single-bed",
      acMode: "ac",
      composition,
      nights: 1,
    });
    expect(priced.tariffOccupancy).toBe(3);
    expect(priced.tariffPerPerson).toBe(1399);
    expect(priced.nightlyTotal).toBe(1399 * 2);
  });

  it("counts ages 5-10 as half a billable unit on the physical-occupancy tariff", () => {
    const composition = { adults: 2, childrenUnder5: 0, children5to10: 1 };
    expect(physicalOccupancy(composition)).toBe(3);
    expect(billableUnits(composition)).toBe(2.5);
    const priced = priceRoom({
      roomGroupId: "single-bed",
      acMode: "ac",
      composition,
      nights: 1,
    });
    expect(priced.tariffOccupancy).toBe(3);
    expect(priced.nightlyTotal).toBe(1399 * 2 + Math.round(1399 / 2));
  });
});

describe("arrangements", () => {
  const open = fullInventory();

  it("offers one Double-Bed and two Single-Bed options for 4 guests", () => {
    const options = generateArrangements(adults(4), open);
    const ids = options.map((item) => item.id);
    expect(ids.some((id) => id.includes("d4"))).toBe(true);
    expect(ids.some((id) => id === "s2+s2")).toBe(true);
  });

  it("includes 2+3 singles for 5 guests", () => {
    const options = generateArrangements(adults(5), open);
    expect(options.some((item) => item.id === "s3+s2" || item.id === "s2+s3")).toBe(true);
  });

  it("includes 3+3 and 2+2+2 for 6 guests", () => {
    const options = generateArrangements(adults(6), open);
    const ids = options.map((item) => item.id);
    expect(ids.some((id) => id === "s3+s3")).toBe(true);
    expect(ids.some((id) => id === "s2+s2+s2")).toBe(true);
  });

  it("offers mixed Double + Single for 7 guests and never a 7-person room", () => {
    const options = generateArrangements(adults(7), open);
    expect(options.length).toBeGreaterThan(0);
    expect(
      options.every((item) => item.rooms.every((room) => room.occupancy <= 6)),
    ).toBe(true);
    expect(
      options.some(
        (item) =>
          item.rooms.some((room) => room.roomGroupId === "double-bed") &&
          item.rooms.some((room) => room.roomGroupId === "single-bed"),
      ),
    ).toBe(true);
  });

  it("does not emit more than 4 Single-Bed or 3 Double-Bed rooms", () => {
    const options = generateArrangements(adults(12), open);
    for (const option of options) {
      const singles = option.rooms.filter((room) => room.roomGroupId === "single-bed").length;
      const doubles = option.rooms.filter((room) => room.roomGroupId === "double-bed").length;
      expect(singles).toBeLessThanOrEqual(4);
      expect(doubles).toBeLessThanOrEqual(3);
    }
  });

  it("returns nothing when inventory cannot cover the party", () => {
    expect(
      generateArrangements(adults(8), { "single-bed": 0, "double-bed": 1 }),
    ).toEqual([]);
  });
});

describe("availability", () => {
  it("does not treat AC as extra inventory", () => {
    const bookings = [
      {
        status: "confirmed",
        reference: "A",
        checkIn: "2026-12-10",
        checkOut: "2026-12-12",
        rooms: [
          { roomGroupId: "single-bed" },
          { roomGroupId: "single-bed" },
        ],
      },
    ] as never;
    const available = getAvailability(bookings, "2026-12-10", "2026-12-11");
    expect(available["single-bed"]).toBe(2);
    expect(available["double-bed"]).toBe(3);
  });
});

describe("money helper", () => {
  it("keeps half-child charges in whole rupees", () => {
    expect(roomNightlyTotal(1399, { adults: 2, childrenUnder5: 0, children5to10: 1 }) % 1).toBe(0);
  });
});
