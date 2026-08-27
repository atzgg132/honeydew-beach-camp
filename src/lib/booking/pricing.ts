import { bookingConfig } from "@/data/booking-config";
import { findSlab, tariffOccupancyFor } from "@/data/tariffs";
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

export function roundRupee(amount: number): number {
  return Math.round(amount);
}

export function roomNightlyTotal(ratePerPerson: number, composition: GuestComposition): number {
  const halfChild = roundRupee(ratePerPerson / 2);
  return ratePerPerson * composition.adults + halfChild * composition.children5to10;
}

export function advanceFromSubtotal(
  subtotal: number,
  percent: number = bookingConfig.advancePercent,
): number {
  return roundRupee((subtotal * percent) / 100);
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
