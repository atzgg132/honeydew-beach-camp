import { tariffTable } from "@/data/tariff-table";
import { tariffOccupancy } from "@/domain/booking/pricing";
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
  return tariffOccupancy(roomGroupId, physicalOccupancy);
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
