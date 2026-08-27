import { getRoomGroup } from "@/data/rooms";
import type { GuestComposition, RoomGroupId } from "@/types";

export const emptyComposition = (): GuestComposition => ({
  adults: 0,
  childrenUnder5: 0,
  children5to10: 0,
});

export function physicalOccupancy(composition: GuestComposition): number {
  return composition.adults + composition.childrenUnder5 + composition.children5to10;
}

export function billableUnits(composition: GuestComposition): number {
  return composition.adults + composition.children5to10 * 0.5;
}

export function addCompositions(parts: GuestComposition[]): GuestComposition {
  return parts.reduce(
    (sum, part) => ({
      adults: sum.adults + part.adults,
      childrenUnder5: sum.childrenUnder5 + part.childrenUnder5,
      children5to10: sum.children5to10 + part.children5to10,
    }),
    emptyComposition(),
  );
}

export function compositionsEqual(a: GuestComposition, b: GuestComposition): boolean {
  return (
    a.adults === b.adults &&
    a.childrenUnder5 === b.childrenUnder5 &&
    a.children5to10 === b.children5to10
  );
}

export function roomOccupancyValid(roomGroupId: RoomGroupId, occupancy: number): boolean {
  const group = getRoomGroup(roomGroupId);
  if (!group) return false;
  return occupancy >= group.occupancyMin && occupancy <= group.occupancyMax;
}

export function guestCountLabel(count: number): string {
  return count === 1 ? "1 guest" : `${count} guests`;
}

export function formatNightPhrase(nights: number): string {
  return nights === 1 ? "1 night" : `${nights} nights`;
}

export function formatComposition(composition: GuestComposition): string {
  const bits = [`${composition.adults} adult${composition.adults === 1 ? "" : "s"}`];
  if (composition.children5to10) {
    bits.push(
      `${composition.children5to10} child${composition.children5to10 === 1 ? "" : "ren"} 5–10 (half rate)`,
    );
  }
  if (composition.childrenUnder5) {
    bits.push(
      `${composition.childrenUnder5} child${composition.childrenUnder5 === 1 ? "" : "ren"} under 5 (no charge)`,
    );
  }
  return bits.join(", ");
}
