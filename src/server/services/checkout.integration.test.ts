import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, todayIstDate } from "@/lib/dates";
import { db } from "@/server/db/client";
import { createHold } from "@/server/services/checkout-service";
import { createQuote } from "@/server/services/quote-service";

// test/setup/integration.ts points DATABASE_URL at the disposable database and refuses to
// run at all if that database looks like production.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

async function cleanBusinessData() {
  const prisma = db();
  await prisma.$transaction([
    prisma.paymentTransaction.deleteMany(),
    prisma.paymentOrder.deleteMany(),
    prisma.cancellation.deleteMany(),
    prisma.manageSession.deleteMany(),
    prisma.checkoutSession.deleteMany(),
    prisma.idempotencyRequest.deleteMany(),
    prisma.bookingEvent.deleteMany(),
    prisma.roomReservation.deleteMany(),
    prisma.roomBlock.deleteMany(),
    prisma.bookingRoom.deleteMany(),
    prisma.booking.deleteMany(),
    prisma.adminSession.deleteMany(),
    prisma.adminInvitation.deleteMany(),
    prisma.adminUser.deleteMany(),
  ]);
}

const contact = { fullName: "Integration Guest", phone: "9876543210", email: "integration@example.com" };

describe.skipIf(!testDatabaseUrl)("PostgreSQL checkout allocation", () => {
  beforeAll(async () => {
    const [rooms, tariffs, policies] = await Promise.all([
      db().room.count(),
      db().tariffRevision.count(),
      db().bookingPolicyRevision.count(),
    ]);
    if (rooms !== 7 || tariffs === 0 || policies === 0) {
      throw new Error("Apply migrations and run npm run db:seed against TEST_DATABASE_URL before integration tests.");
    }
  });

  beforeEach(cleanBusinessData);

  afterAll(async () => {
    await cleanBusinessData();
    await db().$disconnect();
  });

  it("allows exactly one winner when two requests race for the final physical room", async () => {
    const checkIn = addDays(todayIstDate(), 45);
    const checkOut = addDays(checkIn, 2);
    const prefillIntent = {
      checkIn,
      checkOut,
      composition: { adults: 3, childrenUnder5: 0, children5to10: 0 },
      rooms: [0, 1, 2].map((index) => ({
        clientId: `prefill-${index}`,
        roomGroupId: "single-bed" as const,
        acMode: "non-ac" as const,
        composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
      })),
    };
    const prefillQuote = await createQuote(prefillIntent);
    await createHold({ quoteToken: prefillQuote.quoteToken, contact, idempotencyKey: crypto.randomUUID() });

    const finalIntent = {
      checkIn,
      checkOut,
      composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
      rooms: [{
        clientId: "final-room",
        roomGroupId: "single-bed" as const,
        acMode: "non-ac" as const,
        composition: { adults: 1, childrenUnder5: 0, children5to10: 0 },
      }],
    };
    const [firstQuote, secondQuote] = await Promise.all([createQuote(finalIntent), createQuote(finalIntent)]);
    const results = await Promise.allSettled([
      createHold({ quoteToken: firstQuote.quoteToken, contact, idempotencyKey: crypto.randomUUID() }),
      createHold({ quoteToken: secondQuote.quoteToken, contact, idempotencyKey: crypto.randomUUID() }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toBeDefined();
    expect((rejected as PromiseRejectedResult).reason).toMatchObject({ code: "AVAILABILITY_CHANGED" });
  });

  it("reuses a room on the previous stay's checkout date", async () => {
    const firstCheckIn = addDays(todayIstDate(), 60);
    const handoffDate = addDays(firstCheckIn, 2);
    const intent = (checkIn: string, checkOut: string, id: string) => ({
      checkIn,
      checkOut,
      composition: { adults: 3, childrenUnder5: 0, children5to10: 0 },
      rooms: [{
        clientId: id,
        roomGroupId: "single-bed" as const,
        acMode: "non-ac" as const,
        composition: { adults: 3, childrenUnder5: 0, children5to10: 0 },
      }],
    });
    const first = await createQuote(intent(firstCheckIn, handoffDate, "first"));
    await createHold({ quoteToken: first.quoteToken, contact, idempotencyKey: crypto.randomUUID() });
    const second = await createQuote(intent(handoffDate, addDays(handoffDate, 1), "second"));
    await expect(createHold({ quoteToken: second.quoteToken, contact, idempotencyKey: crypto.randomUUID() })).resolves.toBeDefined();
  });
});
