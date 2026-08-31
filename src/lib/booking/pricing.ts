import { bookingConfig } from "@/data/booking-config";
import { findSlab, tariffOccupancyFor } from "@/data/tariffs";
import { billingHalfUnits, roundBasisPoints } from "@/domain/booking/pricing";
import { nightsBetween } from "@/lib/dates";
import { billableUnits, physicalOccupancy } from "@/lib/booking/occupancy";
import type {
  AcMode,
  BookingPricingSnapshot,
  GuestComposition,
  RoomAllocation,
  RoomGroupId,
  RoomPricingSnapshot,
} from "@/types";

/**
 * Browser-side price preview.
 *
 * The server is authoritative: every quote, hold and charge is computed in integer paise by
 * `src/domain/booking/pricing.ts`. This module exists only so the booking wizard can react
 * instantly without a round trip, and it must produce *exactly* the same number the server
 * will. It therefore does its arithmetic in paise using the same shared helpers, and
 * converts to rupees only at the boundary.
 *
 * It previously rounded a child's half rate up to a whole rupee, which overstated the price
 * by up to a few rupees on multi-night stays with children aged 5 to 10 — the preview and
 * the confirmation disagreed. Per-person rates are constrained to an even number of paise
 * precisely so that half of one is exact, so no rounding is needed or wanted.
 */

export function roundRupee(amount: number): number {
  return Math.round(amount);
}

/** Rupee amounts here are always whole or half rupees, so this conversion is exact. */
function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function roomNightlyTotal(ratePerPerson: number, composition: GuestComposition): number {
  // Mirrors the server: (ratePaise * (adults * 2 + children5to10)) / 2.
  return (toPaise(ratePerPerson) * billingHalfUnits(composition)) / 2 / 100;
}

export function advanceFromSubtotal(
  subtotal: number,
  percent: number = bookingConfig.advancePercent,
): number {
  // Mirrors the server: basis points with half-up rounding, in paise.
  return roundBasisPoints(toPaise(subtotal), percent * 100) / 100;
}

export function priceRoom(input: {
  roomGroupId: RoomGroupId;
  acMode: AcMode;
  composition: GuestComposition;
  nights: number;
}): RoomPricingSnapshot {
  const physical = physicalOccupancy(input.composition);
  const tariffOccupancy = tariffOccupancyFor(input.roomGroupId, physical);
  const slab = findSlab(input.roomGroupId, tariffOccupancy, input.acMode);
  if (!slab) {
    throw new Error(`Missing tariff for ${input.roomGroupId} / ${tariffOccupancy} / ${input.acMode}`);
  }
  const nightlyTotal = roomNightlyTotal(slab.ratePerPerson, input.composition);
  return {
    roomGroupId: input.roomGroupId,
    acMode: input.acMode,
    physicalOccupancy: physical,
    tariffOccupancy,
    composition: input.composition,
    tariffPerPerson: slab.ratePerPerson,
    billableUnits: billableUnits(input.composition),
    nightlyTotal,
    nights: input.nights,
    stayTotal: nightlyTotal * input.nights,
  };
}

export function priceBooking(input: {
  checkIn: string;
  checkOut: string;
  rooms: RoomAllocation[];
  advancePercent?: number;
}): BookingPricingSnapshot {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  const rooms = input.rooms.map((room) =>
    priceRoom({
      roomGroupId: room.roomGroupId,
      acMode: room.acMode,
      composition: room.composition,
      nights,
    }),
  );
  const subtotal = rooms.reduce((sum, room) => sum + room.stayTotal, 0);
  const advancePercent = input.advancePercent ?? bookingConfig.advancePercent;
  const advance = advanceFromSubtotal(subtotal, advancePercent);
  return {
    rooms,
    nights,
    subtotal,
    advancePercent,
    advance,
    balance: subtotal - advance,
  };
}
