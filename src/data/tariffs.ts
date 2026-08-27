import type { AcMode, RoomGroupId, TariffSlab } from "@/types";

export const rateQualifier = "per person, per night";

export const tariffSlabs: TariffSlab[] = [
  { roomGroupId: "single-bed", occupancy: 2, acMode: "ac", ratePerPerson: 1499 },
  { roomGroupId: "single-bed", occupancy: 2, acMode: "non-ac", ratePerPerson: 1199 },
  { roomGroupId: "single-bed", occupancy: 3, acMode: "ac", ratePerPerson: 1399 },
  { roomGroupId: "single-bed", occupancy: 3, acMode: "non-ac", ratePerPerson: 1099 },
  { roomGroupId: "double-bed", occupancy: 4, acMode: "ac", ratePerPerson: 1399 },
  { roomGroupId: "double-bed", occupancy: 4, acMode: "non-ac", ratePerPerson: 1199 },
  { roomGroupId: "double-bed", occupancy: 5, acMode: "ac", ratePerPerson: 1299 },
  { roomGroupId: "double-bed", occupancy: 5, acMode: "non-ac", ratePerPerson: 1099 },
  { roomGroupId: "double-bed", occupancy: 6, acMode: "ac", ratePerPerson: 1199 },
  { roomGroupId: "double-bed", occupancy: 6, acMode: "non-ac", ratePerPerson: 999 },
];

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
