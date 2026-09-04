import "server-only";
import { ApiError } from "@/contracts/errors";
import type { AdminActor } from "@/server/auth/admin-session";
import { db } from "@/server/db/client";
import { loadCurrentBookingConfig } from "@/server/services/booking-config-service";

const REQUIRED_RATES = [
  { roomGroupId: "single-bed", tariffOccupancy: 2, acMode: "ac" },
  { roomGroupId: "single-bed", tariffOccupancy: 2, acMode: "non-ac" },
  { roomGroupId: "single-bed", tariffOccupancy: 3, acMode: "ac" },
  { roomGroupId: "single-bed", tariffOccupancy: 3, acMode: "non-ac" },
  { roomGroupId: "double-bed", tariffOccupancy: 4, acMode: "ac" },
  { roomGroupId: "double-bed", tariffOccupancy: 4, acMode: "non-ac" },
  { roomGroupId: "double-bed", tariffOccupancy: 5, acMode: "ac" },
  { roomGroupId: "double-bed", tariffOccupancy: 5, acMode: "non-ac" },
  { roomGroupId: "double-bed", tariffOccupancy: 6, acMode: "ac" },
  { roomGroupId: "double-bed", tariffOccupancy: 6, acMode: "non-ac" },
] as const;

export async function getAdminPricing() {
  const config = await loadCurrentBookingConfig();
  return {
    tariffRevision: config.tariffRevision.revision,
    tariffRevisionId: config.tariffRevision.id,
    policyRevision: config.policyRevision.revision,
    advanceBasisPoints: config.policyRevision.advanceBasisPoints,
    holdTtlMinutes: config.policyRevision.holdTtlMinutes,
    rates: REQUIRED_RATES.map((cell) => {
      const rate = config.rates.find(
        (candidate) =>
          candidate.roomGroupId === cell.roomGroupId &&
          candidate.tariffOccupancy === cell.tariffOccupancy &&
          candidate.acMode === cell.acMode,
      );
      return { ...cell, ratePerPersonPaise: rate?.ratePerPersonPaise ?? 0 };
    }),
  };
}

export async function publishTariffRevision(
  rates: Array<{
    roomGroupId: "single-bed" | "double-bed";
    tariffOccupancy: number;
    acMode: "ac" | "non-ac";
    ratePerPersonPaise: number;
  }>,
  actor: AdminActor,
) {
  for (const required of REQUIRED_RATES) {
    const match = rates.find(
      (rate) =>
        rate.roomGroupId === required.roomGroupId &&
        rate.tariffOccupancy === required.tariffOccupancy &&
        rate.acMode === required.acMode,
    );
    if (!match) {
      throw new ApiError(400, "VALIDATION_ERROR", "Every tariff cell must be filled.");
    }
    if (match.ratePerPersonPaise % 2 !== 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "Each rate must be an even number of paise.");
    }
  }
  const now = new Date();
  return db().$transaction(async (transaction) => {
    const current = await transaction.tariffRevision.findFirst({
      where: { retiredAt: null },
      orderBy: { revision: "desc" },
    });
    if (!current) throw new ApiError(503, "BOOKING_CONFIG_MISSING", "Booking configuration is incomplete.");
    await transaction.tariffRevision.update({ where: { id: current.id }, data: { retiredAt: now } });
    const created = await transaction.tariffRevision.create({
      data: {
        revision: current.revision + 1,
        effectiveFrom: now,
        createdBy: actor.id,
        rates: {
          create: rates.map((rate) => ({
            roomGroupId: rate.roomGroupId,
            tariffOccupancy: rate.tariffOccupancy,
            acMode: rate.acMode === "ac" ? "AC" : "NON_AC",
            ratePerPersonPaise: rate.ratePerPersonPaise,
          })),
        },
      },
    });
    return { revision: created.revision, id: created.id };
  });
}

export async function publishPolicyRevision(advancePercent: number, actor: AdminActor) {
  if (advancePercent < 0 || advancePercent > 100) {
    throw new ApiError(400, "VALIDATION_ERROR", "Advance must be between 0 and 100 percent.");
  }
  const now = new Date();
  return db().$transaction(async (transaction) => {
    const current = await transaction.bookingPolicyRevision.findFirst({
      where: { retiredAt: null },
      orderBy: { revision: "desc" },
    });
    if (!current) throw new ApiError(503, "BOOKING_CONFIG_MISSING", "Booking configuration is incomplete.");
    await transaction.bookingPolicyRevision.update({ where: { id: current.id }, data: { retiredAt: now } });
    const created = await transaction.bookingPolicyRevision.create({
      data: {
        revision: current.revision + 1,
        advanceBasisPoints: advancePercent * 100,
        holdTtlMinutes: current.holdTtlMinutes,
        effectiveFrom: now,
        createdBy: actor.id,
      },
    });
    return { revision: created.revision, advanceBasisPoints: created.advanceBasisPoints };
  });
}
