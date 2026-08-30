import "server-only";
import type { NextRequest } from "next/server";
import { ApiError } from "@/contracts/errors";
import { last10Digits } from "@/lib/format";
import { cookies, readSessionToken } from "@/server/auth/cookies";
import { phoneLookupHash, randomToken, safeEqualHex, sha256 } from "@/server/crypto";
import { db } from "@/server/db/client";
import { customerBookingInclude, toCustomerBooking } from "@/server/dto";
import { consumeRateLimit } from "@/server/rate-limit";

const SESSION_TTL_MS = 30 * 60_000;

export async function verifyManageBooking(request: NextRequest, reference: string, phone: string) {
  const normalizedReference = reference.trim().toUpperCase();
  await consumeRateLimit({ request, scope: "manage-ip", windowSeconds: 60 * 60, limit: 30 });
  const record = await db().booking.findUnique({
    where: { reference: normalizedReference },
    include: customerBookingInclude,
  });
  const normalizedPhone = `+91${last10Digits(phone)}`;
  const candidateHash = phoneLookupHash(normalizedPhone);
  const storedHash = record?.contactPhoneLookupHash ?? phoneLookupHash("+910000000000");
  const valid = safeEqualHex(storedHash, candidateHash);
  if (!record || !valid || !record.reference || record.status === "PENDING_PAYMENT" || record.status === "EXPIRED") {
    await consumeRateLimit({ request, scope: "manage-reference", discriminator: normalizedReference, windowSeconds: 15 * 60, limit: 5 });
    throw new ApiError(401, "VERIFICATION_FAILED", "No booking matches those details.");
  }
  const token = randomToken();
  const csrf = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db().manageSession.create({
    data: { bookingId: record.id, tokenHash: sha256(token), csrfHash: sha256(csrf), expiresAt },
  });
  return { booking: toCustomerBooking(record), token, csrf, expiresAt };
}

export async function requireManageSession(request: NextRequest) {
  const token = readSessionToken(request, "manage");
  const session = await db().manageSession.findUnique({
    where: { tokenHash: sha256(token) },
  });
  const csrf = request.cookies.get(cookies.manageCsrf)?.value;
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !csrf || session.csrfHash !== sha256(csrf)) {
    throw new ApiError(401, "MANAGE_SESSION_REQUIRED", "The Manage Booking session has expired.");
  }
  return session;
}

export async function revokeManageSession(request: NextRequest) {
  const token = readSessionToken(request, "manage");
  await db().manageSession.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
