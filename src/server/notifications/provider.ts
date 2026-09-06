import "server-only";
import { randomUUID } from "node:crypto";
import {
  notificationFromEmail,
  notificationReplyToEmail,
  resendApiKey,
} from "@/server/notifications/config";
import { logger } from "@/server/observability/logger";

/**
 * Email delivery adapters.
 *
 * `resend` posts to the Resend REST API with the global fetch — no SDK, so there is no
 * new dependency to audit. `console` records the message in the structured log instead
 * of sending; it is the default in development and test, and what proves every template
 * and retry path without moving real mail.
 *
 * Guest PII never reaches the log: addresses and names are redacted by key (see the
 * logger), and only the opaque outbox id, template and provider message id are logged.
 */

export interface OutgoingEmail {
  outboxId: string;
  template: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  readonly name: string;
  send(email: OutgoingEmail): Promise<{ providerMessageId: string }>;
}

class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async send(email: OutgoingEmail): Promise<{ providerMessageId: string }> {
    const providerMessageId = `console-${randomUUID()}`;
    logger.info("notification.console", {
      jobName: "notification-deliver",
      outboxId: email.outboxId,
      template: email.template,
      providerMessageId,
      subjectLength: email.subject.length,
    });
    return { providerMessageId };
  }
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  async send(email: OutgoingEmail): Promise<{ providerMessageId: string }> {
    const apiKey = resendApiKey();
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured.");
    }
    const replyTo = notificationReplyToEmail();
    let response: Response;
    try {
      response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: notificationFromEmail(),
          to: [email.to],
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject: email.subject,
          text: email.text,
          html: email.html,
          headers: { "X-Outbox-Id": email.outboxId },
        }),
      });
    } catch (error) {
      throw new Error(`Resend request failed: ${error instanceof Error ? error.message : "network error"}`);
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`Resend rejected the message (HTTP ${response.status}): ${detail}`);
    }
    const body = (await response.json().catch(() => ({}))) as { id?: unknown };
    if (typeof body.id !== "string" || !body.id) {
      throw new Error("Resend returned no message id.");
    }
    return { providerMessageId: body.id };
  }
}

let override: EmailProvider | null = null;

/** Test-only. Replaces the resolved adapter within one suite. */
export function setEmailProviderForTests(provider: EmailProvider | null): void {
  override = provider;
}

export function getEmailProvider(): EmailProvider {
  if (override) return override;
  if (process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend") return new ResendEmailProvider();
  return new ConsoleEmailProvider();
}

/** Fails the delivery run loudly when `resend` is selected but cannot send. */
export function assertEmailProviderConfigured(): void {
  if (process.env.EMAIL_PROVIDER?.trim().toLowerCase() !== "resend") return;
  if (!resendApiKey()) {
    throw new Error("EMAIL_PROVIDER is resend but RESEND_API_KEY is not configured.");
  }
  if (!process.env.NOTIFICATION_FROM_EMAIL?.trim()) {
    throw new Error("EMAIL_PROVIDER is resend but NOTIFICATION_FROM_EMAIL is not configured.");
  }
}
