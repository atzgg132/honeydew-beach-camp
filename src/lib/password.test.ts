import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  it("accepts the original password and rejects another", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
    expect(await verifyPassword("wrong-password-value", hash)).toBe(false);
  });

  it("rejects a malformed stored hash", async () => {
    expect(await verifyPassword("correct-horse-battery", "not-a-hash")).toBe(false);
    expect(await verifyPassword("correct-horse-battery", "scrypt$1$2$3$$")).toBe(false);
  });
});
