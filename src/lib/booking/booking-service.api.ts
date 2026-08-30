import type { BookingPriceDto, QuoteRequestInput } from "@/contracts/booking";
import type { ServerArrangement } from "@/domain/booking/arrangements";
import type { Arrangement, Availability, Booking, BookingContact, BookingPricingSnapshot, CancellationQuote, GuestComposition, RoomAllocation } from "@/types";

interface ErrorEnvelope {
  error?: { code?: string; message?: string; fields?: Record<string, string[]>; requestId?: string };
}

export class BookingApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function cookie(name: string) {
  if (typeof document === "undefined") return null;
  const prefix = `${encodeURIComponent(name)}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) ?? null;
}

async function api<T>(path: string, init: RequestInit = {}, csrf?: "checkout" | "manage"): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (csrf) {
    const value = cookie(csrf === "checkout" ? "hd_checkout_csrf" : "hd_manage_csrf");
    if (value) headers.set("x-csrf-token", decodeURIComponent(value));
  }
  const response = await fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  const body = response.status === 204 ? null : ((await response.json().catch(() => null)) as ({ data?: T } & ErrorEnvelope) | null);
  if (!response.ok) {
    throw new BookingApiError(
      response.status,
      body?.error?.code ?? "REQUEST_FAILED",
      body?.error?.message ?? "The request could not be completed.",
    );
  }
  return body?.data as T;
}

function commandHeaders() {
  return { "Idempotency-Key": crypto.randomUUID() };
}

function quoteInput(
  checkIn: string,
  checkOut: string,
  composition: GuestComposition,
  rooms: RoomAllocation[],
): QuoteRequestInput {
  return {
    checkIn,
    checkOut,
    composition,
    rooms: rooms.map((room) => ({
      clientId: room.id,
      roomGroupId: room.roomGroupId,
      acMode: room.acMode,
      composition: room.composition,
    })),
  };
}

export function priceDtoToSnapshot(price: BookingPriceDto): BookingPricingSnapshot {
  return {
    rooms: price.rooms.map((room) => ({
      roomGroupId: room.roomGroupId,
      acMode: room.acMode,
      physicalOccupancy: room.physicalOccupancy,
      tariffOccupancy: room.tariffOccupancy,
      composition: room.composition,
      tariffPerPerson: room.ratePerPersonPaise / 100,
      billableUnits: room.billingHalfUnits / 2,
      nightlyTotal: room.nightlyTotalPaise / 100,
      nights: room.nights,
      stayTotal: room.stayTotalPaise / 100,
    })),
    nights: price.nights,
    subtotal: price.subtotalPaise / 100,
    advancePercent: price.advanceBasisPoints / 100,
    advance: price.advancePaise / 100,
    balance: price.balancePaise / 100,
  };
}

export async function searchAvailability(input: {
  checkIn: string;
  checkOut: string;
  composition: GuestComposition;
}): Promise<{ availability: Availability; arrangements: Arrangement[] }> {
  const result = await api<{ availability: Availability; arrangements: ServerArrangement[] }>("/api/availability/search", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return {
    availability: result.availability,
    arrangements: result.arrangements.map((item) => ({
      id: item.id,
      rooms: item.rooms,
      nightlyEstimateAc: item.nightlyEstimateAcPaise / 100,
      nightlyEstimateNonAc: item.nightlyEstimateNonAcPaise / 100,
      labels: item.labels,
    })),
  };
}

export async function quoteBooking(input: {
  checkIn: string;
  checkOut: string;
  composition: GuestComposition;
  rooms: RoomAllocation[];
}) {
  return api<{ price: BookingPriceDto; quoteToken: string; expiresAt: string }>("/api/quotes", {
    method: "POST",
    body: JSON.stringify(quoteInput(input.checkIn, input.checkOut, input.composition, input.rooms)),
  });
}

export async function createCheckoutHold(quoteToken: string, contact: BookingContact) {
  return api<{ holdId: string; expiresAt: string; paymentReady: boolean }>("/api/checkout/holds", {
    method: "POST",
    headers: commandHeaders(),
    body: JSON.stringify({ quoteToken, contact }),
  });
}

export async function createPaymentOrder(holdId: string) {
  return api<{ orderId: string; amountPaise: number; currency: string; clientData: { mode?: string } }>(
    `/api/checkout/holds/${encodeURIComponent(holdId)}/payment-order`,
    { method: "POST", headers: commandHeaders() },
    "checkout",
  );
}

export async function succeedDevelopmentPayment(orderId: string) {
  return api<{ bookingId: string; status: string; reference?: string }>(
    `/api/dev/payments/${encodeURIComponent(orderId)}/succeed`,
    { method: "POST" },
    "checkout",
  );
}

export async function getCheckout(holdId: string) {
  return api<{ holdId: string; status: string; expiresAt: string | null; booking: Booking | null }>(
    `/api/checkout/holds/${encodeURIComponent(holdId)}`,
  );
}

export async function getManagedBooking() {
  return api<Booking>("/api/manage-booking");
}

export async function verifyManagedBooking(reference: string, phone: string) {
  return api<{ booking: Booking }>("/api/manage-booking/verify", {
    method: "POST",
    body: JSON.stringify({ reference, phone }),
  });
}

export async function logoutManagedBooking() {
  return api<void>("/api/manage-booking/session", { method: "DELETE" }, "manage");
}

export async function updateManagedContact(contact: BookingContact) {
  return api<Booking>(
    "/api/manage-booking/contact",
    { method: "PATCH", headers: commandHeaders(), body: JSON.stringify(contact) },
    "manage",
  );
}

export async function quoteManagedGuestChange(composition: GuestComposition) {
  return api<{ price: BookingPriceDto; deltaPaise: number; quoteToken: string }>(
    "/api/manage-booking/guest-change/quote",
    { method: "POST", body: JSON.stringify({ composition }) },
  );
}

export async function applyManagedGuestChange(quoteToken: string) {
  return api<Booking>(
    "/api/manage-booking/guest-change",
    { method: "POST", headers: commandHeaders(), body: JSON.stringify({ quoteToken }) },
    "manage",
  );
}

export async function quoteManagedAcUpgrade(roomId: string) {
  return api<{ price: BookingPriceDto; deltaPaise: number; quoteToken: string }>(
    `/api/manage-booking/rooms/${encodeURIComponent(roomId)}/upgrade/quote`,
    { method: "POST" },
  );
}

export async function applyManagedAcUpgrade(roomId: string, quoteToken: string) {
  return api<Booking>(
    `/api/manage-booking/rooms/${encodeURIComponent(roomId)}/upgrade`,
    { method: "POST", headers: commandHeaders(), body: JSON.stringify({ quoteToken }) },
    "manage",
  );
}

interface CancellationQuotePaise {
  policyVersion: string;
  slabId: string;
  slabLabel: string;
  hoursUntilCheckIn: number;
  advancePaidPaise: number;
  deductionBasisPoints: number;
  deductionPaise: number;
  refundablePaise: number;
}

export async function quoteManagedCancellation(): Promise<CancellationQuote> {
  const quote = await api<CancellationQuotePaise>("/api/manage-booking/cancellation/quote", { method: "POST" });
  return {
    slab: {
      id: quote.slabId,
      maxHoursBeforeCheckIn: null,
      deductionPercent: quote.deductionBasisPoints / 100,
      label: quote.slabLabel,
      explanation: "Any refund is reviewed and processed by Honey Dew Beach Camp.",
    },
    hoursUntilCheckIn: quote.hoursUntilCheckIn,
    advancePaid: quote.advancePaidPaise / 100,
    deductionPercent: quote.deductionBasisPoints / 100,
    charge: quote.deductionPaise / 100,
    refundable: quote.refundablePaise / 100,
    refundControlledByHotel: true,
  };
}

export async function cancelManagedBooking() {
  return api<Booking>("/api/manage-booking/cancel", { method: "POST", headers: commandHeaders() }, "manage");
}
