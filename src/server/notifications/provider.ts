import "server-only";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import {
  notificationFromEmail,
  notificationReplyToEmail,
  smtpConfig,
} from "@/server/notifications/config";
import { logger } from "@/server/observability/logger";

/**
 * Email delivery adapters.
 *
 * `smtp` sends through any SMTP host (Gmail by default: `smtp.gmail.com:465` with an
 * App Password) via nodemailer. `console` records the message in the structured log
 * instead of sending; it is the default in development and test, and what proves every
 * template and retry path without moving real mail.
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

class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";

  async send(email: OutgoingEmail): Promise<{ providerMessageId: string }> {
    const config = smtpConfig();
    if (!config) {
      throw new Error("SMTP_USER / SMTP_PASS are not configured.");
    }
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
    });
    const replyTo = notificationReplyToEmail();
    let info: { messageId?: unknown };
    try {
      info = await transporter.sendMail({
        from: notificationFromEmail(),
        to: email.to,
        ...(replyTo ? { replyTo } : {}),
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: { "X-Outbox-Id": email.outboxId },
      });
    } catch (error) {
      throw new Error(`SMTP send failed: ${error instanceof Error ? error.message : "network error"}`);
    }
    if (typeof info.messageId !== "string" || !info.messageId) {
      throw new Error("SMTP accepted the message but returned no message id.");
    }
    return { providerMessageId: info.messageId };
  }
}

let override: EmailProvider | null = null;

/** Test-only. Replaces the resolved adapter within one suite. */
export function setEmailProviderForTests(provider: EmailProvider | null): void {
  override = provider;
}

export function getEmailProvider(): EmailProvider {
  if (override) return override;
  if (process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "smtp") return new SmtpEmailProvider();
  return new ConsoleEmailProvider();
}

/** Fails the delivery run loudly when `smtp` is selected but cannot send. */
export function assertEmailProviderConfigured(): void {
  if (process.env.EMAIL_PROVIDER?.trim().toLowerCase() !== "smtp") return;
  if (!smtpConfig()) {
    throw new Error("EMAIL_PROVIDER is smtp but SMTP_USER / SMTP_PASS are not configured.");
  }
}
