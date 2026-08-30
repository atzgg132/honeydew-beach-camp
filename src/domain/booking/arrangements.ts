import type { CompositionInput } from "@/contracts/booking";
import type { TariffRateValue } from "@/domain/booking/pricing";
import { billingHalfUnits, physicalOccupancy, tariffOccupancy } from "@/domain/booking/pricing";
import { distributeGuests } from "@/lib/booking/distribute";
import type { Availability, RoomShape } from "@/types";

export interface ServerArrangement {
  id: string;
  rooms: RoomShape[];
  nightlyEstimateAcPaise: number;
  nightlyEstimateNonAcPaise: number;
  labels: string[];
}

function evenParts(total: number, count: number, min: number, max: number): number[] | null {
  if (count === 0) return total === 0 ? [] : null;
  if (total < count * min || total > count * max) return null;
  const base = Math.floor(total / count);
  const remainder = total % count;
  const values = Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
  return values.some((value) => value < min || value > max) ? null : values.sort((a, b) => b - a);
}

function arrangementId(rooms: RoomShape[]): string {
  return rooms.map((room) => `${room.roomGroupId[0]}${room.occupancy}`).sort().join("+");
}

function estimate(composition: CompositionInput, rooms: RoomShape[], mode: "ac" | "non-ac", rates: TariffRateValue[]): number {
  const allocations = distributeGuests(composition, rooms);
  return rooms.reduce((sum, room, index) => {
    const tier = tariffOccupancy(room.roomGroupId, room.occupancy);
    const rate = rates.find(
      (candidate) =>
        candidate.roomGroupId === room.roomGroupId &&
        candidate.tariffOccupancy === tier &&
        candidate.acMode === mode,
    );
    return sum + ((rate?.ratePerPersonPaise ?? 0) * billingHalfUnits(allocations[index].composition)) / 2;
  }, 0);
}

export function generateServerArrangements(
  composition: CompositionInput,
  availability: Availability,
  rates: TariffRateValue[],
): ServerArrangement[] {
  const guests = physicalOccupancy(composition);
  const candidates: ServerArrangement[] = [];
  for (let doubles = 0; doubles <= availability["double-bed"]; doubles += 1) {
    for (let singles = 0; singles <= availability["single-bed"]; singles += 1) {
      if (singles + doubles === 0) continue;
      for (let doubleGuests = doubles * 4; doubleGuests <= doubles * 6; doubleGuests += 1) {
        const singleGuests = guests - doubleGuests;
        const doubleParts = evenParts(doubleGuests, doubles, 4, 6);
        const singleParts = evenParts(singleGuests, singles, 1, 3);
        if (!doubleParts || !singleParts) continue;
        const rooms: RoomShape[] = [
          ...doubleParts.map((occupancy) => ({ roomGroupId: "double-bed" as const, occupancy })),
          ...singleParts.map((occupancy) => ({ roomGroupId: "single-bed" as const, occupancy })),
        ];
        candidates.push({
          id: arrangementId(rooms),
          rooms,
          nightlyEstimateAcPaise: estimate(composition, rooms, "ac", rates),
          nightlyEstimateNonAcPaise: estimate(composition, rooms, "non-ac", rates),
          labels: [],
        });
      }
    }
  }

  const unique = [...new Map(candidates.map((candidate) => [candidate.id, candidate])).values()];
  const withoutSingletons = unique.filter((candidate) => candidate.rooms.every((room) => room.occupancy !== 1));
  const pool = withoutSingletons.length > 0 ? withoutSingletons : unique;
  if (pool.length === 0) return [];
  const byRooms = [...pool].sort(
    (a, b) => a.rooms.length - b.rooms.length || a.nightlyEstimateNonAcPaise - b.nightlyEstimateNonAcPaise,
  );
  const cheapest = [...pool].sort(
    (a, b) => a.nightlyEstimateNonAcPaise - b.nightlyEstimateNonAcPaise,
  )[0];
  const selections = [byRooms[0], cheapest, byRooms[Math.floor(byRooms.length / 2)], byRooms.at(-1)!];
  const picked = [...new Map(selections.map((candidate) => [candidate.id, candidate])).values()].slice(0, 4);
  const fewest = Math.min(...picked.map((candidate) => candidate.rooms.length));
  const most = Math.max(...picked.map((candidate) => candidate.rooms.length));
  return picked.map((candidate) => ({
    ...candidate,
    labels: [
      ...(candidate.rooms.length === fewest && most > fewest ? ["Fewer rooms"] : []),
      ...(candidate.id === cheapest.id ? ["Lower cost"] : []),
      ...(candidate.rooms.length === most && most > fewest ? ["More privacy"] : []),
    ],
  }));
}
