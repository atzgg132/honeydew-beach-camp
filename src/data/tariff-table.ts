import type { AcMode, RoomGroupId } from "@/types";

/**
 * The canonical published tariff, in integer paise, per person per night.
 *
 * This is the single source of truth for revision 1. `prisma/seed.ts` seeds `TariffRate`
 * from it and `src/data/tariffs.ts` derives the rupee values the marketing pages display,
 * so the seeded database and the published rate card cannot drift apart.
 *
 * Rates must be even so that the half-rate charged for a child aged 5 to 10 is an exact
 * integer number of paise. The database enforces this with a CHECK constraint; the test
 * suite asserts it here too, so a bad rate fails before it reaches a migration.
 *
 * Once seeded, a revision is immutable. Changing a price means creating a new
 * `TariffRevision` through the admin application, never editing these numbers — existing
 * bookings are repriced against their own revision.
 */
export interface TariffTableEntry {
  roomGroupId: RoomGroupId;
  /** The occupancy tier the rate is filed under, not necessarily the guest count. */
  tariffOccupancy: number;
  acMode: AcMode;
  ratePerPersonPaise: number;
}

export const tariffTable: readonly TariffTableEntry[] = [
  { roomGroupId: "single-bed", tariffOccupancy: 2, acMode: "ac", ratePerPersonPaise: 149_900 },
  { roomGroupId: "single-bed", tariffOccupancy: 2, acMode: "non-ac", ratePerPersonPaise: 119_900 },
  { roomGroupId: "single-bed", tariffOccupancy: 3, acMode: "ac", ratePerPersonPaise: 139_900 },
  { roomGroupId: "single-bed", tariffOccupancy: 3, acMode: "non-ac", ratePerPersonPaise: 109_900 },
  { roomGroupId: "double-bed", tariffOccupancy: 4, acMode: "ac", ratePerPersonPaise: 139_900 },
  { roomGroupId: "double-bed", tariffOccupancy: 4, acMode: "non-ac", ratePerPersonPaise: 119_900 },
  { roomGroupId: "double-bed", tariffOccupancy: 5, acMode: "ac", ratePerPersonPaise: 129_900 },
  { roomGroupId: "double-bed", tariffOccupancy: 5, acMode: "non-ac", ratePerPersonPaise: 109_900 },
  { roomGroupId: "double-bed", tariffOccupancy: 6, acMode: "ac", ratePerPersonPaise: 119_900 },
  { roomGroupId: "double-bed", tariffOccupancy: 6, acMode: "non-ac", ratePerPersonPaise: 99_900 },
] as const;

export function findTariffPaise(
  roomGroupId: RoomGroupId,
  tariffOccupancy: number,
  acMode: AcMode,
): number | null {
  return (
    tariffTable.find(
      (entry) =>
        entry.roomGroupId === roomGroupId &&
        entry.tariffOccupancy === tariffOccupancy &&
        entry.acMode === acMode,
    )?.ratePerPersonPaise ?? null
  );
}
