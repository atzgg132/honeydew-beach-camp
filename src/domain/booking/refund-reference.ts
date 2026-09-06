import { ApiError } from "@/contracts/errors";

// A processed refund carries the provider's money-movement reference (UPI UTR /
// bank RRN / gateway refund id). References arrive from staff keystrokes, so they
// are validated in one place and shared by the zod contract and the service.
export const REFUND_REFERENCE_MIN_LENGTH = 6;
export const REFUND_REFERENCE_MAX_LENGTH = 64;
export const REFUND_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export const REFUND_REFERENCE_MESSAGE =
  "Enter the refund reference (UTR/RRN), 6 to 64 letters, digits, dashes or underscores.";

export function normalizeRefundReference(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", REFUND_REFERENCE_MESSAGE);
  }
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (
    trimmed.length < REFUND_REFERENCE_MIN_LENGTH ||
    trimmed.length > REFUND_REFERENCE_MAX_LENGTH ||
    !REFUND_REFERENCE_PATTERN.test(trimmed)
  ) {
    throw new ApiError(400, "VALIDATION_ERROR", REFUND_REFERENCE_MESSAGE);
  }
  return trimmed;
}
