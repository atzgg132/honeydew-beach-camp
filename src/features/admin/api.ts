import type { BookingContactInput, BookingPriceDto, CompositionInput, QuoteRequestInput } from "@/contracts/booking";
import type { StaffBooking, StaffBookingListItem } from "@/features/admin/types";

interface ErrorEnvelope {
  error?: { code?: string; message?: string; fields?: Record<string, string[]>; requestId?: string };
}

export class AdminApiError extends Error {
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
  return (
    document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) ?? null
  );
}

async function api<T>(path: string, init: RequestInit = {}, csrf = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (csrf) {
    const value = cookie("hd_admin_csrf");
    if (value) headers.set("x-csrf-token", decodeURIComponent(value));
  }
  const response = await fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  const body =
    response.status === 204 ? null : ((await response.json().catch(() => null)) as ({ data?: T } & ErrorEnvelope) | null);
  if (!response.ok) {
    throw new AdminApiError(
      response.status,
      body?.error?.code ?? "REQUEST_FAILED",
      body?.error?.message ?? "The request could not be completed.",
    );
  }
  return body?.data as T;
}

async function idempotencyKey(scope: string, payload?: unknown): Promise<string> {
  const material = JSON.stringify([scope, payload ?? null]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${scope}-${hex.slice(0, 32)}`;
}

async function commandHeaders(scope: string, payload?: unknown) {
  return { "Idempotency-Key": await idempotencyKey(scope, payload) };
}

export async function adminLogin(email: string, password: string) {
  return api<{ email: string }>("/api/admin/session", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function adminLogout() {
  return api<void>("/api/admin/session", { method: "DELETE" }, true);
}

export async function adminAccept(token: string, password: string) {
  return api<{ email: string }>("/api/admin/accept", { method: "POST", body: JSON.stringify({ token, password }) });
}

export async function adminInvite(email: string) {
  return api<{ email: string; acceptUrl: string }>("/api/admin/invitations", {
    method: "POST",
    body: JSON.stringify({ email }),
  }, true);
}

export async function adminSearchAvailability(input: { checkIn: string; checkOut: string; composition: CompositionInput }) {
  return api<{
    availability: { "single-bed": number; "double-bed": number };
    arrangements: Array<{
      id: string;
      rooms: Array<{ roomGroupId: "single-bed" | "double-bed"; occupancy: number }>;
      nightlyEstimateAcPaise: number;
      nightlyEstimateNonAcPaise: number;
      labels: string[];
    }>;
  }>("/api/admin/availability/search", { method: "POST", body: JSON.stringify(input) });
}

export async function adminQuote(input: QuoteRequestInput) {
  return api<{ price: BookingPriceDto; quoteToken: string; expiresAt: string }>("/api/admin/quotes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function adminCreateBooking(input: {
  source: "PHONE" | "WALK_IN";
  quoteToken: string;
  contact: BookingContactInput;
  collectedPaise: number;
}) {
  return api<StaffBooking>(
    "/api/admin/bookings",
    { method: "POST", headers: await commandHeaders("admin-create", input), body: JSON.stringify(input) },
    true,
  );
}

export async function adminUpdateContact(bookingId: string, contact: BookingContactInput) {
  return api<StaffBooking>(
    `/api/admin/bookings/${bookingId}/contact`,
    { method: "PATCH", headers: await commandHeaders("admin-contact", contact), body: JSON.stringify(contact) },
    true,
  );
}

export async function adminQuoteGuestChange(bookingId: string, composition: CompositionInput) {
  return api<{ price: BookingPriceDto; deltaPaise: number; quoteToken: string }>(
    `/api/admin/bookings/${bookingId}/guest-change/quote`,
    { method: "POST", body: JSON.stringify({ composition }) },
  );
}

export async function adminApplyGuestChange(bookingId: string, quoteToken: string) {
  return api<StaffBooking>(
    `/api/admin/bookings/${bookingId}/guest-change`,
    { method: "POST", headers: await commandHeaders("admin-guests", quoteToken), body: JSON.stringify({ quoteToken }) },
    true,
  );
}

export async function adminQuoteUpgrade(bookingId: string, roomId: string) {
  return api<{ price: BookingPriceDto; deltaPaise: number; quoteToken: string }>(
    `/api/admin/bookings/${bookingId}/rooms/${roomId}/upgrade/quote`,
    { method: "POST" },
  );
}

export async function adminApplyUpgrade(bookingId: string, roomId: string, quoteToken: string) {
  return api<StaffBooking>(
    `/api/admin/bookings/${bookingId}/rooms/${roomId}/upgrade`,
    { method: "POST", headers: await commandHeaders("admin-upgrade", { roomId, quoteToken }), body: JSON.stringify({ quoteToken }) },
    true,
  );
}

export async function adminAssignableRooms(bookingId: string, roomId: string) {
  return api<Array<{ id: string; roomNumber: string; supportsAc: boolean; current: boolean; free: boolean }>>(
    `/api/admin/bookings/${bookingId}/rooms/${roomId}/reassign`,
  );
}

export async function adminReassign(bookingId: string, bookingRoomId: string, roomId: string) {
  return api<StaffBooking>(
    `/api/admin/bookings/${bookingId}/rooms/${bookingRoomId}/reassign`,
    { method: "POST", headers: await commandHeaders("admin-reassign", { bookingRoomId, roomId }), body: JSON.stringify({ roomId }) },
    true,
  );
}

export async function adminCancelQuote(bookingId: string) {
  return api<{
    slabLabel: string;
    hoursUntilCheckIn: number;
    advancePaidPaise: number;
    deductionBasisPoints: number;
    deductionPaise: number;
    refundablePaise: number;
  }>(`/api/admin/bookings/${bookingId}/cancellation/quote`, { method: "POST" });
}

export async function adminCancel(bookingId: string) {
  return api<StaffBooking>(
    `/api/admin/bookings/${bookingId}/cancel`,
    { method: "POST", headers: await commandHeaders("admin-cancel", bookingId) },
    true,
  );
}

export async function adminExpireHold(bookingId: string) {
  return api<StaffBooking>(
    `/api/admin/bookings/${bookingId}/expire-hold`,
    { method: "POST", headers: await commandHeaders("admin-expire", bookingId) },
    true,
  );
}

export async function adminCollect(bookingId: string, amountPaise: number, note?: string) {
  return api<StaffBooking>(
    `/api/admin/bookings/${bookingId}/collections`,
    { method: "POST", headers: await commandHeaders("admin-collect", { amountPaise, note }), body: JSON.stringify({ amountPaise, note }) },
    true,
  );
}

export async function adminAllocateUnallocated(bookingId: string) {
  return api<StaffBooking>(
    `/api/admin/bookings/${bookingId}/paid-unallocated/allocate`,
    { method: "POST", headers: await commandHeaders("admin-allocate", bookingId) },
    true,
  );
}

export async function adminNoteUnallocatedRefund(bookingId: string, note: string) {
  return api<StaffBooking>(
    `/api/admin/bookings/${bookingId}/paid-unallocated/note`,
    { method: "POST", headers: await commandHeaders("admin-unallocated-note", { bookingId, note }), body: JSON.stringify({ note }) },
    true,
  );
}

export async function adminRefundAction(
  cancellationId: string,
  body: { action: "approve" } | { action: "reject" } | { action: "process"; actualRefundPaise: number; reference?: string },
) {
  return api<StaffBooking>(`/api/admin/cancellations/${cancellationId}/refund`, {
    method: "POST",
    body: JSON.stringify(body),
  }, true);
}

export async function adminCreateBlock(input: { roomId: string; checkIn: string; checkOut: string; reason: string }) {
  return api<{ id: string; roomNumber: string }>(
    "/api/admin/room-blocks",
    { method: "POST", body: JSON.stringify(input) },
    true,
  );
}

export async function adminReleaseBlock(blockId: string) {
  return api<{ id: string; released: boolean }>(
    `/api/admin/room-blocks/${blockId}/release`,
    { method: "POST" },
    true,
  );
}

export async function adminPublishTariff(rates: Array<{
  roomGroupId: "single-bed" | "double-bed";
  tariffOccupancy: number;
  acMode: "ac" | "non-ac";
  ratePerPersonPaise: number;
}>) {
  return api<{ revision: number }>("/api/admin/tariff-revisions", { method: "POST", body: JSON.stringify({ rates }) }, true);
}

export async function adminPublishPolicy(advancePercent: number) {
  return api<{ revision: number; advanceBasisPoints: number }>(
    "/api/admin/policy-revisions",
    { method: "POST", body: JSON.stringify({ advancePercent }) },
    true,
  );
}

export type { StaffBooking, StaffBookingListItem };
