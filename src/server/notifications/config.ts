import "server-only";

/**
 * Notification configuration.
 *
 * Reads the same variables documented in `docs/environment-variables.md` and blocker B3:
 * `EMAIL_PROVIDER` (`smtp` | `console`), `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
 * `SMTP_USER`, `SMTP_PASS`, `NOTIFICATION_FROM_EMAIL`,
 * `NOTIFICATION_REPLY_TO_EMAIL`, `STAFF_ALERT_EMAIL`.
 *
 * The default is `console`, deliberately: an unset provider logs instead of sending, so a
 * misconfigured deployment queues mail visibly rather than silently emailing guests from
 * a wrong address — or failing every booking write that enqueues.
 *
 * `smtp` defaults to Gmail (`smtp.gmail.com:465`), so the camp sends from its Gmail
 * address with an App Password and no paid account. Any other SMTP host works by
 * overriding `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE`.
 */

export type EmailProviderName = "smtp" | "console";

export function emailProviderName(): EmailProviderName {
  return process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "smtp" ? "smtp" : "console";
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

/**
 * Resolved SMTP connection settings, or null when credentials are missing.
 * Gmail App Passwords are shown with spaces ("xxxx xxxx xxxx xxxx"); whitespace
 * is stripped from the password so a pasted value works as-is.
 */
export function smtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const rawPort = Number.parseInt(process.env.SMTP_PORT ?? "", 10);
  const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 465;
  const rawSecure = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = rawSecure ? !["false", "0", "no"].includes(rawSecure) : port === 465;
  const user = process.env.SMTP_USER?.trim() ?? "";
  const pass = (process.env.SMTP_PASS ?? "").replace(/\s+/g, "");
  if (!user || !pass) return null;
  return { host, port, secure, user, pass };
}

export function notificationFromEmail(): string {
  return process.env.NOTIFICATION_FROM_EMAIL?.trim() || "Honeydew Beach Camp <honeydewbeachcamp@gmail.com>";
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
