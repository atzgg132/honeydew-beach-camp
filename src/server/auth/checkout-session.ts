import "server-only";
import type { NextRequest } from "next/server";
import { ApiError } from "@/contracts/errors";
import { cookies, readSessionToken } from "@/server/auth/cookies";
import { sha256 } from "@/server/crypto";
import { db } from "@/server/db/client";

export async function requireCheckoutSession(request: NextRequest, bookingId?: string) {
  const token = readSessionToken(request, "checkout");
  const session = await db().checkoutSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { booking: true },
  });
  const csrf = request.cookies.get(cookies.checkoutCsrf)?.value;
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    !csrf ||
    session.csrfHash !== sha256(csrf) ||
    (bookingId && session.bookingId !== bookingId)
  ) {
    throw new ApiError(401, "CHECKOUT_SESSION_REQUIRED", "The checkout session has expired.");
  }
  return session;
}
