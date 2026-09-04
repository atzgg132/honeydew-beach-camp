import { describe, expect, it } from "vitest";
import { tariffTable } from "@/data/tariff-table";
import { tariffSlabs } from "@/data/tariffs";
import { quoteCancellationPaise } from "@/domain/booking/cancellation";
import { priceBookingPaise, type TariffRateValue } from "@/domain/booking/pricing";
import { quoteCancellation } from "@/lib/booking/cancellation";
import { priceBooking } from "@/lib/booking/pricing";
import type { QuoteRequestInput } from "@/contracts/booking";
import type { AcMode, GuestComposition, RoomAllocation, RoomGroupId } from "@/types";

/**
 * The browser preview (`src/lib/booking/*`, rupees) and the authoritative server domain
 * (`src/domain/booking/*`, integer paise) are two independent implementations of the same
 * price. They exist for good reasons — the wizard must react without a round trip — but
 * nothing structural stops them drifting, and when they drift the guest is shown a price
 * they are not charged.
 *
 * These tests are that missing guard. They fail if the two ever disagree by a single paisa.
 */

const RATES: TariffRateValue[] = tariffTable.map((entry) => ({
  roomGroupId: entry.roomGroupId,
  tariffOccupancy: entry.tariffOccupancy,
  acMode: entry.acMode,
  ratePerPersonPaise: entry.ratePerPersonPaise,
}));

const ADVANCE_BASIS_POINTS = 3_000;

interface RoomCase {
  roomGroupId: RoomGroupId;
  acMode: AcMode;
  composition: GuestComposition;
}

/** Every occupancy each room group can legally hold, in both AC modes. */
function everyLegalRoom(): RoomCase[] {
  const rooms: RoomCase[] = [];
  const modes: AcMode[] = ["ac", "non-ac"];
  for (const acMode of modes) {
    // Single-bed holds 1 to 3, each with its own AC and Non-AC tariff.
    for (let guests = 1; guests <= 3; guests += 1) {
      for (let children = 0; children <= guests - 1; children += 1) {
        rooms.push({
          roomGroupId: "single-bed",
          acMode,
          composition: { adults: guests - children, childrenUnder5: 0, children5to10: children },
        });
      }
    }
    // Double-bed holds 4 to 6.
    for (let guests = 4; guests <= 6; guests += 1) {
      for (let children = 0; children <= guests - 1; children += 1) {
        rooms.push({
          roomGroupId: "double-bed",
          acMode,
          composition: { adults: guests - children, childrenUnder5: 0, children5to10: children },
        });
      }
    }
  }
  return rooms;
}

function totalComposition(rooms: RoomCase[]): GuestComposition {
  return rooms.reduce<GuestComposition>(
    (sum, room) => ({
      adults: sum.adults + room.composition.adults,
      childrenUnder5: sum.childrenUnder5 + room.composition.childrenUnder5,
      children5to10: sum.children5to10 + room.composition.children5to10,
    }),
    { adults: 0, childrenUnder5: 0, children5to10: 0 },
  );
}

function serverPrice(rooms: RoomCase[], checkIn: string, checkOut: string) {
  const input: QuoteRequestInput = {
    checkIn,
    checkOut,
    composition: totalComposition(rooms),
    rooms: rooms.map((room, index) => ({
      clientId: `room-${index}`,
      roomGroupId: room.roomGroupId,
      acMode: room.acMode,
      composition: room.composition,
    })),
  };
  return priceBookingPaise(input, RATES, ADVANCE_BASIS_POINTS);
}

function clientPrice(rooms: RoomCase[], checkIn: string, checkOut: string) {
  const allocations: RoomAllocation[] = rooms.map((room, index) => ({
    id: `room-${index}`,
    roomGroupId: room.roomGroupId,
    acMode: room.acMode,
    composition: room.composition,
    occupancy:
      room.composition.adults + room.composition.childrenUnder5 + room.composition.children5to10,
  }));
  return priceBooking({ checkIn, checkOut, rooms: allocations, advancePercent: ADVANCE_BASIS_POINTS / 100 });
}

describe("tariff table is the single source of truth", () => {
  it("publishes the same rates the database is seeded with", () => {
    expect(tariffSlabs).toHaveLength(tariffTable.length);
    for (const entry of tariffTable) {
      const slab = tariffSlabs.find(
        (candidate) =>
          candidate.roomGroupId === entry.roomGroupId &&
          candidate.occupancy === entry.tariffOccupancy &&
          candidate.acMode === entry.acMode,
      );
      expect(slab, `no published slab for ${entry.roomGroupId}/${entry.tariffOccupancy}/${entry.acMode}`).toBeDefined();
      expect(slab!.ratePerPerson * 100).toBe(entry.ratePerPersonPaise);
    }
  });

  it("keeps every rate an even number of paise so half rates stay exact", () => {
    // The database enforces this with a CHECK constraint. Asserting it here means a bad
    // rate fails in review rather than at migration time.
    for (const entry of tariffTable) {
      expect(entry.ratePerPersonPaise % 2, `${entry.roomGroupId}/${entry.tariffOccupancy}/${entry.acMode}`).toBe(0);
    }
  });
});

describe("browser preview matches the authoritative server price", () => {
  const checkIn = "2026-11-02";

  it.each([1, 2, 3, 7, 30])("agrees to the paisa for every legal room over %i night(s)", (nights) => {
    const checkOut = new Date(Date.UTC(2026, 10, 2 + nights)).toISOString().slice(0, 10);
    for (const room of everyLegalRoom()) {
      const server = serverPrice([room], checkIn, checkOut);
      const client = clientPrice([room], checkIn, checkOut);
      const label = `${room.roomGroupId}/${room.acMode}/${JSON.stringify(room.composition)}/${nights}n`;

      expect(Math.round(client.rooms[0].nightlyTotal * 100), `nightly ${label}`).toBe(
        server.rooms[0].nightlyTotalPaise,
      );
      expect(Math.round(client.rooms[0].stayTotal * 100), `stay ${label}`).toBe(
        server.rooms[0].stayTotalPaise,
      );
      expect(client.rooms[0].tariffPerPerson * 100, `rate ${label}`).toBe(
        server.rooms[0].ratePerPersonPaise,
      );
      expect(client.rooms[0].tariffOccupancy, `tier ${label}`).toBe(server.rooms[0].tariffOccupancy);
      expect(Math.round(client.subtotal * 100), `subtotal ${label}`).toBe(server.subtotalPaise);
      expect(Math.round(client.advance * 100), `advance ${label}`).toBe(server.advancePaise);
      expect(Math.round(client.balance * 100), `balance ${label}`).toBe(server.balancePaise);
    }
  });

  it("agrees on multi-room bookings that mix groups, AC modes and children", () => {
    const combinations: RoomCase[][] = [
      [
        { roomGroupId: "single-bed", acMode: "ac", composition: { adults: 2, childrenUnder5: 0, children5to10: 1 } },
        { roomGroupId: "single-bed", acMode: "non-ac", composition: { adults: 1, childrenUnder5: 1, children5to10: 0 } },
      ],
      [
        { roomGroupId: "double-bed", acMode: "ac", composition: { adults: 3, childrenUnder5: 0, children5to10: 2 } },
        { roomGroupId: "double-bed", acMode: "non-ac", composition: { adults: 5, childrenUnder5: 1, children5to10: 0 } },
      ],
      [
        { roomGroupId: "double-bed", acMode: "non-ac", composition: { adults: 2, childrenUnder5: 1, children5to10: 3 } },
        { roomGroupId: "single-bed", acMode: "ac", composition: { adults: 1, childrenUnder5: 0, children5to10: 2 } },
        { roomGroupId: "single-bed", acMode: "non-ac", composition: { adults: 2, childrenUnder5: 0, children5to10: 0 } },
      ],
    ];

    for (const rooms of combinations) {
      for (const nights of [1, 2, 5]) {
        const checkOut = new Date(Date.UTC(2026, 10, 2 + nights)).toISOString().slice(0, 10);
        const server = serverPrice(rooms, checkIn, checkOut);
        const client = clientPrice(rooms, checkIn, checkOut);
        const label = `${rooms.length} rooms / ${nights}n`;
        expect(Math.round(client.subtotal * 100), `subtotal ${label}`).toBe(server.subtotalPaise);
        expect(Math.round(client.advance * 100), `advance ${label}`).toBe(server.advancePaise);
        expect(Math.round(client.balance * 100), `balance ${label}`).toBe(server.balancePaise);
      }
    }
  });
});

describe("browser cancellation preview matches the authoritative server quote", () => {
  // One case per slab, plus the exact boundaries where a slab changes.
  const hourCases = [0, 1, 23.9, 24, 24.1, 47.9, 48, 48.1, 167.9, 168, 168.1, 359.9, 360, 360.1, 719.9, 720, 720.1, 5_000];
  const advancePaidCases = [0, 1_00, 749_50, 1_678_80, 5_996_00, 19_980_00];

  it("agrees on slab, deduction and refundable amount at every boundary", () => {
    for (const hours of hourCases) {
      for (const advancePaise of advancePaidCases) {
        const server = quoteCancellationPaise(hours, advancePaise);
        const client = quoteCancellation({
          checkIn: "2026-11-02",
          advancePaid: advancePaise / 100,
          // quoteCancellation derives hours from `now`; pin it so both see the same gap.
          now: new Date(Date.UTC(2026, 10, 2, 5, 30) - hours * 3_600_000),
        });
        const label = `${hours}h / ${advancePaise}p`;
        expect(client.slab.id, `slab ${label}`).toBe(server.slabId);
        expect(client.deductionPercent * 100, `deduction bp ${label}`).toBe(server.deductionBasisPoints);
        expect(Math.round(client.charge * 100), `charge ${label}`).toBe(server.deductionPaise);
        expect(Math.round(client.refundable * 100), `refundable ${label}`).toBe(server.refundablePaise);
      }
    }
  });
});
