import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/contracts/errors";

/**
 * Booking references are shown to guests, read over the phone, and written on paper. The
 * alphabet is Crockford base32 without I, L, O or U, so it cannot be misread as digits and
 * cannot accidentally spell anything. 32 characters divides 256 exactly, so taking a byte
 * modulo the alphabet length is unbiased.
 */
export function generateReference(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = randomBytes(12);
  const characters = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `HD-${characters.slice(0, 4)}-${characters.slice(4, 8)}-${characters.slice(8, 12)}`;
}

export async function allocateReference(transaction: Prisma.TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const reference = generateReference();
    const clash = await transaction.booking.findUnique({ where: { reference }, select: { id: true } });
    if (!clash) return reference;
  }
  throw new ApiError(500, "REFERENCE_ALLOCATION_FAILED", "Could not allocate a booking reference.");
}
