import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { AcMode, PrismaClient } from "@prisma/client";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL is required to seed Honey Dew.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const roomGroups = [
  {
    id: "single-bed",
    slug: "single-bed",
    publicName: "Single-Bed Room",
    occupancyMin: 1,
    occupancyMax: 3,
  },
  {
    id: "double-bed",
    slug: "double-bed",
    publicName: "Double-Bed Room",
    occupancyMin: 4,
    occupancyMax: 6,
  },
] as const;

const rooms = [
  ["401", "single-bed"],
  ["402", "single-bed"],
  ["405", "single-bed"],
  ["407", "single-bed"],
  ["403", "double-bed"],
  ["404", "double-bed"],
  ["406", "double-bed"],
] as const;

const rates = [
  ["single-bed", 2, AcMode.AC, 149_900],
  ["single-bed", 2, AcMode.NON_AC, 119_900],
  ["single-bed", 3, AcMode.AC, 139_900],
  ["single-bed", 3, AcMode.NON_AC, 109_900],
  ["double-bed", 4, AcMode.AC, 139_900],
  ["double-bed", 4, AcMode.NON_AC, 119_900],
  ["double-bed", 5, AcMode.AC, 129_900],
  ["double-bed", 5, AcMode.NON_AC, 109_900],
  ["double-bed", 6, AcMode.AC, 119_900],
  ["double-bed", 6, AcMode.NON_AC, 99_900],
] as const;

async function main() {
  await prisma.hotelSettings.upsert({
    where: { id: "primary" },
    create: {
      id: "primary",
      timezone: "Asia/Kolkata",
      currency: "INR",
      checkInLocalMinutes: 11 * 60,
      checkOutLocalMinutes: 10 * 60,
      minNights: 1,
      maxNights: 30,
    },
    update: {
      timezone: "Asia/Kolkata",
      currency: "INR",
      checkInLocalMinutes: 11 * 60,
      checkOutLocalMinutes: 10 * 60,
      minNights: 1,
      maxNights: 30,
    },
  });

  for (const group of roomGroups) {
    await prisma.roomGroup.upsert({
      where: { id: group.id },
      create: group,
      update: {
        slug: group.slug,
        publicName: group.publicName,
        occupancyMin: group.occupancyMin,
        occupancyMax: group.occupancyMax,
        active: true,
      },
    });
  }

  for (const [roomNumber, roomGroupId] of rooms) {
    await prisma.room.upsert({
      where: { roomNumber },
      create: { roomNumber, roomGroupId, supportsAc: true },
      update: { roomGroupId, supportsAc: true, active: true },
    });
  }

  const tariffRevision = await prisma.tariffRevision.upsert({
    where: { revision: 1 },
    create: {
      revision: 1,
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    },
    update: {},
  });

  await prisma.tariffRate.createMany({
    data: rates.map(([roomGroupId, tariffOccupancy, acMode, ratePerPersonPaise]) => ({
      tariffRevisionId: tariffRevision.id,
      roomGroupId,
      tariffOccupancy,
      acMode,
      ratePerPersonPaise,
    })),
    skipDuplicates: true,
  });

  await prisma.bookingPolicyRevision.upsert({
    where: { revision: 1 },
    create: {
      revision: 1,
      advanceBasisPoints: 3000,
      holdTtlMinutes: 15,
      effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
    },
    update: {},
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
