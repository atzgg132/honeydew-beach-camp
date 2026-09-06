import "server-only";

/**
 * Notification configuration.
 *
 * Reads the same variables documented in `docs/environment-variables.md` and blocker B3:
 * `EMAIL_PROVIDER` (`resend` | `console`), `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`,
 * `NOTIFICATION_REPLY_TO_EMAIL`, `STAFF_ALERT_EMAIL`.
 *
 * The default is `console`, deliberately: an unset provider logs instead of sending, so a
 * misconfigured deployment queues mail visibly rather than silently emailing guests from
 * an unverified address — or failing every booking write that enqueues.
 */

export type EmailProviderName = "resend" | "console";

export function emailProviderName(): EmailProviderName {
  return process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "resend" ? "resend" : "console";
}

export function resendApiKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key ? key : null;
}

export function notificationFromEmail(): string {
  return process.env.NOTIFICATION_FROM_EMAIL?.trim() || "Honeydew Beach Camp <no-reply@honeydewbeachcamp.com>";
}

export function notificationReplyToEmail(): string | null {
  const replyTo = process.env.NOTIFICATION_REPLY_TO_EMAIL?.trim();
  return replyTo ? replyTo : null;
}

export function staffAlertEmail(): string | null {
  const address = process.env.STAFF_ALERT_EMAIL?.trim();
  return address ? address : null;
}

export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  return raw ? raw : "https://honeydewbeachcamp.com";
}
