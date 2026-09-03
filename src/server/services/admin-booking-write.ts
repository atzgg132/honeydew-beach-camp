import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { BookingContactInput } from "@/contracts/booking";
import { ApiError } from "@/contracts/errors";
import { priceBookingPaise } from "@/domain/booking/pricing";
import { canTransition } from "@/domain/booking/state-machine";
import { validateRoomIntent } from "@/domain/booking/validation";
import type { AdminActor } from "@/server/auth/admin-session";
import { db } from "@/server/db/client";
import { staffBookingInclude, toStaffBooking } from "@/server/dto-admin";
import { allocateRooms } from "@/server/services/allocation";
import { dateOnlyToUtc } from "@/server/services/availability-service";
import { loadCurrentBookingConfig } from "@/server/services/booking-config-service";
import {
  bookingMoneyFields,
  bookingRoomCreateData,
  contactFields,
  reservationRows,
} from "@/server/services/booking-record";
import { createQuote, readQuoteToken } from "@/server/services/quote-service";
import { allocateReference } from "@/server/services/reference";
import { withSerializableRetry } from "@/server/services/serializable";
import { sha256 } from "@/server/crypto";

function hotelOrderIds() {
  const id = randomUUID();
  return { orderId: `hotel-${id}`, paymentId: `hotel-tx-${id}` };
}

export async function createStaffBooking(input: {
  source: "PHONE" | "WALK_IN";
  quoteToken: string;
  contact: BookingContactInput;
  collectedPaise: number;
  idempotencyKey: string;
  actor: AdminActor;
}) {
  const quote = readQuoteToken(input.quoteToken);
  const intent = {
    checkIn: quote.checkIn,
    checkOut: quote.checkOut,
    composition: quote.composition,
    rooms: quote.rooms,
  };
  validateRoomIntent(intent);
  const config = await loadCurrentBookingConfig();
  const groupNames = new Map(config.roomGroups.map((group) => [group.id, group.publicName]));
  const price = priceBookingPaise(intent, config.rates, config.policyRevision.advanceBasisPoints);
  if (
    quote.tariffRevisionId !== config.tariffRevision.id ||
    quote.policyRevisionId !== config.policyRevision.id ||
    quote.subtotalPaise !== price.subtotalPaise ||
    quote.advancePaise !== price.advancePaise
  ) {
    const replacementQuote = await createQuote(intent);
    throw new ApiError(409, "QUOTE_CHANGED", "The price has changed. Review the current quote.", undefined, {
      replacementQuote,
    });
  }
  if (input.collectedPaise > price.subtotalPaise) {
    throw new ApiError(400, "VALIDATION_ERROR", "Collected amount cannot exceed the stay total.", {
      collectedPaise: ["Collected amount cannot exceed the stay total."],
    });
  }

  const keyHash = sha256(input.idempotencyKey);
  const requestHash = sha256(JSON.stringify({ quoteToken: input.quoteToken, contact: input.contact, collectedPaise: input.collectedPaise }));
  const existing = await db().idempotencyRequest.findUnique({
    where: { scope_keyHash: { scope: "admin-create-booking", keyHash } },
  });
  if (existing) {
    if (existing.requestHash !== requestHash || !existing.bookingId) {
      throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "That idempotency key was used for another request.");
    }
    const record = await db().booking.findUniqueOrThrow({ where: { id: existing.bookingId }, include: staffBookingInclude });
    return toStaffBooking(record);
  }

  return withSerializableRetry(() =>
    db().$transaction(
      async (transaction) => {
        const start = dateOnlyToUtc(intent.checkIn);
        const end = dateOnlyToUtc(intent.checkOut);
        const now = new Date();
        const assigned = await allocateRooms(transaction, {
          intents: intent.rooms,
          checkIn: start,
          checkOut: end,
          now,
        });
        const bookingId = randomUUID();
        const roomIds = price.rooms.map(() => randomUUID());
        const reference = await allocateReference(transaction);
        const collected = input.collectedPaise;
        await transaction.booking.create({
          data: {
            id: bookingId,
            ...contactFields(input.contact),
            ...bookingMoneyFields(price, intent.composition, {
              source: input.source,
              status: "CONFIRMED",
              tariffRevisionId: config.tariffRevision.id,
              policyRevisionId: config.policyRevision.id,
              checkIn: start,
              checkOut: end,
              reference,
              advancePaidPaise: Math.min(collected, price.advancePaise),
              outstandingPaise: price.subtotalPaise - collected,
            }),
            confirmedAt: now,
            rooms: { create: bookingRoomCreateData(price, groupNames, roomIds) },
            events: {
              create: [
                {
                  type: "BOOKING_CREATED",
                  actorType: "ADMIN",
                  actorId: input.actor.id,
                  data: { source: input.source },
                },
                {
                  type: "BOOKING_CONFIRMED",
                  actorType: "ADMIN",
                  actorId: input.actor.id,
                  data: { collectedPaise: collected },
                },
              ],
            },
          },
        });
        await transaction.roomReservation.createMany({
          data: reservationRows({
            roomIds,
            assigned,
            checkIn: start,
            checkOut: end,
            state: "CONFIRMED",
          }),
        });
        if (collected > 0) {
          const ids = hotelOrderIds();
          await transaction.paymentOrder.create({
            data: {
              bookingId,
              provider: "hotel",
              providerOrderId: ids.orderId,
              status: "PAID",
              amountPaise: collected,
              currency: "INR",
              transactions: {
                create: {
                  provider: "hotel",
                  providerPaymentId: ids.paymentId,
                  status: "SUCCEEDED",
                  amountPaise: collected,
                  currency: "INR",
                  providerPaidAt: now,
                },
              },
            },
          });
        }
        await transaction.idempotencyRequest.create({
          data: {
            scope: "admin-create-booking",
            keyHash,
            requestHash,
            bookingId,
            responseStatus: 200,
            responseBody: { bookingId },
            expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
          },
        });
        const record = await transaction.booking.findUniqueOrThrow({
          where: { id: bookingId },
          include: staffBookingInclude,
        });
        return toStaffBooking(record);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 },
    ),
  );
}

export async function expireStaffHold(bookingId: string, actor: AdminActor, idempotencyKey: string) {
  const now = new Date();
  return db().$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId}::uuid FOR UPDATE`);
    const existing = await transaction.bookingEvent.findFirst({
      where: { bookingId, type: "HOLD_EXPIRED", idempotencyKey },
    });
    if (existing) {
      return toStaffBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: staffBookingInclude }));
    }
    const booking = await transaction.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new ApiError(404, "NOT_FOUND", "The booking was not found.");
    if (booking.status !== "PENDING_PAYMENT") {
      throw new ApiError(409, "INVALID_STATE", "Only an unpaid hold can be dropped.");
    }
    const paid = await transaction.paymentOrder.findFirst({
      where: { bookingId, status: { in: ["PAID", "PAID_UNALLOCATED"] } },
    });
    if (paid) {
      throw new ApiError(409, "INVALID_STATE", "This hold has a recorded payment. Resolve it from the payment exception.");
    }
    await transaction.roomReservation.updateMany({
      where: { bookingRoom: { bookingId }, state: "HELD" },
      data: { state: "RELEASED", releasedAt: now },
    });
    await transaction.paymentOrder.updateMany({
      where: { bookingId, status: { in: ["CREATED", "PENDING"] } },
      data: { status: "EXPIRED" },
    });
    await transaction.booking.update({
      where: { id: bookingId },
      data: {
        status: "EXPIRED",
        events: {
          create: {
            type: "HOLD_EXPIRED",
            actorType: "ADMIN",
            actorId: actor.id,
            idempotencyKey,
            data: { expiredAt: now.toISOString() },
          },
        },
      },
    });
    return toStaffBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: staffBookingInclude }));
  });
}

export async function allocatePaidUnallocated(bookingId: string, actor: AdminActor, idempotencyKey: string) {
  const now = new Date();
  return withSerializableRetry(() =>
    db().$transaction(
      async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId}::uuid FOR UPDATE`);
        const existing = await transaction.bookingEvent.findFirst({
          where: { bookingId, type: "BOOKING_CONFIRMED", idempotencyKey },
        });
        if (existing) {
          return toStaffBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: staffBookingInclude }));
        }
        const booking = await transaction.booking.findUnique({
          where: { id: bookingId },
          include: { rooms: { orderBy: { displayOrder: "asc" } }, payments: true },
        });
        if (!booking) throw new ApiError(404, "NOT_FOUND", "The booking was not found.");
        const order = booking.payments.find((payment) => payment.status === "PAID_UNALLOCATED");
        if (!order) throw new ApiError(409, "INVALID_STATE", "There is no unallocated payment on this booking.");
        if (booking.status === "CONFIRMED") {
          throw new ApiError(409, "INVALID_STATE", "This booking is already confirmed.");
        }
        if (booking.status !== "PENDING_PAYMENT" && booking.status !== "EXPIRED") {
          throw new ApiError(409, "INVALID_STATE", "This payment exception cannot be allocated.");
        }
        if (!canTransition(booking.status === "EXPIRED" ? "PENDING_PAYMENT" : booking.status, "CONFIRMED") && booking.status !== "EXPIRED") {
          throw new ApiError(409, "INVALID_STATE", "This booking cannot be confirmed.");
        }
        await transaction.roomReservation.updateMany({
          where: { bookingRoom: { bookingId }, state: { in: ["HELD", "CONFIRMED"] } },
          data: { state: "RELEASED", releasedAt: now },
        });
        const assigned = await allocateRooms(transaction, {
          intents: booking.rooms.map((room) => ({
            roomGroupId: room.roomGroupId,
            acMode: room.acMode === "AC" ? "ac" : "non-ac",
          })),
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          now,
        });
        const reference = booking.reference ?? (await allocateReference(transaction));
        await transaction.roomReservation.createMany({
          data: booking.rooms.map((room, index) => ({
            roomId: assigned[index].id,
            bookingRoomId: room.id,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            state: "CONFIRMED" as const,
          })),
        });
        await transaction.paymentOrder.update({ where: { id: order.id }, data: { status: "PAID" } });
        await transaction.booking.update({
          where: { id: bookingId },
          data: {
            status: "CONFIRMED",
            reference,
            advancePaidPaise: order.amountPaise,
            outstandingPaise: Math.max(0, booking.subtotalPaise - order.amountPaise),
            confirmedAt: now,
            events: {
              create: {
                type: "BOOKING_CONFIRMED",
                actorType: "ADMIN",
                actorId: actor.id,
                idempotencyKey,
                data: { paymentOrderId: order.id, resolvedPaidUnallocated: true },
              },
            },
          },
        });
        return toStaffBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: staffBookingInclude }));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 },
    ),
  );
}

export async function notePaidUnallocatedRefund(
  bookingId: string,
  actor: AdminActor,
  note: string,
  idempotencyKey: string,
) {
  const trimmed = note.trim();
  if (trimmed.length < 2) {
    throw new ApiError(400, "VALIDATION_ERROR", "Add a short note about the out-of-band refund.");
  }
  return db().$transaction(async (transaction) => {
    const existing = await transaction.bookingEvent.findFirst({
      where: { bookingId, type: "PAYMENT_UNALLOCATED_NOTED", idempotencyKey },
    });
    if (existing) {
      return toStaffBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: staffBookingInclude }));
    }
    const booking = await transaction.booking.findUnique({
      where: { id: bookingId },
      include: { payments: true },
    });
    if (!booking) throw new ApiError(404, "NOT_FOUND", "The booking was not found.");
    const order = booking.payments.find((payment) => payment.status === "PAID_UNALLOCATED");
    if (!order) throw new ApiError(409, "INVALID_STATE", "There is no unallocated payment on this booking.");
    await transaction.bookingEvent.create({
      data: {
        bookingId,
        type: "PAYMENT_UNALLOCATED_NOTED",
        actorType: "ADMIN",
        actorId: actor.id,
        idempotencyKey,
        data: { paymentOrderId: order.id, note: trimmed },
      },
    });
    return toStaffBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: staffBookingInclude }));
  });
}
