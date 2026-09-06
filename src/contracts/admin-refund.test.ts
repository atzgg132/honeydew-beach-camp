import { describe, expect, it } from "vitest";
import { adminRefundActionContract, refundExecuteContract, refundOtpRequestContract } from "@/contracts/admin";

describe("adminRefundActionContract", () => {
  it("accepts a process action with a valid RRN", () => {
    const result = adminRefundActionContract.safeParse({
      action: "process",
      actualRefundPaise: 1500,
      reference: "123456789012",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a process action without a reference", () => {
    const result = adminRefundActionContract.safeParse({ action: "process", actualRefundPaise: 1500 });
    expect(result.success).toBe(true);
  });

  it("rejects a process action with a short reference", () => {
    const result = adminRefundActionContract.safeParse({
      action: "process",
      actualRefundPaise: 1500,
      reference: "UPI-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a process action with an overlong reference", () => {
    const result = adminRefundActionContract.safeParse({
      action: "process",
      actualRefundPaise: 1500,
      reference: "1".repeat(65),
    });
    expect(result.success).toBe(false);
  });

});

describe("refundOtpRequestContract", () => {
  it("accepts an empty body", () => {
    expect(refundOtpRequestContract.safeParse({}).success).toBe(true);
  });
});

describe("refundExecuteContract", () => {
  const challengeId = "11111111-1111-4111-8111-111111111111";

  it("accepts a well-formed execute request", () => {
    expect(
      refundExecuteContract.safeParse({ challengeId, otp: "482916", actualRefundPaise: 1500 }).success,
    ).toBe(true);
  });

  it("rejects a non-UUID challenge", () => {
    expect(
      refundExecuteContract.safeParse({ challengeId: "not-a-uuid", otp: "482916", actualRefundPaise: 1500 }).success,
    ).toBe(false);
  });

  it("rejects a malformed OTP", () => {
    for (const otp of ["48291", "4829167", "abcdef", " 82916"]) {
      expect(refundExecuteContract.safeParse({ challengeId, otp, actualRefundPaise: 1500 }).success).toBe(false);
    }
  });

  it("rejects a zero refund amount", () => {
    expect(refundExecuteContract.safeParse({ challengeId, otp: "482916", actualRefundPaise: 0 }).success).toBe(false);
  });
});

describe("manual process contract (out-of-band refunds)", () => {
  it("rejects a process action with symbols in the reference", () => {
    const result = adminRefundActionContract.safeParse({
      action: "process",
      actualRefundPaise: 1500,
      reference: "RRN 123456",
    });
    expect(result.success).toBe(false);
  });
});
