import "server-only";

/**
 * Structured logging.
 *
 * Logs from this application end up in Vercel's log drain, which is readable by anyone with
 * project access and retained beyond the life of a request. Guest names, phone numbers,
 * email addresses, booking references and payment identifiers must never be written to it.
 *
 * Every value passed here is therefore redacted by key before serialisation, rather than
 * relying on each call site to remember. Call sites that genuinely need to correlate a
 * record use its opaque id or a hash, never its contents.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Keys whose values never reach the log, matched case-insensitively as substrings. */
const REDACTED_KEYS = [
  "email",
  "phone",
  "fullname",
  "name",
  "contact",
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "signature",
  "apikey",
  "key",
  "pan",
  "card",
  "upi",
  "vpa",
  "address",
];

/** Keys that are safe and useful even though they match a redacted substring. */
const ALLOWED_KEYS = ["roomGroupName", "eventName", "jobName", "providerName", "keyHash"];

const REDACTION = "[redacted]";
const MAX_DEPTH = 6;
const MAX_STRING = 512;

function shouldRedact(key: string): boolean {
  const lower = key.toLowerCase();
  if (ALLOWED_KEYS.some((allowed) => allowed.toLowerCase() === lower)) return false;
  return REDACTED_KEYS.some((needle) => lower.includes(needle));
}

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth >= MAX_DEPTH) return "[truncated]";

  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => sanitize(entry, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = shouldRedact(key) ? REDACTION : sanitize(entry, depth + 1);
    }
    return output;
  }
  return "[unserializable]";
}

export interface LogFields {
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
  const record = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(sanitize(fields) as Record<string, unknown>),
  };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => {
    if (process.env.NODE_ENV === "production") return;
    emit("debug", message, fields);
  },
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};

/** Exported for tests: the redaction rules are a security control and are asserted directly. */
export const __testing = { sanitize, shouldRedact };
