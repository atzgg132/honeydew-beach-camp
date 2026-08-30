import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/contracts/errors";

function secret(name: "APP_TOKEN_SECRET" | "PII_LOOKUP_PEPPER"): string {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new ApiError(503, "SERVER_NOT_CONFIGURED", "The booking service is not configured.");
  }
  return value;
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmac(value: string, purpose: string, keyName: "APP_TOKEN_SECRET" | "PII_LOOKUP_PEPPER" = "APP_TOKEN_SECRET"): string {
  return createHmac("sha256", secret(keyName)).update(`${purpose}\0${value}`).digest("hex");
}

export function safeEqualHex(left: string, right: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(left) || !/^[0-9a-f]{64}$/i.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function deriveToken(purpose: string, ...parts: string[]): string {
  const signature = hmac(parts.join("\0"), purpose);
  return Buffer.from(signature, "hex").toString("base64url");
}

export function signPayload(value: unknown, purpose: string): string {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = Buffer.from(hmac(body, purpose), "hex").toString("base64url");
  return `${body}.${signature}`;
}

export function verifyPayload(token: string, purpose: string): unknown {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) throw new ApiError(400, "INVALID_QUOTE", "The quote is invalid.");
  const expected = hmac(body, purpose);
  const actual = Buffer.from(signature, "base64url").toString("hex");
  if (!safeEqualHex(expected, actual)) throw new ApiError(400, "INVALID_QUOTE", "The quote is invalid.");
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new ApiError(400, "INVALID_QUOTE", "The quote is invalid.");
  }
}

export function phoneLookupHash(e164: string): string {
  return hmac(e164, "phone-lookup", "PII_LOOKUP_PEPPER");
}

export function keyedIdentifier(value: string, purpose: string): string {
  return hmac(value, purpose, "PII_LOOKUP_PEPPER");
}
