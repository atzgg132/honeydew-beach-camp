import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/contracts/errors";
import type { AdminActor } from "@/server/auth/admin-session";
import { db } from "@/server/db/client";
import { getEmailProvider } from "@/server/notifications/provider";

export const REFUND_OTP_TTL_MINUTES = 10;
export const REFUND_OTP_MAX_ATTEMPTS = 5;
export const REFUND_OTP_REQUEST_WINDOW_MINUTES = 15;
export const REFUND_OTP_MAX_REQUESTS_PER_WINDOW = 5;

/** The inbox that must approve every automated refund. Overridable for tests. */
export function refundOtpEmail(): string {
  return process.env.REFUND_OTP_EMAIL?.trim() || "kuheli.mazumdar@gmail.com";
}

/** Six digits, zero-padded. Exported for tests. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * SHA-256 over `cancellationId:otp`, hex-encoded. Binding the hash to the
 * cancellation means a code issued for one refund can never verify another,
 * even if both challenges were live at once.
 */
export function hashOtp(otp: string, cancellationId: string): string {
  return createHash("sha256").update(`${cancellationId}:${otp}`, "utf8").digest("hex");
}

export function otpHashesMatch(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface RefundOtpMail {
  subject: string;
  text: string;
  html: string;
}

/** Rendered inline (not via the guest outbox): this is a staff security mail. */
export function renderRefundOtpMail(input: { otp: string; reference: string; refundablePaise: number }): RefundOtpMail {
  const rupees = (input.refundablePaise / 100).toFixed(2);
  const subject = `Refund approval code for booking ${input.reference}`;
  const text = [
    `A staff member requested an automated Razorpay refund for booking ${input.reference} (up to Rs ${rupees}; the exact amount is entered at confirmation).`,
    ``,
    `Approval code: ${input.otp}`,
    ``,
    `This code expires in ${REFUND_OTP_TTL_MINUTES} minutes and works once. If you did not expect this, ignore it and tell the team — the refund cannot proceed without the code.`,
  ].join("\n");
  const html = `<p>A staff member requested an automated Razorpay refund for booking <strong>${input.reference}</strong> (up to Rs ${rupees}; the exact amount is entered at confirmation).</p><p>Approval code: <strong>${input.otp}</strong></p><p>This code expires in ${REFUND_OTP_TTL_MINUTES} minutes and works once. If you did not expect this, ignore it and tell the team — the refund cannot proceed without the code.</p>`;
  return { subject, text, html };
}

export interface OtpChallenge {
  challengeId: string;
  expiresAt: string;
}

/**
 * Start two-step verification for an approved refund. Stores only the OTP hash,
 * then sends the code to the OTP inbox synchronously — the desk needs it now,
 * not on the next scheduler run. A failed send deletes the challenge so a dead
 * code never counts against the rate limit.
 */
export async function requestRefundOtp(input: { cancellationId: string; actor: AdminActor }): Promise<OtpChallenge> {
  const created = await db().$transaction(async (tx) => {
    const cancellation = await tx.cancellation.findUnique({
      where: { id: input.cancellationId },
      include: { booking: { select: { id: true, reference: true } } },
    });
    if (!cancellation) throw new ApiError(404, "NOT_FOUND", "The cancellation was not found.");
    if (cancellation.refundStatus !== "APPROVED") {
      throw new ApiError(409, "INVALID_STATE", "Only an approved refund can start OTP verification.");
    }
    const windowStart = new Date(Date.now() - REFUND_OTP_REQUEST_WINDOW_MINUTES * 60_000);
    const recent = await tx.refundOtpChallenge.count({
      where: { cancellationId: cancellation.id, createdAt: { gte: windowStart } },
    });
    if (recent >= REFUND_OTP_MAX_REQUESTS_PER_WINDOW) {
      throw new ApiError(429, "RATE_LIMITED", "Too many codes requested. Wait a few minutes and try again.");
    }
    const otp = generateOtp();
    const row = await tx.refundOtpChallenge.create({
      data: {
        cancellationId: cancellation.id,
        otpHash: hashOtp(otp, cancellation.id),
        expiresAt: new Date(Date.now() + REFUND_OTP_TTL_MINUTES * 60_000),
        maxAttempts: REFUND_OTP_MAX_ATTEMPTS,
        createdByAdminId: input.actor.id,
      },
      select: { id: true, expiresAt: true },
    });
    return { row, otp, reference: cancellation.booking.reference ?? cancellation.booking.id, refundablePaise: cancellation.refundablePaise };
  });

  try {
    const mail = renderRefundOtpMail({ otp: created.otp, reference: created.reference, refundablePaise: created.refundablePaise });
    await getEmailProvider().send({
      outboxId: created.row.id,
      template: "refund_otp",
      to: refundOtpEmail(),
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });
  } catch {
    await db().refundOtpChallenge.delete({ where: { id: created.row.id } }).catch(() => undefined);
    throw new ApiError(503, "OTP_SEND_FAILED", "The approval code could not be mailed. Try again.");
  }
  return { challengeId: created.row.id, expiresAt: created.row.expiresAt.toISOString() };
}

export interface ConsumeOtpInput {
  cancellationId: string;
  challengeId: string;
  otp: string;
}

/**
 * Verify a code inside the caller's transaction (so the refund claim and the
 * OTP consumption commit atomically). Wrong codes count against the attempt
 * budget; a consumed, expired, or exhausted challenge never verifies.
 */
export async function consumeRefundOtp(
  tx: Prisma.TransactionClient,
  input: ConsumeOtpInput,
): Promise<void> {
  const challenge = await tx.refundOtpChallenge.findUnique({ where: { id: input.challengeId } });
  if (!challenge || challenge.cancellationId !== input.cancellationId) {
    throw new ApiError(400, "OTP_INVALID", "That code is not valid. Request a new one.");
  }
  if (challenge.consumedAt) {
    throw new ApiError(400, "OTP_INVALID", "That code was already used. Request a new one.");
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, "OTP_EXPIRED", "That code has expired. Request a new one.");
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    throw new ApiError(429, "OTP_LOCKED", "Too many wrong attempts. Request a new code.");
  }
  const attempts = challenge.attempts + 1;
  const ok = otpHashesMatch(challenge.otpHash, hashOtp(input.otp, input.cancellationId));
  await tx.refundOtpChallenge.update({
    where: { id: challenge.id },
    data: ok ? { attempts, consumedAt: new Date() } : { attempts },
  });
  if (!ok) {
    throw new ApiError(400, "OTP_INVALID", "That code is not valid. Check and try again.");
  }
}
