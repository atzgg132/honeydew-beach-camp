import { tariffTable } from "@/data/tariff-table";
import type { AcMode, RoomGroupId, TariffSlab } from "@/types";

export const rateQualifier = "per person, per night";

// Derived from the canonical paise table so the published rate card and the seeded
// database cannot drift. These rupee values are for display only; every charge is
// computed by the server in paise.
export const tariffSlabs: TariffSlab[] = tariffTable.map((entry) => ({
  roomGroupId: entry.roomGroupId,
  occupancy: entry.tariffOccupancy,
  acMode: entry.acMode,
  ratePerPerson: entry.ratePerPersonPaise / 100,
}));

export function tariffOccupancyFor(roomGroupId: RoomGroupId, physicalOccupancy: number): number {
  if (roomGroupId === "single-bed") {
    if (physicalOccupancy === 1 || physicalOccupancy === 2) return 2;
    if (physicalOccupancy === 3) return 3;
  }
  if (roomGroupId === "double-bed") {
    if (physicalOccupancy >= 4 && physicalOccupancy <= 6) return physicalOccupancy;
  }
  throw new Error(`No tariff occupancy for ${roomGroupId} with ${physicalOccupancy} guests.`);
}

export function findSlab(
  roomGroupId: RoomGroupId,
  tariffOccupancy: number,
  acMode: AcMode,
): TariffSlab | undefined {
  return tariffSlabs.find(
    (slab) =>
      slab.roomGroupId === roomGroupId &&
      slab.occupancy === tariffOccupancy &&
      slab.acMode === acMode,
  );
}

export function lowestRateForGroup(roomGroupId: RoomGroupId): number {
  return Math.min(
    ...tariffSlabs.filter((slab) => slab.roomGroupId === roomGroupId).map((slab) => slab.ratePerPerson),
  );
}

export function typicalRateForGroup(roomGroupId: RoomGroupId): number {
  const occupancy = roomGroupId === "single-bed" ? 2 : 4;
  return findSlab(roomGroupId, occupancy, "non-ac")?.ratePerPerson ?? lowestRateForGroup(roomGroupId);
}
