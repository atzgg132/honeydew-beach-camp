import { describe, expect, it } from "vitest";
import { buildRefundRequest, mapRefundStatus, normalizeRazorpayError } from "@/server/payments/razorpay-refunds";

describe("razorpay refund helpers", () => {
  it("builds a normal-speed refund tied to our cancellation receipt", () => {
    expect(
      buildRefundRequest({
        amountPaise: 187500,
        receipt: "cancellation-id",
        bookingId: "booking-id",
        cancellationId: "cancellation-id",
      }),
    ).toEqual({
      amount: 187500,
      speed: "normal",
      receipt: "cancellation-id",
      notes: { bookingId: "booking-id", cancellationId: "cancellation-id" },
    });
  });

  it("maps provider refund states to cancellation states", () => {
    expect(mapRefundStatus("processed")).toBe("PROCESSED");
    expect(mapRefundStatus("failed")).toBe("FAILED");
    expect(mapRefundStatus("pending")).toBe("PROCESSING");
    expect(mapRefundStatus("created")).toBe("PROCESSING");
  });

  it("maps auth failures to a configuration error", () => {
    const error = normalizeRazorpayError({ statusCode: 401, error: { code: "BAD_REQUEST_ERROR" } });
    expect(error.status).toBe(503);
  });

  it("surfaces provider validation messages for bad requests", () => {
    const error = normalizeRazorpayError({
      statusCode: 400,
      error: { description: "This payment has already been fully refunded" },
    });
    expect(error.status).toBe(400);
    expect(error.message).toContain("already been fully refunded");
  });

  it("maps unknown provider failures to a retryable error", () => {
    const error = normalizeRazorpayError(new Error("socket hang up"));
    expect(error.status).toBe(502);
  });
});
