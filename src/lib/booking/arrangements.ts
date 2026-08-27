import { getRoomGroup } from "@/data/rooms";
import { findSlab, tariffOccupancyFor } from "@/data/tariffs";
import { emptyComposition, physicalOccupancy } from "@/lib/booking/occupancy";
import { roomNightlyTotal } from "@/lib/booking/pricing";
import type {
  Arrangement,
  Availability,
  GuestComposition,
  RoomGroupId,
  RoomShape,
} from "@/types";

function evenParts(total: number, count: number, min: number, max: number): number[] | null {
  if (count === 0) return total === 0 ? [] : null;
  if (total < count * min || total > count * max) return null;
  const base = Math.floor(total / count);
  const rem = total % count;
  const parts = Array.from({ length: count }, (_, index) => base + (index < rem ? 1 : 0));
  if (parts.some((part) => part < min || part > max)) return null;
  return parts.sort((a, b) => b - a);
}

function arrangementId(rooms: RoomShape[]): string {
  return rooms
    .map((room) => `${room.roomGroupId[0]}${room.occupancy}`)
    .sort()
    .join("+");
}

function nightlyEstimate(rooms: RoomShape[], acMode: "ac" | "non-ac"): number {
  return rooms.reduce((sum, room) => {
    const occupancy: GuestComposition = {
      ...emptyComposition(),
      adults: room.occupancy,
    };
    const tariffOccupancy = tariffOccupancyFor(room.roomGroupId, room.occupancy);
    const slab = findSlab(room.roomGroupId, tariffOccupancy, acMode);
    if (!slab) return sum;
    return sum + roomNightlyTotal(slab.ratePerPerson, occupancy);
  }, 0);
}

export function generateArrangements(
  composition: GuestComposition,
  available: Availability,
): Arrangement[] {
  const n = physicalOccupancy(composition);
  if (n < 1) return [];

  const candidates: Arrangement[] = [];
  for (let doubles = 0; doubles <= available["double-bed"]; doubles += 1) {
    for (let singles = 0; singles <= available["single-bed"]; singles += 1) {
      if (singles + doubles === 0) continue;
      const doubleMin = doubles * 4;
      const doubleMax = doubles * 6;
      const singleMin = singles * 1;
      const singleMax = singles * 3;
      for (let doubleTotal = doubleMin; doubleTotal <= doubleMax; doubleTotal += 1) {
        const singleTotal = n - doubleTotal;
        if (singleTotal < singleMin || singleTotal > singleMax) continue;
        const doubleParts = evenParts(doubleTotal, doubles, 4, 6);
        const singleParts = evenParts(singleTotal, singles, 1, 3);
        if (!doubleParts || !singleParts) continue;
        const rooms: RoomShape[] = [
          ...doubleParts.map((occupancy) => ({ roomGroupId: "double-bed" as const, occupancy })),
          ...singleParts.map((occupancy) => ({ roomGroupId: "single-bed" as const, occupancy })),
        ];
        candidates.push({
          id: arrangementId(rooms),
          rooms,
          nightlyEstimateAc: nightlyEstimate(rooms, "ac"),
          nightlyEstimateNonAc: nightlyEstimate(rooms, "non-ac"),
          labels: [],
        });
      }
    }
  }

  const unique = new Map<string, Arrangement>();
  for (const item of candidates) unique.set(item.id, item);
  return selectArrangements([...unique.values()]);
}

function hasSingleton(arrangement: Arrangement): boolean {
  return arrangement.rooms.some((room) => room.occupancy === 1);
}

function selectArrangements(all: Arrangement[]): Arrangement[] {
  if (all.length === 0) return [];
  const withoutOnes = all.filter((item) => !hasSingleton(item));
  const pool = withoutOnes.length > 0 ? withoutOnes : all;
  const byRooms = [...pool].sort(
    (a, b) => a.rooms.length - b.rooms.length || a.nightlyEstimateAc - b.nightlyEstimateAc,
  );
  const fewestCount = byRooms[0].rooms.length;
  const privacyCount = byRooms[byRooms.length - 1].rooms.length;
  const fewest = byRooms.find((item) => item.rooms.length === fewestCount)!;
  const cheapest = [...pool].sort((a, b) => a.nightlyEstimateNonAc - b.nightlyEstimateNonAc)[0];
  const privacy = [...byRooms].reverse().find((item) => item.rooms.length === privacyCount);
  const middle = byRooms.find(
    (item) => item.rooms.length > fewestCount && item.rooms.length < privacyCount,
  );
  const mixed = pool.find(
    (item) =>
      item.rooms.some((room) => room.roomGroupId === "single-bed") &&
      item.rooms.some((room) => room.roomGroupId === "double-bed"),
  );

  const picked: Arrangement[] = [];
  const take = (item: Arrangement | undefined) => {
    if (!item) return;
    if (picked.some((existing) => existing.id === item.id)) return;
    if (picked.length >= 4) return;
    picked.push(item);
  };

  take(fewest);
  take(cheapest);
  take(middle);
  take(privacy);
  take(mixed);

  return picked.map((item) => {
    const labels: string[] = [];
    if (privacyCount > fewestCount && item.rooms.length === fewestCount) labels.push("Fewer rooms");
    if (
      item.id === cheapest.id &&
      picked.some((other) => other.nightlyEstimateNonAc > item.nightlyEstimateNonAc)
    ) {
      labels.push("Lower cost");
    }
    if (privacyCount > fewestCount && item.rooms.length === privacyCount) labels.push("More privacy");
    return { ...item, labels };
  });
}

export function describeArrangement(arrangement: Arrangement): string {
  const counts = new Map<string, number>();
  for (const room of arrangement.rooms) {
    const group = getRoomGroup(room.roomGroupId);
    const people = room.occupancy === 1 ? "guest" : "guests";
    const label = `${group?.publicName ?? room.roomGroupId} · ${room.occupancy} ${people}`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => (count > 1 ? `${count} × ${label}` : label))
    .join("; ");
}

export function countByGroup(rooms: { roomGroupId: RoomGroupId }[]): Availability {
  return {
    "single-bed": rooms.filter((room) => room.roomGroupId === "single-bed").length,
    "double-bed": rooms.filter((room) => room.roomGroupId === "double-bed").length,
  };
}

export function maxPartySize(available: Availability): number {
  const single = getRoomGroup("single-bed")!;
  const double = getRoomGroup("double-bed")!;
  return available["single-bed"] * single.occupancyMax + available["double-bed"] * double.occupancyMax;
}
