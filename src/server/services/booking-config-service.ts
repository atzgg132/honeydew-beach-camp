import "server-only";
import { ApiError } from "@/contracts/errors";
import type { TariffRateValue } from "@/domain/booking/pricing";
import { db } from "@/server/db/client";

export async function loadCurrentBookingConfig() {
  const prisma = db();
  const [settings, roomGroups, tariffRevision, policyRevision] = await Promise.all([
    prisma.hotelSettings.findUnique({ where: { id: "primary" } }),
    prisma.roomGroup.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    prisma.tariffRevision.findFirst({
      where: { retiredAt: null, effectiveFrom: { lte: new Date() } },
      orderBy: { revision: "desc" },
      include: { rates: true },
    }),
    prisma.bookingPolicyRevision.findFirst({
      where: { retiredAt: null, effectiveFrom: { lte: new Date() } },
      orderBy: { revision: "desc" },
    }),
  ]);
  if (!settings || !tariffRevision || !policyRevision) {
    throw new ApiError(503, "BOOKING_CONFIG_MISSING", "Booking configuration is incomplete.");
  }
  const rates: TariffRateValue[] = tariffRevision.rates.map((rate) => ({
    roomGroupId: rate.roomGroupId,
    tariffOccupancy: rate.tariffOccupancy,
    acMode: rate.acMode === "AC" ? "ac" : "non-ac",
    ratePerPersonPaise: rate.ratePerPersonPaise,
  }));
  return { settings, roomGroups, tariffRevision, policyRevision, rates };
}

export async function loadTariffRevision(id: string) {
  const revision = await db().tariffRevision.findUnique({ where: { id }, include: { rates: true } });
  if (!revision) throw new ApiError(409, "TARIFF_REVISION_MISSING", "The booking tariff is unavailable.");
  return {
    revision,
    rates: revision.rates.map<TariffRateValue>((rate) => ({
      roomGroupId: rate.roomGroupId,
      tariffOccupancy: rate.tariffOccupancy,
      acMode: rate.acMode === "AC" ? "ac" : "non-ac",
      ratePerPersonPaise: rate.ratePerPersonPaise,
    })),
  };
}
