import "server-only";
import { Prisma, type BookingRoom } from "@prisma/client";
import { z } from "zod";
import type { BookingContactInput, CompositionInput, QuoteRequestInput, RoomIntentInput } from "@/contracts/booking";
import { ApiError } from "@/contracts/errors";
import { quoteCancellationPaise } from "@/domain/booking/cancellation";
import { priceBookingPaise } from "@/domain/booking/pricing";
import { canTransition } from "@/domain/booking/state-machine";
import { distributeGuests } from "@/lib/booking/distribute";
import { istDateTime } from "@/lib/dates";
import { last10Digits } from "@/lib/format";
import { phoneLookupHash, sha256, signPayload, verifyPayload } from "@/server/crypto";
import { db } from "@/server/db/client";
import { customerBookingInclude, toCustomerBooking } from "@/server/dto";
import { isRoomFree, lockRoomsForGroups } from "@/server/services/allocation";
import { loadTariffRevision } from "@/server/services/booking-config-service";

const MUTATION_QUOTE_TTL_SECONDS = 5 * 60;

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function assertSelfService(record: { status: string; checkIn: Date }) {
  if (record.status !== "CONFIRMED") throw new ApiError(409, "INVALID_STATE", "This booking cannot be changed.");
  if (new Date() >= istDateTime(dateOnly(record.checkIn), "11:00")) {
    throw new ApiError(409, "SELF_SERVICE_CLOSED", "This stay can no longer be changed online.");
  }
}

async function getRecord(bookingId: string) {
  const record = await db().booking.findUnique({ where: { id: bookingId }, include: customerBookingInclude });
  if (!record) throw new ApiError(404, "NOT_FOUND", "The booking was not found.");
  return record;
}

async function lockBooking(transaction: Prisma.TransactionClient, bookingId: string) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "Booking" WHERE "id" = ${bookingId}::uuid FOR UPDATE
  `);
  if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "The booking was not found.");
}

function assertSameIdempotentRequest(data: Prisma.JsonValue, expectedHash: string) {
  const recorded = typeof data === "object" && data !== null && !Array.isArray(data) ? data.requestHash : undefined;
  if (recorded !== expectedHash) {
    throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "That idempotency key was used for another request.");
  }
}

export async function getManagedBooking(bookingId: string) {
  return toCustomerBooking(await getRecord(bookingId));
}

export async function updateManagedContact(bookingId: string, contact: BookingContactInput, idempotencyKey: string) {
  const requestHash = sha256(JSON.stringify(contact));
  return db().$transaction(async (transaction) => {
    await lockBooking(transaction, bookingId);
    const existing = await transaction.bookingEvent.findFirst({ where: { bookingId, type: "CONTACT_UPDATED", idempotencyKey } });
    if (existing) {
      assertSameIdempotentRequest(existing.data, requestHash);
      return toCustomerBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: customerBookingInclude }));
    }
    const record = await transaction.booking.findUnique({ where: { id: bookingId } });
    if (!record) throw new ApiError(404, "NOT_FOUND", "The booking was not found.");
    assertSelfService(record);
    const phone = `+91${last10Digits(contact.phone)}`;
    await transaction.booking.update({
      where: { id: bookingId },
      data: {
        contactFullName: contact.fullName,
        contactPhoneE164: phone,
        contactPhoneLookupHash: phoneLookupHash(phone),
        contactEmail: contact.email.toLowerCase(),
        events: {
          create: { type: "CONTACT_UPDATED", actorType: "CUSTOMER", idempotencyKey, data: { fields: ["name", "phone", "email"], requestHash } },
        },
      },
    });
    const updated = await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: customerBookingInclude });
    return toCustomerBooking(updated);
  });
}

function evenParts(total: number, count: number, min: number, max: number): number[] | null {
  if (count === 0) return total === 0 ? [] : null;
  if (total < count * min || total > count * max) return null;
  const base = Math.floor(total / count);
  const remainder = total % count;
  const parts = Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
  return parts.some((part) => part < min || part > max) ? null : parts;
}

function rebalanceRooms(rooms: BookingRoom[], composition: CompositionInput): RoomIntentInput[] | null {
  const singles = rooms.filter((room) => room.roomGroupId === "single-bed");
  const doubles = rooms.filter((room) => room.roomGroupId === "double-bed");
  const totalGuests = composition.adults + composition.childrenUnder5 + composition.children5to10;
  for (let doubleTotal = doubles.length * 4; doubleTotal <= doubles.length * 6; doubleTotal += 1) {
    const singleTotal = totalGuests - doubleTotal;
    const doubleParts = evenParts(doubleTotal, doubles.length, 4, 6);
    const singleParts = evenParts(singleTotal, singles.length, 1, 3);
    if (!doubleParts || !singleParts) continue;
    const ordered = rooms.map((room) => ({
      roomGroupId: room.roomGroupId as "single-bed" | "double-bed",
      occupancy:
        room.roomGroupId === "double-bed"
          ? doubleParts[doubles.findIndex((candidate) => candidate.id === room.id)]
          : singleParts[singles.findIndex((candidate) => candidate.id === room.id)],
    }));
    const distributed = distributeGuests(composition, ordered);
    return distributed.map((allocation, index) => ({
      clientId: rooms[index].id,
      roomGroupId: allocation.roomGroupId,
      acMode: rooms[index].acMode === "AC" ? "ac" : "non-ac",
      composition: allocation.composition,
    }));
  }
  return null;
}

async function priceExistingBooking(record: Awaited<ReturnType<typeof getRecord>>, rooms: RoomIntentInput[]) {
  const tariff = await loadTariffRevision(record.tariffRevisionId);
  const input: QuoteRequestInput = {
    checkIn: dateOnly(record.checkIn),
    checkOut: dateOnly(record.checkOut),
    composition: {
      adults: rooms.reduce((sum, room) => sum + room.composition.adults, 0),
      childrenUnder5: rooms.reduce((sum, room) => sum + room.composition.childrenUnder5, 0),
      children5to10: rooms.reduce((sum, room) => sum + room.composition.children5to10, 0),
    },
    rooms,
  };
  return { input, price: priceBookingPaise(input, tariff.rates, record.advanceBasisPoints) };
}

const mutationPayload = z.object({
  purpose: z.enum(["guest-change", "ac-upgrade"]),
  bookingId: z.string().uuid(),
  roomId: z.string().uuid().optional(),
  composition: z.object({ adults: z.number().int(), childrenUnder5: z.number().int(), children5to10: z.number().int() }).optional(),
  subtotalPaise: z.number().int(),
  expiresAt: z.number().int(),
});

function signMutation(value: Omit<z.infer<typeof mutationPayload>, "expiresAt">) {
  return signPayload({ ...value, expiresAt: Math.floor(Date.now() / 1000) + MUTATION_QUOTE_TTL_SECONDS }, "manage-mutation");
}

function readMutation(token: string, purpose: "guest-change" | "ac-upgrade") {
  const result = mutationPayload.safeParse(verifyPayload(token, "manage-mutation"));
  if (!result.success || result.data.purpose !== purpose) throw new ApiError(400, "INVALID_QUOTE", "The change quote is invalid.");
  if (result.data.expiresAt < Math.floor(Date.now() / 1000)) throw new ApiError(409, "QUOTE_EXPIRED", "The change quote expired.");
  return result.data;
}

export async function quoteGuestChange(bookingId: string, composition: CompositionInput) {
  const record = await getRecord(bookingId);
  assertSelfService(record);
  const rooms = rebalanceRooms(record.rooms, composition);
  if (!rooms) throw new ApiError(422, "GROUP_CHANGE_REQUIRED", "This change needs a different mix of rooms.");
  const { price } = await priceExistingBooking(record, rooms);
  return {
    price,
    deltaPaise: price.subtotalPaise - record.subtotalPaise,
    quoteToken: signMutation({ purpose: "guest-change", bookingId, composition, subtotalPaise: price.subtotalPaise }),
  };
}

export async function applyGuestChange(bookingId: string, token: string, idempotencyKey: string) {
  const payload = readMutation(token, "guest-change");
  if (payload.bookingId !== bookingId || !payload.composition) throw new ApiError(400, "INVALID_QUOTE", "The change quote is invalid.");
  const composition = payload.composition;
  const requestHash = sha256(token);
  return db().$transaction(async (transaction) => {
    await lockBooking(transaction, bookingId);
    const existing = await transaction.bookingEvent.findFirst({ where: { bookingId, type: "GUESTS_CHANGED", idempotencyKey } });
    if (existing) {
      assertSameIdempotentRequest(existing.data, requestHash);
      return toCustomerBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: customerBookingInclude }));
    }
    const record = await transaction.booking.findUnique({ where: { id: bookingId }, include: customerBookingInclude });
    if (!record) throw new ApiError(404, "NOT_FOUND", "The booking was not found.");
    assertSelfService(record);
    const rooms = rebalanceRooms(record.rooms, composition);
    if (!rooms) throw new ApiError(422, "GROUP_CHANGE_REQUIRED", "This change needs a different mix of rooms.");
    const { price } = await priceExistingBooking(record, rooms);
    if (price.subtotalPaise !== payload.subtotalPaise) throw new ApiError(409, "QUOTE_CHANGED", "The change price has changed.");
    for (let index = 0; index < price.rooms.length; index += 1) {
      const room = price.rooms[index];
      await transaction.bookingRoom.update({
        where: { id: room.clientId },
        data: {
          adults: room.composition.adults,
          childrenUnder5: room.composition.childrenUnder5,
          children5To10: room.composition.children5to10,
          physicalOccupancy: room.physicalOccupancy,
          billingHalfUnits: room.billingHalfUnits,
          tariffOccupancy: room.tariffOccupancy,
          ratePerPersonPaise: room.ratePerPersonPaise,
          nightlyTotalPaise: room.nightlyTotalPaise,
          stayTotalPaise: room.stayTotalPaise,
        },
      });
    }
    await transaction.booking.update({
      where: { id: bookingId },
      data: {
        adults: composition.adults,
        childrenUnder5: composition.childrenUnder5,
        children5To10: composition.children5to10,
        subtotalPaise: price.subtotalPaise,
        outstandingPaise: Math.max(0, price.subtotalPaise - record.advancePaidPaise),
        events: { create: { type: "GUESTS_CHANGED", actorType: "CUSTOMER", idempotencyKey, deltaPaise: price.subtotalPaise - record.subtotalPaise, data: { beforeTotalPaise: record.subtotalPaise, afterTotalPaise: price.subtotalPaise, requestHash } } },
      },
    });
    return toCustomerBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: customerBookingInclude }));
  });
}

export async function quoteAcUpgrade(bookingId: string, roomId: string) {
  const record = await getRecord(bookingId);
  assertSelfService(record);
  const target = record.rooms.find((room) => room.id === roomId);
  if (!target) throw new ApiError(404, "ROOM_NOT_FOUND", "The room was not found.");
  if (target.acMode === "AC") throw new ApiError(409, "ALREADY_AC", "This room already includes air-conditioning.");
  const rooms: RoomIntentInput[] = record.rooms.map((room) => ({
    clientId: room.id,
    roomGroupId: room.roomGroupId as "single-bed" | "double-bed",
    acMode: room.id === roomId ? "ac" : room.acMode === "AC" ? "ac" : "non-ac",
    composition: { adults: room.adults, childrenUnder5: room.childrenUnder5, children5to10: room.children5To10 },
  }));
  const { price } = await priceExistingBooking(record, rooms);
  return {
    price,
    deltaPaise: price.subtotalPaise - record.subtotalPaise,
    quoteToken: signMutation({ purpose: "ac-upgrade", bookingId, roomId, subtotalPaise: price.subtotalPaise }),
  };
}

export async function applyAcUpgrade(bookingId: string, roomId: string, token: string, idempotencyKey: string) {
  const payload = readMutation(token, "ac-upgrade");
  if (payload.bookingId !== bookingId || payload.roomId !== roomId) throw new ApiError(400, "INVALID_QUOTE", "The upgrade quote is invalid.");
  const requestHash = sha256(token);
  return db().$transaction(async (transaction) => {
    await lockBooking(transaction, bookingId);
    const existing = await transaction.bookingEvent.findFirst({ where: { bookingId, type: "AC_UPGRADED", idempotencyKey } });
    if (existing) {
      assertSameIdempotentRequest(existing.data, requestHash);
      return toCustomerBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: customerBookingInclude }));
    }
    const booking = await transaction.booking.findUnique({ where: { id: bookingId }, include: customerBookingInclude });
    if (!booking) throw new ApiError(404, "NOT_FOUND", "The booking was not found.");
    assertSelfService(booking);
    const target = booking.rooms.find((candidate) => candidate.id === roomId);
    if (!target) throw new ApiError(404, "ROOM_NOT_FOUND", "The room was not found.");
    if (target.acMode === "AC") throw new ApiError(409, "ALREADY_AC", "This room already includes air-conditioning.");
    const intents: RoomIntentInput[] = booking.rooms.map((candidate) => ({
      clientId: candidate.id,
      roomGroupId: candidate.roomGroupId as "single-bed" | "double-bed",
      acMode: candidate.id === roomId ? "ac" : candidate.acMode === "AC" ? "ac" : "non-ac",
      composition: { adults: candidate.adults, childrenUnder5: candidate.childrenUnder5, children5to10: candidate.children5To10 },
    }));
    const { price } = await priceExistingBooking(booking, intents);
    if (price.subtotalPaise !== payload.subtotalPaise) throw new ApiError(409, "QUOTE_CHANGED", "The upgrade price has changed.");
    const room = price.rooms.find((candidate) => candidate.clientId === roomId);
    if (!room) throw new ApiError(404, "ROOM_NOT_FOUND", "The room was not found.");

    // Selling an upgrade says nothing about whether the physical room can deliver it. The
    // reservation must end up on a room that actually supports air-conditioning, otherwise
    // the guest is charged for something the camp cannot provide.
    const reservation = await transaction.roomReservation.findFirst({
      where: { bookingRoomId: roomId, state: { in: ["HELD", "CONFIRMED"] } },
      select: { id: true, roomId: true, checkIn: true, checkOut: true, room: { select: { supportsAc: true, roomGroupId: true } } },
    });
    if (!reservation) throw new ApiError(409, "INVALID_STATE", "This room has no active reservation.");

    if (!reservation.room.supportsAc) {
      // Try to move the stay to an air-conditioned room in the same group. The exclusion
      // constraint arbitrates if two upgrades race for the same room.
      const candidates = await lockRoomsForGroups(transaction, [reservation.room.roomGroupId]);
      let moved = false;
      for (const candidate of candidates) {
        if (!candidate.supportsAc || candidate.id === reservation.roomId) continue;
        const free = await isRoomFree(transaction, {
          roomId: candidate.id,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          ignoreReservationId: reservation.id,
        });
        if (!free) continue;
        await transaction.roomReservation.update({
          where: { id: reservation.id },
          data: { roomId: candidate.id },
        });
        moved = true;
        break;
      }
      if (!moved) {
        throw new ApiError(
          409,
          "AC_NOT_AVAILABLE",
          "No air-conditioned room is free for these dates. Please call the property.",
        );
      }
    }

    const deltaPaise = price.subtotalPaise - booking.subtotalPaise;
    await transaction.bookingRoom.update({
      where: { id: roomId },
      data: { acMode: "AC", ratePerPersonPaise: room.ratePerPersonPaise, nightlyTotalPaise: room.nightlyTotalPaise, stayTotalPaise: room.stayTotalPaise },
    });
    await transaction.booking.update({
      where: { id: bookingId },
      data: {
        subtotalPaise: price.subtotalPaise,
        outstandingPaise: Math.max(0, price.subtotalPaise - booking.advancePaidPaise),
        events: { create: { type: "AC_UPGRADED", actorType: "CUSTOMER", idempotencyKey, deltaPaise, data: { roomId, beforeTotalPaise: booking.subtotalPaise, afterTotalPaise: price.subtotalPaise, requestHash } } },
      },
    });
    return toCustomerBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: customerBookingInclude }));
  });
}

export async function getCancellationQuote(bookingId: string) {
  const record = await getRecord(bookingId);
  assertSelfService(record);
  const checkInInstant = istDateTime(dateOnly(record.checkIn), "11:00");
  const hours = (checkInInstant.getTime() - Date.now()) / 3_600_000;
  return quoteCancellationPaise(hours, record.advancePaidPaise);
}

export async function cancelManagedBooking(bookingId: string, idempotencyKey: string) {
  return db().$transaction(async (transaction) => {
    await lockBooking(transaction, bookingId);
    const existing = await transaction.bookingEvent.findFirst({ where: { bookingId, type: "BOOKING_CANCELLED", idempotencyKey } });
    if (existing) {
      return toCustomerBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: customerBookingInclude }));
    }
    const record = await transaction.booking.findUnique({ where: { id: bookingId } });
    if (!record) throw new ApiError(404, "NOT_FOUND", "The booking was not found.");
    if (record.status === "CANCELLED") {
      return toCustomerBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: customerBookingInclude }));
    }
    assertSelfService(record);
    if (!canTransition(record.status, "CANCELLED")) {
      throw new ApiError(409, "INVALID_STATE", "This booking cannot be cancelled.");
    }
    const hours = (istDateTime(dateOnly(record.checkIn), "11:00").getTime() - Date.now()) / 3_600_000;
    const quote = quoteCancellationPaise(hours, record.advancePaidPaise);
    const now = new Date();
    await transaction.roomReservation.updateMany({
      where: { bookingRoom: { bookingId }, state: "CONFIRMED" },
      data: { state: "RELEASED", releasedAt: now },
    });
    await transaction.cancellation.create({
      data: {
        bookingId,
        policyVersion: quote.policyVersion,
        slabId: quote.slabId,
        slabLabel: quote.slabLabel,
        hoursUntilCheckIn: new Prisma.Decimal(quote.hoursUntilCheckIn),
        advancePaidPaise: quote.advancePaidPaise,
        deductionBasisPoints: quote.deductionBasisPoints,
        deductionPaise: quote.deductionPaise,
        refundablePaise: quote.refundablePaise,
        // Nothing to refund means nothing for staff to review. Marking these
        // PENDING_HOTEL_REVIEW filled the refund queue with zero-value rows that could
        // never be actioned, which is how a real refund gets lost in the noise.
        refundStatus: quote.refundablePaise > 0 ? "PENDING_HOTEL_REVIEW" : "NOT_REQUIRED",
        cancelledAt: now,
      },
    });
    await transaction.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        outstandingPaise: 0,
        events: { create: { type: "BOOKING_CANCELLED", actorType: "CUSTOMER", idempotencyKey, data: { slabId: quote.slabId, deductionPaise: quote.deductionPaise, refundablePaise: quote.refundablePaise } } },
      },
    });
    return toCustomerBooking(await transaction.booking.findUniqueOrThrow({ where: { id: bookingId }, include: customerBookingInclude }));
  });
}
