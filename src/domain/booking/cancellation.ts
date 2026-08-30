import { roundBasisPoints } from "@/domain/booking/pricing";

export const CANCELLATION_POLICY_VERSION = "hdbc-2026-01";

const slabs = [
  { id: "within-24h", label: "Within 24 hours", maxHours: 24, basisPoints: 10_000 },
  { id: "within-48h", label: "Within 48 hours", maxHours: 48, basisPoints: 5_000 },
  { id: "within-7d", label: "Within 7 days", maxHours: 7 * 24, basisPoints: 3_000 },
  { id: "within-15d", label: "Within 15 days", maxHours: 15 * 24, basisPoints: 2_000 },
  { id: "within-30d", label: "Within 30 days", maxHours: 30 * 24, basisPoints: 1_000 },
  { id: "beyond-30d", label: "More than 30 days", maxHours: Number.POSITIVE_INFINITY, basisPoints: 0 },
] as const;

export function quoteCancellationPaise(hoursUntilCheckIn: number, advancePaidPaise: number) {
  const slab = slabs.find((candidate) => hoursUntilCheckIn <= candidate.maxHours) ?? slabs.at(-1)!;
  const deductionPaise = roundBasisPoints(advancePaidPaise, slab.basisPoints);
  return {
    policyVersion: CANCELLATION_POLICY_VERSION,
    slabId: slab.id,
    slabLabel: slab.label,
    hoursUntilCheckIn,
    advancePaidPaise,
    deductionBasisPoints: slab.basisPoints,
    deductionPaise,
    refundablePaise: Math.max(0, advancePaidPaise - deductionPaise),
  };
}
