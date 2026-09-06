import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateOtp,
  hashOtp,
  otpHashesMatch,
  refundOtpEmail,
  renderRefundOtpMail,
} from "@/server/refunds/refund-otp";

describe("refund OTP helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("generates zero-padded 6-digit codes", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
    const codes = new Set(Array.from({ length: 20 }, () => generateOtp()));
    expect(codes.size).toBeGreaterThan(1);
  });

  it("verifies a matching code and rejects anything else", () => {
    const cancellationId = "11111111-1111-4111-8111-111111111111";
    const hash = hashOtp("482916", cancellationId);
    expect(otpHashesMatch(hash, hashOtp("482916", cancellationId))).toBe(true);
    expect(otpHashesMatch(hash, hashOtp("482917", cancellationId))).toBe(false);
  });

  it("binds a code to its cancellation", () => {
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";
    expect(otpHashesMatch(hashOtp("482916", a), hashOtp("482916", b))).toBe(false);
  });

  it("renders the approval mail with the code, reference and cap", () => {
    const mail = renderRefundOtpMail({ otp: "482916", reference: "HD-REF", refundablePaise: 187500 });
    expect(mail.text).toContain("482916");
    expect(mail.text).toContain("HD-REF");
    expect(mail.text).toContain("1875.00");
    expect(mail.html).toContain("482916");
  });

  it("defaults the OTP inbox and honours the override", () => {
    vi.stubEnv("REFUND_OTP_EMAIL", "");
    expect(refundOtpEmail()).toBe("kuheli.mazumdar@gmail.com");
    vi.stubEnv("REFUND_OTP_EMAIL", "desk@example.test");
    expect(refundOtpEmail()).toBe("desk@example.test");
  });
});
