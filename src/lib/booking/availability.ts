import { fullInventory } from "@/data/rooms";
import { countByGroup } from "@/lib/booking/arrangements";
import type { Availability, Booking } from "@/types";

export function datesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function usedInventory(
  bookings: Booking[],
  checkIn: string,
  checkOut: string,
  exceptReference?: string,
): Availability {
  const used: Availability = { "single-bed": 0, "double-bed": 0 };
  for (const booking of bookings) {
    if (booking.status === "cancelled") continue;
    if (exceptReference && booking.reference === exceptReference) continue;
    if (!datesOverlap(checkIn, checkOut, booking.checkIn, booking.checkOut)) continue;
    const counts = countByGroup(booking.rooms);
    used["single-bed"] += counts["single-bed"];
    used["double-bed"] += counts["double-bed"];
  }
  return used;
}

export function getAvailability(
  bookings: Booking[],
  checkIn: string,
  checkOut: string,
  exceptReference?: string,
): Availability {
  const total = fullInventory();
  const used = usedInventory(bookings, checkIn, checkOut, exceptReference);
  return {
    "single-bed": Math.max(0, total["single-bed"] - used["single-bed"]),
    "double-bed": Math.max(0, total["double-bed"] - used["double-bed"]),
  };
}

export function fitsAvailability(
  rooms: { roomGroupId: "single-bed" | "double-bed" }[],
  available: Availability,
): boolean {
  const needed = countByGroup(rooms);
  return needed["single-bed"] <= available["single-bed"] && needed["double-bed"] <= available["double-bed"];
}
