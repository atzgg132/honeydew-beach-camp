import "server-only";
import { Prisma, type NotificationStatus } from "@prisma/client";
import { ApiError } from "@/contracts/errors";
import { db } from "@/server/db/client";
import { reportError } from "@/server/observability/errors";
import { logger } from "@/server/observability/logger";
import {
  assertEmailProviderConfigured,
  getEmailProvider,
  type EmailProvider,
} from "@/server/notifications/provider";
import { isNotificationTemplate, type NotificationTemplate } from "@/server/notifications/templates";

/**
 * Notification outbox: durable queue between booking writes and the email provider.
 *
 * Booking, payment and mutation paths only ever *enqueue* — a row in the same database
 * transaction as the state change, so a confirmed booking cannot exist without its
 * confirmation mail queued, and a rolled-back write leaves no orphan mail. Nothing on
 * the request path calls the email provider: delivery happens in
 * `processDueNotifications`, driven by the authenticated internal endpoint
 * (`/api/internal/notifications/deliver`, same `CRON_SECRET` pattern as hold expiry).
 *
 * Reliability contract:
 * - `dedupeKey` makes enqueue idempotent. Webhook redeliveries and idempotency-key
 *   replays upsert the same key instead of queueing a second mail.
 * - A claim (`QUEUED` → `SENDING`) means at most one worker delivers a row; a crashed
 *   worker leaves `SENDING` rows, which `requeueStuckDeliveries` returns to `QUEUED`.
 * - Failed attempts back off (1m, 5m, 15m, 1h) and dead-letter after `maxAttempts`
 *   (default 5), reporting `notification.dead_letter` for staff follow-up.
 * - Every attempt is recorded in `NotificationAttempt`, which is the delivery history
 *   the staff desk reads.
 */

export const OUTBOX_MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = [1, 5, 15, 60];
const STUCK_SEND_MINUTES = 15;

/** Pure: when the next attempt may run after `attempts` failures. Exported for tests. */
export function computeNextAttemptAt(attempts: number, now: Date): Date {
  const minutes = BACKOFF_MINUTES[Math.min(Math.max(attempts, 1), BACKOFF_MINUTES.length) - 1] ?? 60;
  return new Date(now.getTime() + minutes * 60_000);
}

type OutboxDb = Prisma.TransactionClient;

function store(client?: OutboxDb): OutboxDb {
  return client ?? (db() as unknown as OutboxDb);
}

export interface EnqueueInput {
  template: NotificationTemplate;
  to: string;
  subject: string;
  text: string;
  html: string;
  payload?: Prisma.InputJsonValue;
  bookingId?: string;
  dedupeKey?: string;
  maxAttempts?: number;
}

export async function enqueueNotification(input: EnqueueInput, client?: OutboxDb) {
  const prisma = store(client);
  const to = input.to.trim();
  if (!to) throw new ApiError(400, "VALIDATION_ERROR", "A notification recipient is required.");
  if (!isNotificationTemplate(input.template)) {
    throw new ApiError(400, "VALIDATION_ERROR", "The notification template is unknown.");
  }
  const data = {
    channel: "email",
    template: input.template,
    toAddress: to,
    subject: input.subject,
    bodyText: input.text,
    bodyHtml: input.html,
    payload: input.payload ?? Prisma.JsonNull,
    bookingId: input.bookingId ?? null,
    status: "QUEUED" as NotificationStatus,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? OUTBOX_MAX_ATTEMPTS,
    nextAttemptAt: new Date(),
    lastError: null,
    providerMessageId: null,
    sentAt: null,
  };
  if (input.dedupeKey) {
    const row = await prisma.notificationOutbox.upsert({
      where: { dedupeKey: input.dedupeKey },
      create: { ...data, dedupeKey: input.dedupeKey },
      update: {},
      select: { id: true },
    });
    return { id: row.id };
  }
  const row = await prisma.notificationOutbox.create({ data, select: { id: true } });
  return { id: row.id };
}

export interface DeliveryResult {
  checked: number;
  sent: number;
  failed: number;
  deadLettered: number;
}

export async function processDueNotifications(options?: {
  limit?: number;
  provider?: EmailProvider;
  now?: Date;
}): Promise<DeliveryResult> {
  assertEmailProviderConfigured();
  const provider = options?.provider ?? getEmailProvider();
  const now = options?.now ?? new Date();
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);
  const prisma = db() as unknown as OutboxDb;

  const due = await prisma.notificationOutbox.findMany({
    where: { status: "QUEUED", nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  });

  const result: DeliveryResult = { checked: due.length, sent: 0, failed: 0, deadLettered: 0 };
  for (const message of due) {
    // Claim first: a concurrent worker that claimed the row makes this update a no-op.
    const claimed = await prisma.notificationOutbox.updateMany({
      where: { id: message.id, status: "QUEUED" },
      data: { status: "SENDING" },
    });
    if (claimed.count === 0) continue;
    const attemptNo = message.attempts + 1;
    try {
      const sent = await provider.send({
        outboxId: message.id,
        template: message.template,
        to: message.toAddress,
        subject: message.subject,
        text: message.bodyText,
        html: message.bodyHtml ?? message.bodyText,
      });
      await prisma.$transaction([
        prisma.notificationAttempt.create({
          data: { outboxId: message.id, attemptNo, ok: true, providerMessageId: sent.providerMessageId },
        }),
        prisma.notificationOutbox.update({
          where: { id: message.id },
          data: { status: "SENT", sentAt: new Date(), providerMessageId: sent.providerMessageId, lastError: null },
        }),
      ]);
      result.sent += 1;
    } catch (error) {
      const detail = (error instanceof Error ? error.message : "Unknown delivery error").slice(0, 500);
      const attempts = attemptNo;
      const exhausted = attempts >= message.maxAttempts;
      await prisma.$transaction([
        prisma.notificationAttempt.create({
          data: { outboxId: message.id, attemptNo, ok: false, error: detail },
        }),
        prisma.notificationOutbox.update({
          where: { id: message.id },
          data: exhausted
            ? { status: "DEAD_LETTER", attempts, lastError: detail }
            : { status: "QUEUED", attempts, lastError: detail, nextAttemptAt: computeNextAttemptAt(attempts, new Date()) },
        }),
      ]);
      if (exhausted) {
        result.deadLettered += 1;
        reportError({
          kind: "notification.dead_letter",
          message: "A notification exhausted its retries and needs staff follow-up.",
          context: { outboxId: message.id, template: message.template, providerName: provider.name },
        });
      } else {
        result.failed += 1;
      }
      logger.warn("notification.delivery_failed", {
        jobName: "notification-deliver",
        outboxId: message.id,
        template: message.template,
        attemptNo,
        providerName: provider.name,
      });
    }
  }
  return result;
}

/**
 * Returns `SENDING` rows stuck past their lease to `QUEUED`. A worker that crashes
 * between claim and send must not wedge those messages forever.
 */
export async function requeueStuckDeliveries(now: Date = new Date()): Promise<{ requeued: number }> {
  const prisma = db() as unknown as OutboxDb;
  const stuckBefore = new Date(now.getTime() - STUCK_SEND_MINUTES * 60_000);
  const requeued = await prisma.notificationOutbox.updateMany({
    where: { status: "SENDING", updatedAt: { lt: stuckBefore } },
    data: { status: "QUEUED" },
  });
  return { requeued: requeued.count };
}

const LIST_STATUSES: NotificationStatus[] = ["QUEUED", "SENDING", "SENT", "DEAD_LETTER"];

export function parseOutboxStatus(value: string | null): NotificationStatus | null {
  if (!value) return null;
  if ((LIST_STATUSES as string[]).includes(value)) return value as NotificationStatus;
  throw new ApiError(400, "VALIDATION_ERROR", "The notification status filter is invalid.");
}

export async function listNotifications(input: {
  bookingId?: string;
  status?: NotificationStatus | null;
  limit?: number;
}) {
  const prisma = db() as unknown as OutboxDb;
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const rows = await prisma.notificationOutbox.findMany({
    where: {
      ...(input.bookingId ? { bookingId: input.bookingId } : {}),
      ...(input.status ? { status: input.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { deliveryAttempts: { orderBy: { attemptNo: "asc" } } },
  });
  return rows.map((row) => ({
    id: row.id,
    template: row.template,
    toAddress: row.toAddress,
    subject: row.subject,
    bookingId: row.bookingId,
    dedupeKey: row.dedupeKey,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    nextAttemptAt: row.nextAttemptAt.toISOString(),
    lastError: row.lastError,
    providerMessageId: row.providerMessageId,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
    deliveryAttempts: row.deliveryAttempts.map((attempt) => ({
      attemptNo: attempt.attemptNo,
      ok: attempt.ok,
      error: attempt.error,
      providerMessageId: attempt.providerMessageId,
      createdAt: attempt.createdAt.toISOString(),
    })),
  }));
}

export type StaffNotification = Awaited<ReturnType<typeof listNotifications>>[number];

/** Staff action: give a dead-lettered (or queued) message a fresh delivery cycle. */
export async function retryNotification(id: string) {
  const prisma = db() as unknown as OutboxDb;
  const existing = await prisma.notificationOutbox.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "The notification was not found.");
  if (existing.status === "SENT") throw new ApiError(409, "INVALID_STATE", "This notification was already delivered.");
  if (existing.status === "SENDING") {
    throw new ApiError(409, "INVALID_STATE", "This notification is being delivered right now.");
  }
  const updated = await prisma.notificationOutbox.update({
    where: { id },
    data: { status: "QUEUED", attempts: 0, nextAttemptAt: new Date(), lastError: null },
  });
  return { id: updated.id, status: updated.status };
}
