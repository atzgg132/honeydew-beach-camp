import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/contracts/errors";

export type SessionKind = "checkout" | "manage" | "admin";

export const cookies = {
  checkout: "hd_checkout",
  checkoutCsrf: "hd_checkout_csrf",
  manage: "hd_manage",
  manageCsrf: "hd_manage_csrf",
  admin: "hd_admin",
  adminCsrf: "hd_admin_csrf",
} as const;

const sessionCookie: Record<SessionKind, string> = {
  checkout: cookies.checkout,
  manage: cookies.manage,
  admin: cookies.admin,
};

const csrfCookie: Record<SessionKind, string> = {
  checkout: cookies.checkoutCsrf,
  manage: cookies.manageCsrf,
  admin: cookies.adminCsrf,
};

const secure = process.env.NODE_ENV === "production";

export function setOpaqueSessionCookies(
  response: NextResponse,
  kind: SessionKind,
  token: string,
  csrf: string,
  expires: Date,
) {
  response.cookies.set(sessionCookie[kind], token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires,
  });
  response.cookies.set(csrfCookie[kind], csrf, {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    expires,
  });
}

export function clearSessionCookies(response: NextResponse, kind: SessionKind) {
  response.cookies.set(sessionCookie[kind], "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set(csrfCookie[kind], "", { httpOnly: false, secure, sameSite: "strict", path: "/", maxAge: 0 });
}

/**
 * Constant-time string comparison. A plain `!==` leaks how many leading characters matched
 * through its timing, which over enough requests is enough to reconstruct a token.
 */
function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function assertMutationSecurity(request: NextRequest, kind: SessionKind) {
  const csrfCookieValue = request.cookies.get(csrfCookie[kind])?.value;
  const csrfHeader = request.headers.get("x-csrf-token");
  if (!csrfCookieValue || !csrfHeader || !safeEqual(csrfCookieValue, csrfHeader)) {
    throw new ApiError(403, "CSRF_FAILED", "The request could not be verified.");
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }
  if (!originHost || !host || originHost !== host) {
    throw new ApiError(403, "ORIGIN_FAILED", "The request origin could not be verified.");
  }
}

export function readSessionToken(request: NextRequest, kind: SessionKind) {
  const value = request.cookies.get(sessionCookie[kind])?.value;
  if (!value) {
    const message = kind === "admin" ? "Sign in is required." : "Verification is required.";
    throw new ApiError(401, `${kind.toUpperCase()}_SESSION_REQUIRED`, message);
  }
  return value;
}

export function sessionCookieName(kind: SessionKind) {
  return sessionCookie[kind];
}

export function csrfCookieName(kind: SessionKind) {
  return csrfCookie[kind];
}
