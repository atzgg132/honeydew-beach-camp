import { emptyComposition, physicalOccupancy } from "@/lib/booking/occupancy";
import type { AcMode, GuestComposition, RoomAllocation, RoomShape } from "@/types";

export function distributeGuests(
  composition: GuestComposition,
  rooms: RoomShape[],
  acMode: AcMode = "non-ac",
): RoomAllocation[] {
  const buckets = rooms.map((room, index) => ({
    id: `room-${index + 1}`,
    roomGroupId: room.roomGroupId,
    acMode,
    composition: emptyComposition(),
    occupancy: room.occupancy,
    filled: 0,
  }));

  const fill = (key: keyof GuestComposition, count: number) => {
    let left = count;
    for (const bucket of buckets) {
      const space = bucket.occupancy - bucket.filled;
      const take = Math.min(space, left);
      bucket.composition[key] += take;
      bucket.filled += take;
      left -= take;
      if (left === 0) break;
    }
  };

  fill("adults", composition.adults);
  fill("children5to10", composition.children5to10);
  fill("childrenUnder5", composition.childrenUnder5);

  return buckets.map((bucket) => ({
    id: bucket.id,
    roomGroupId: bucket.roomGroupId,
    acMode: bucket.acMode,
    composition: bucket.composition,
  }));
}

export function allocationsMatchComposition(
  rooms: RoomAllocation[],
  composition: GuestComposition,
): boolean {
  const totals = rooms.reduce(
    (sum, room) => ({
      adults: sum.adults + room.composition.adults,
      childrenUnder5: sum.childrenUnder5 + room.composition.childrenUnder5,
      children5to10: sum.children5to10 + room.composition.children5to10,
    }),
    emptyComposition(),
  );
  return (
    totals.adults === composition.adults &&
    totals.childrenUnder5 === composition.childrenUnder5 &&
    totals.children5to10 === composition.children5to10 &&
    rooms.every((room) => physicalOccupancy(room.composition) > 0)
  );
}
