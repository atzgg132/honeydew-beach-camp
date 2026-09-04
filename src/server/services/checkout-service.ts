import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { BookingContactInput } from "@/contracts/booking";
import { ApiError } from "@/contracts/errors";
import { priceBookingPaise } from "@/domain/booking/pricing";
import { validateRoomIntent } from "@/domain/booking/validation";
import { deriveToken, sha256 } from "@/server/crypto";
import { db } from "@/server/db/client";
import { customerBookingInclude, toCustomerBooking } from "@/server/dto";
import { allocateRooms } from "@/server/services/allocation";
import { dateOnlyToUtc } from "@/server/services/availability-service";
import { loadCurrentBookingConfig } from "@/server/services/booking-config-service";
import { bookingMoneyFields, bookingRoomCreateData, contactFields, reservationRows } from "@/server/services/booking-record";
import { createQuote, readQuoteToken } from "@/server/services/quote-service";
import { withSerializableRetry } from "@/server/services/serializable";

function requestHash(quoteToken: string, contact: BookingContactInput) {
  return sha256(JSON.stringify({ quoteToken, contact }));
}

export async function createHold(input: {
  quoteToken: string;
  contact: BookingContactInput;
  idempotencyKey: string;
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
    throw new ApiError(409, "QUOTE_CHANGED", "The price has changed. Review the current quote.", undefined, { replacementQuote });
  }

  const keyHash = sha256(input.idempotencyKey);
  const hash = requestHash(input.quoteToken, input.contact);
  const existing = await db().idempotencyRequest.findUnique({
    where: { scope_keyHash: { scope: "create-hold", keyHash } },
  });
  if (existing) {
    if (existing.requestHash !== hash || !existing.bookingId || !existing.responseBody) {
      throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "That idempotency key was used for another request.");
    }
    const body = existing.responseBody as { holdId: string; expiresAt: string };
    return sessionResult(body.holdId, body.expiresAt, input.idempotencyKey);
  }

  try {
    return await withSerializableRetry(() =>
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

        const expiresAt = new Date(now.getTime() + config.policyRevision.holdTtlMinutes * 60_000);
        const bookingId = randomUUID();
        const roomIds = price.rooms.map(() => randomUUID());
        await transaction.booking.create({
          data: {
            id: bookingId,
            ...contactFields(input.contact),
            ...bookingMoneyFields(price, intent.composition, {
              source: "ONLINE",
              status: "PENDING_PAYMENT",
              tariffRevisionId: config.tariffRevision.id,
              policyRevisionId: config.policyRevision.id,
              checkIn: start,
              checkOut: end,
              holdExpiresAt: expiresAt,
              outstandingPaise: price.subtotalPaise,
            }),
            rooms: { create: bookingRoomCreateData(price, groupNames, roomIds) },
            events: {
              create: { type: "HOLD_CREATED", actorType: "CUSTOMER", data: { expiresAt: expiresAt.toISOString() } },
            },
          },
        });
        await transaction.roomReservation.createMany({
          data: reservationRows({
            roomIds,
            assigned,
            checkIn: start,
            checkOut: end,
            state: "HELD",
            expiresAt,
          }),
        });

        const token = deriveToken("checkout-session", bookingId, input.idempotencyKey);
        const csrf = deriveToken("checkout-csrf", bookingId, input.idempotencyKey);
        await transaction.checkoutSession.create({
          data: { bookingId, tokenHash: sha256(token), csrfHash: sha256(csrf), expiresAt: new Date(expiresAt.getTime() + 24 * 60 * 60_000) },
        });
        const responseBody = { holdId: bookingId, expiresAt: expiresAt.toISOString() };
        await transaction.idempotencyRequest.create({
          data: {
            scope: "create-hold",
            keyHash,
            requestHash: hash,
            bookingId,
            responseStatus: 200,
            responseBody,
            expiresAt: new Date(now.getTime() + 24 * 60 * 60_000),
          },
        });
        return sessionResult(bookingId, expiresAt.toISOString(), input.idempotencyKey);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 },
      ),
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const replay = await db().idempotencyRequest.findUnique({
        where: { scope_keyHash: { scope: "create-hold", keyHash } },
      });
      if (replay?.requestHash === hash && replay.bookingId && replay.responseBody) {
        const body = replay.responseBody as { holdId: string; expiresAt: string };
        return sessionResult(body.holdId, body.expiresAt, input.idempotencyKey);
      }
    }
    throw error;
  }
}

function sessionResult(holdId: string, expiresAt: string, idempotencyKey: string) {
  return {
    data: { holdId, expiresAt, paymentReady: process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_PAYMENT === "true" },
    token: deriveToken("checkout-session", holdId, idempotencyKey),
    csrf: deriveToken("checkout-csrf", holdId, idempotencyKey),
    cookieExpiresAt: new Date(new Date(expiresAt).getTime() + 24 * 60 * 60_000),
  };
}

export async function getCheckoutStatus(bookingId: string) {
  const record = await db().booking.findUnique({ where: { id: bookingId }, include: customerBookingInclude });
  if (!record) throw new ApiError(404, "NOT_FOUND", "The checkout was not found.");
  return {
    holdId: record.id,
    status: record.status.toLowerCase(),
    expiresAt: record.holdExpiresAt?.toISOString() ?? null,
    booking: record.status === "CONFIRMED" || record.status === "CANCELLED" ? toCustomerBooking(record) : null,
  };
}
