import "server-only";
import type { QuoteRequestInput } from "@/contracts/booking";
import type { QuoteResponseDto, QuoteTokenPayload } from "@/contracts/checkout";
import { quoteTokenPayloadContract } from "@/contracts/checkout";
import { ApiError } from "@/contracts/errors";
import { priceBookingPaise } from "@/domain/booking/pricing";
import { validateRoomIntent } from "@/domain/booking/validation";
import { signPayload, verifyPayload } from "@/server/crypto";
import { getAvailabilityForDates } from "@/server/services/availability-service";
import { loadCurrentBookingConfig } from "@/server/services/booking-config-service";
import { onlinePaymentsEnabled } from "@/server/payments/runtime";

const QUOTE_TTL_SECONDS = 10 * 60;

function requestedCounts(input: QuoteRequestInput) {
  return {
    "single-bed": input.rooms.filter((room) => room.roomGroupId === "single-bed").length,
    "double-bed": input.rooms.filter((room) => room.roomGroupId === "double-bed").length,
  };
}

export async function createQuote(input: QuoteRequestInput): Promise<QuoteResponseDto> {
  validateRoomIntent(input);
  const [availability, config] = await Promise.all([
    getAvailabilityForDates(input.checkIn, input.checkOut),
    loadCurrentBookingConfig(),
  ]);
  const needed = requestedCounts(input);
  if (
    needed["single-bed"] > availability["single-bed"] ||
    needed["double-bed"] > availability["double-bed"]
  ) {
    throw new ApiError(409, "AVAILABILITY_CHANGED", "The selected rooms are no longer available.");
  }
  const price = priceBookingPaise(input, config.rates, config.policyRevision.advanceBasisPoints);
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + QUOTE_TTL_SECONDS;
  const payload: QuoteTokenPayload = {
    purpose: "booking-quote",
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    composition: input.composition,
    rooms: input.rooms,
    tariffRevisionId: config.tariffRevision.id,
    policyRevisionId: config.policyRevision.id,
    subtotalPaise: price.subtotalPaise,
    advancePaise: price.advancePaise,
    issuedAt,
    expiresAt,
  };
  return {
    price,
    quoteToken: signPayload(payload, "booking-quote"),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    tariffRevision: config.tariffRevision.revision,
    policyRevision: config.policyRevision.revision,
    paymentReady: onlinePaymentsEnabled(),
  };
}

export function readQuoteToken(token: string): QuoteTokenPayload {
  const parsed = quoteTokenPayloadContract.safeParse(verifyPayload(token, "booking-quote"));
  if (!parsed.success) throw new ApiError(400, "INVALID_QUOTE", "The quote is invalid.");
  if (parsed.data.expiresAt < Math.floor(Date.now() / 1000)) {
    throw new ApiError(409, "QUOTE_EXPIRED", "The quote has expired. Review the current price.");
  }
  return parsed.data;
}
