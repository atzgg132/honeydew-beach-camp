import "server-only";
import { Prisma } from "@prisma/client";
import type { CompositionInput } from "@/contracts/booking";
import { generateServerArrangements } from "@/domain/booking/arrangements";
import { db } from "@/server/db/client";
import { loadCurrentBookingConfig } from "@/server/services/booking-config-service";
import type { Availability } from "@/types";

export function dateOnlyToUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function expireStaleHolds(now = new Date()): Promise<number> {
  const prisma = db();
  return prisma.$transaction(async (transaction) => {
    const expired = await transaction.booking.findMany({
      where: {
        status: "PENDING_PAYMENT",
        holdExpiresAt: { lte: now },
        payments: { none: { status: "PAID" } },
      },
      select: { id: true },
    });
    const bookingIds = expired.map((booking) => booking.id);
    if (bookingIds.length === 0) return 0;
    await transaction.$queryRaw(Prisma.sql`
      SELECT "id" FROM "Booking"
      WHERE "id" IN (${Prisma.join(bookingIds)})
      ORDER BY "id"
      FOR UPDATE
    `);
    const stillExpired = await transaction.booking.findMany({
      where: {
        id: { in: bookingIds },
        status: "PENDING_PAYMENT",
        holdExpiresAt: { lte: now },
        payments: { none: { status: "PAID" } },
      },
      select: { id: true },
    });
    const lockedBookingIds = stillExpired.map((booking) => booking.id);
    if (lockedBookingIds.length === 0) return 0;
    await transaction.roomReservation.updateMany({
      where: {
        state: "HELD",
        bookingRoom: { bookingId: { in: lockedBookingIds } },
      },
      data: { state: "RELEASED", releasedAt: now },
    });
    await transaction.paymentOrder.updateMany({
      where: { bookingId: { in: lockedBookingIds }, status: { in: ["CREATED", "PENDING"] } },
      data: { status: "EXPIRED" },
    });
    await transaction.booking.updateMany({
      where: { id: { in: lockedBookingIds }, status: "PENDING_PAYMENT" },
      data: { status: "EXPIRED" },
    });
    await transaction.bookingEvent.createMany({
      data: lockedBookingIds.map((bookingId) => ({
        bookingId,
        type: "HOLD_EXPIRED",
        actorType: "SYSTEM" as const,
        data: { expiredAt: now.toISOString() },
      })),
      skipDuplicates: true,
    });
    return lockedBookingIds.length;
  });
}

export async function getAvailabilityForDates(checkIn: string, checkOut: string): Promise<Availability> {
  const prisma = db();
  const start = dateOnlyToUtc(checkIn);
  const end = dateOnlyToUtc(checkOut);
  const now = new Date();
  const [groups, occupied] = await Promise.all([
    prisma.room.groupBy({ by: ["roomGroupId"], where: { active: true }, _count: { _all: true } }),
    prisma.room.findMany({
      where: {
        active: true,
        reservations: {
          some: {
            OR: [
              { state: "CONFIRMED" },
              { state: "HELD", expiresAt: { gt: now } },
            ],
            checkIn: { lt: end },
            checkOut: { gt: start },
          },
        },
      },
      select: { roomGroupId: true },
    }),
  ]);
  const total = (group: string) => groups.find((entry) => entry.roomGroupId === group)?._count._all ?? 0;
  const used = (group: string) => occupied.filter((room) => room.roomGroupId === group).length;
  return {
    "single-bed": Math.max(0, total("single-bed") - used("single-bed")),
    "double-bed": Math.max(0, total("double-bed") - used("double-bed")),
  };
}

export async function searchAvailability(input: {
  checkIn: string;
  checkOut: string;
  composition: CompositionInput;
}) {
  const [availability, config] = await Promise.all([
    getAvailabilityForDates(input.checkIn, input.checkOut),
    loadCurrentBookingConfig(),
  ]);
  return {
    availability,
    arrangements: generateServerArrangements(input.composition, availability, config.rates),
    currency: config.settings.currency,
    tariffRevision: config.tariffRevision.revision,
  };
}
