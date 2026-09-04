import "server-only";
import type { NextRequest } from "next/server";
import { cookies as nextCookies } from "next/headers";
import { ApiError } from "@/contracts/errors";
import { hashPassword, verifyPassword } from "@/lib/password";
import { siteUrl } from "@/lib/site";
import { cookies, csrfCookieName, readSessionToken, sessionCookieName } from "@/server/auth/cookies";
import { randomToken, sha256 } from "@/server/crypto";
import { db } from "@/server/db/client";
import { consumeRateLimit } from "@/server/rate-limit";

const SESSION_TTL_MS = 12 * 60 * 60_000;
const INVITATION_TTL_MS = 24 * 60 * 60_000;
const MIN_PASSWORD_LENGTH = 12;

export interface AdminActor {
  id: string;
  email: string;
}

export interface AdminSessionRecord {
  id: string;
  adminUserId: string;
  email: string;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function assertPasswordStrength(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 200) {
    throw new ApiError(400, "VALIDATION_ERROR", "Choose a password of at least 12 characters.", {
      password: ["Choose a password of at least 12 characters."],
    });
  }
}

async function dummyPasswordHash() {
  return hashPassword("not-a-real-admin-password-used-only-for-timing");
}

async function mintSession(adminUserId: string) {
  const token = randomToken();
  const csrf = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db().adminSession.create({
    data: { adminUserId, tokenHash: sha256(token), csrfHash: sha256(csrf), expiresAt },
  });
  return { token, csrf, expiresAt };
}

async function loadSession(token: string, csrf: string | undefined): Promise<AdminSessionRecord> {
  const session = await db().adminSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { adminUser: { select: { id: true, email: true, disabledAt: true, acceptedAt: true, passwordHash: true } } },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    !csrf ||
    session.csrfHash !== sha256(csrf) ||
    session.adminUser.disabledAt ||
    !session.adminUser.acceptedAt ||
    !session.adminUser.passwordHash
  ) {
    throw new ApiError(401, "ADMIN_SESSION_REQUIRED", "Sign in is required.");
  }
  return { id: session.id, adminUserId: session.adminUserId, email: session.adminUser.email };
}

export async function requireAdminSession(request: NextRequest): Promise<AdminSessionRecord> {
  const token = readSessionToken(request, "admin");
  const csrf = request.cookies.get(cookies.adminCsrf)?.value;
  return loadSession(token, csrf);
}

export async function getAdminPageSession(): Promise<AdminSessionRecord | null> {
  const store = await nextCookies();
  const token = store.get(sessionCookieName("admin"))?.value;
  const csrf = store.get(csrfCookieName("admin"))?.value;
  if (!token) return null;
  try {
    return await loadSession(token, csrf);
  } catch {
    return null;
  }
}

export async function revokeAdminSession(request: NextRequest) {
  const token = readSessionToken(request, "admin");
  await db().adminSession.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function loginAdmin(request: NextRequest, email: string, password: string) {
  await consumeRateLimit({ request, scope: "admin-login-ip", windowSeconds: 60 * 60, limit: 30 });
  const normalized = normalizeEmail(email);
  await consumeRateLimit({
    request,
    scope: "admin-login-email",
    discriminator: normalized,
    windowSeconds: 15 * 60,
    limit: 5,
  });
  const user = await db().adminUser.findUnique({ where: { email: normalized } });
  const storedHash = user?.passwordHash ?? (await dummyPasswordHash());
  const valid = await verifyPassword(password, storedHash);
  if (!user || !user.passwordHash || !user.acceptedAt || user.disabledAt || !valid) {
    throw new ApiError(401, "ADMIN_LOGIN_FAILED", "Those details do not match an administrator.");
  }
  const session = await mintSession(user.id);
  return { ...session, email: user.email };
}

export async function acceptAdminInvitation(token: string, password: string) {
  assertPasswordStrength(password);
  const invitation = await db().adminInvitation.findUnique({
    where: { tokenHash: sha256(token) },
    include: { adminUser: true },
  });
  const now = new Date();
  if (!invitation || invitation.consumedAt || invitation.expiresAt <= now || invitation.adminUser.disabledAt) {
    throw new ApiError(400, "INVITATION_INVALID", "This invitation is not valid.");
  }
  const passwordHash = await hashPassword(password);
  await db().$transaction(async (transaction) => {
    await transaction.adminInvitation.update({
      where: { id: invitation.id },
      data: { consumedAt: now },
    });
    await transaction.adminUser.update({
      where: { id: invitation.adminUserId },
      data: { passwordHash, acceptedAt: now },
    });
  });
  const session = await mintSession(invitation.adminUserId);
  return { ...session, email: invitation.adminUser.email };
}

export async function inviteAdmin(email: string, invitedBy: AdminActor) {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) {
    throw new ApiError(400, "VALIDATION_ERROR", "Enter a valid email address.", {
      email: ["Enter a valid email address."],
    });
  }
  const existing = await db().adminUser.findUnique({ where: { email: normalized } });
  if (existing?.acceptedAt && existing.passwordHash && !existing.disabledAt) {
    throw new ApiError(409, "ADMIN_EXISTS", "That address already has access.");
  }
  const now = new Date();
  const token = randomToken();
  const user =
    existing ??
    (await db().adminUser.create({
      data: { email: normalized },
    }));
  await db().adminInvitation.updateMany({
    where: { adminUserId: user.id, consumedAt: null },
    data: { consumedAt: now },
  });
  await db().adminInvitation.create({
    data: {
      email: normalized,
      tokenHash: sha256(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      adminUserId: user.id,
    },
  });
  return {
    email: normalized,
    acceptUrl: `${siteUrl}/admin/accept?token=${encodeURIComponent(token)}`,
    invitedBy: invitedBy.email,
  };
}

export async function bootstrapFirstAdmin(email: string) {
  const normalized = normalizeEmail(email);
  const count = await db().adminUser.count();
  if (count > 0) {
    throw new Error("An administrator already exists. Refusing to bootstrap again.");
  }
  const token = randomToken();
  const now = new Date();
  const user = await db().adminUser.create({ data: { email: normalized } });
  await db().adminInvitation.create({
    data: {
      email: normalized,
      tokenHash: sha256(token),
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
      adminUserId: user.id,
    },
  });
  return {
    email: normalized,
    acceptUrl: `${siteUrl}/admin/accept?token=${encodeURIComponent(token)}`,
  };
}
