import { describe, expect, it } from "vitest";
import { normalizeRefundReference } from "@/domain/booking/refund-reference";

describe("normalizeRefundReference", () => {
  it("accepts a 12-digit RRN", () => {
    expect(normalizeRefundReference("123456789012")).toBe("123456789012");
  });

  it("accepts a gateway refund id with dashes and underscores", () => {
    expect(normalizeRefundReference("rfnd_QwErTy-123456")).toBe("rfnd_QwErTy-123456");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeRefundReference("  123456789012  ")).toBe("123456789012");
  });

  it("treats a missing or blank reference as no reference", () => {
    expect(normalizeRefundReference(undefined)).toBeNull();
    expect(normalizeRefundReference(null)).toBeNull();
    expect(normalizeRefundReference("")).toBeNull();
    expect(normalizeRefundReference("   ")).toBeNull();
  });

  it("rejects a reference shorter than 6 characters", () => {
    expect(() => normalizeRefundReference("UPI-1")).toThrowError(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
  });

  it("rejects a reference longer than 64 characters", () => {
    expect(() => normalizeRefundReference("1".repeat(65))).toThrowError(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
  });

  it("rejects spaces and symbols inside the reference", () => {
    for (const value of ["RRN 123456", "ref#1abcde", "utr.123456", "abc/def123"]) {
      expect(() => normalizeRefundReference(value)).toThrowError(
        expect.objectContaining({ code: "VALIDATION_ERROR" }),
      );
    }
  });

  it("rejects non-string input", () => {
    expect(() => normalizeRefundReference(12345678)).toThrowError(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
  });
});
