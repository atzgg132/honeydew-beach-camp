import { describe, expect, it } from "vitest";
import { adminRefundActionContract } from "@/contracts/admin";

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

  it("rejects a process action with symbols in the reference", () => {
    const result = adminRefundActionContract.safeParse({
      action: "process",
      actualRefundPaise: 1500,
      reference: "RRN 123456",
    });
    expect(result.success).toBe(false);
  });
});
