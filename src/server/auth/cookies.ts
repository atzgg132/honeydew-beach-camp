import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/contracts/errors";

export const cookies = {
  checkout: "hd_checkout",
  checkoutCsrf: "hd_checkout_csrf",
  manage: "hd_manage",
  manageCsrf: "hd_manage_csrf",
} as const;

const secure = process.env.NODE_ENV === "production";

export function setOpaqueSessionCookies(
  response: NextResponse,
  kind: "checkout" | "manage",
  token: string,
  csrf: string,
  expires: Date,
) {
  const sessionName = kind === "checkout" ? cookies.checkout : cookies.manage;
  const csrfName = kind === "checkout" ? cookies.checkoutCsrf : cookies.manageCsrf;
  response.cookies.set(sessionName, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires,
  });
  response.cookies.set(csrfName, csrf, {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    expires,
  });
}

export function clearSessionCookies(response: NextResponse, kind: "checkout" | "manage") {
  const sessionName = kind === "checkout" ? cookies.checkout : cookies.manage;
  const csrfName = kind === "checkout" ? cookies.checkoutCsrf : cookies.manageCsrf;
  response.cookies.set(sessionName, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set(csrfName, "", { httpOnly: false, secure, sameSite: "strict", path: "/", maxAge: 0 });
}

export function assertMutationSecurity(request: NextRequest, kind: "checkout" | "manage") {
  const expectedCookie = kind === "checkout" ? cookies.checkoutCsrf : cookies.manageCsrf;
  const csrfCookie = request.cookies.get(expectedCookie)?.value;
  const csrfHeader = request.headers.get("x-csrf-token");
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
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

export function readSessionToken(request: NextRequest, kind: "checkout" | "manage") {
  const name = kind === "checkout" ? cookies.checkout : cookies.manage;
  const value = request.cookies.get(name)?.value;
  if (!value) throw new ApiError(401, `${kind.toUpperCase()}_SESSION_REQUIRED`, "Verification is required.");
  return value;
}
