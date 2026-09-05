import { afterEach, describe, expect, it } from "vitest";
import { checkoutProviderName } from "@/server/payments/runtime";
import { razorpayCheckoutSignature, signaturesMatch, verifyRazorpayCheckoutSignature } from "@/server/payments/razorpay-provider";

const KEYS = [
  "PAYMENT_PROVIDER",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "PAYMENT_PROVIDER_KEY_ID",
  "PAYMENT_PROVIDER_KEY_SECRET",
  "NEXT_PUBLIC_RAZORPAY_KEY_ID",
  "ENABLE_DEV_PAYMENT",
] as const;

const original: Record<string, string | undefined> = {};

function snapshotEnv() {
  for (const key of KEYS) original[key] = process.env[key];
}

function restoreEnv() {
  for (const key of KEYS) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearPaymentEnv() {
  for (const key of KEYS) delete process.env[key];
}

snapshotEnv();

describe("checkout provider resolution", () => {
  afterEach(restoreEnv);

  it("selects razorpay when PAYMENT_PROVIDER=razorpay and keys are set", () => {
    clearPaymentEnv();
    process.env.PAYMENT_PROVIDER = "razorpay";
    process.env.RAZORPAY_KEY_ID = "rzp_test_example";
    process.env.RAZORPAY_KEY_SECRET = "secret-value";
    process.env.ENABLE_DEV_PAYMENT = "true";
    expect(checkoutProviderName()).toBe("razorpay");
  });

  it("selects the simulator when PAYMENT_PROVIDER=dev", () => {
    clearPaymentEnv();
    process.env.PAYMENT_PROVIDER = "dev";
    process.env.ENABLE_DEV_PAYMENT = "true";
    process.env.RAZORPAY_KEY_ID = "rzp_test_example";
    process.env.RAZORPAY_KEY_SECRET = "secret-value";
    expect(checkoutProviderName()).toBe("dev");
  });

  it("ignores leftover cashfree as a provider name", () => {
    clearPaymentEnv();
    process.env.PAYMENT_PROVIDER = "cashfree";
    process.env.ENABLE_DEV_PAYMENT = "true";
    expect(checkoutProviderName()).toBeNull();
  });
});

describe("razorpay checkout signatures", () => {
  afterEach(restoreEnv);

  it("accepts HMAC-SHA256(order_id|payment_id, secret)", () => {
    clearPaymentEnv();
    process.env.RAZORPAY_KEY_SECRET = "test-secret";
    const signature = razorpayCheckoutSignature("order_1", "pay_1", "test-secret");
    expect(verifyRazorpayCheckoutSignature({
      orderId: "order_1",
      paymentId: "pay_1",
      signature,
    })).toBe(true);
  });

  it("rejects a mismatch and does not treat it as paid", () => {
    clearPaymentEnv();
    process.env.RAZORPAY_KEY_SECRET = "test-secret";
    expect(verifyRazorpayCheckoutSignature({
      orderId: "order_1",
      paymentId: "pay_1",
      signature: "00".repeat(32),
    })).toBe(false);
    expect(signaturesMatch("aa", "bb")).toBe(false);
  });
});
