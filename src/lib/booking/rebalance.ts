import { getRoomGroup } from "@/data/rooms";
import { physicalOccupancy } from "@/lib/booking/occupancy";
import { distributeGuests } from "@/lib/booking/distribute";
import type { BookedRoom, GuestComposition, RoomAllocation, RoomShape } from "@/types";

function evenParts(total: number, count: number, min: number, max: number): number[] | null {
  if (count === 0) return total === 0 ? [] : null;
  if (total < count * min || total > count * max) return null;
  const base = Math.floor(total / count);
  const rem = total % count;
  const parts = Array.from({ length: count }, (_, index) => base + (index < rem ? 1 : 0));
  if (parts.some((part) => part < min || part > max)) return null;
  return parts;
}

export function rebalanceExistingRooms(
  rooms: BookedRoom[],
  composition: GuestComposition,
): RoomAllocation[] | null {
  const singles = rooms.filter((room) => room.roomGroupId === "single-bed");
  const doubles = rooms.filter((room) => room.roomGroupId === "double-bed");
  const n = physicalOccupancy(composition);
  const singleGroup = getRoomGroup("single-bed")!;
  const doubleGroup = getRoomGroup("double-bed")!;
  const s = singles.length;
  const d = doubles.length;

  for (let doubleTotal = d * doubleGroup.occupancyMin; doubleTotal <= d * doubleGroup.occupancyMax; doubleTotal += 1) {
    const singleTotal = n - doubleTotal;
    if (s === 0 && singleTotal !== 0) continue;
    if (d === 0 && doubleTotal !== 0) continue;
    const doubleParts = evenParts(doubleTotal, d, doubleGroup.occupancyMin, doubleGroup.occupancyMax);
    const singleParts = evenParts(singleTotal, s, singleGroup.occupancyMin, singleGroup.occupancyMax);
    if (!doubleParts || !singleParts) continue;
    const shapes: RoomShape[] = [
      ...doubles.map((room, index) => ({ roomGroupId: room.roomGroupId, occupancy: doubleParts[index] })),
      ...singles.map((room, index) => ({ roomGroupId: room.roomGroupId, occupancy: singleParts[index] })),
    ];
    const distributed = distributeGuests(composition, shapes);
    return distributed.map((allocation, index) => {
      const source = index < doubles.length ? doubles[index] : singles[index - doubles.length];
      return {
        ...allocation,
        id: source.id,
        acMode: source.acMode,
      };
    });
  }
  return null;
}
