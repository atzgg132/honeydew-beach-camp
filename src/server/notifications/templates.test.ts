import { describe, expect, it, vi, afterEach } from "vitest";
import { emailProviderName, staffAlertEmail } from "@/server/notifications/config";
import { computeNextAttemptAt } from "@/server/notifications/outbox";
import {
  bookingAmended,
  bookingCancelled,
  bookingConfirmation,
  isNotificationTemplate,
  paymentReceipt,
  refundProcessed,
  staffNewBooking,
  staffPaymentException,
} from "@/server/notifications/templates";

const confirmationData = {
  guestName: "Asha Guest",
  reference: "HD-AAAA-BBBB-CCCC",
  checkIn: "2026-10-01",
  checkOut: "2026-10-03",
  nights: 2,
  roomLines: ["Sea View — Non-AC, 2 guests"],
  subtotalPaise: 500000,
  advancePaidPaise: 100000,
  outstandingPaise: 400000,
  manageUrl: "https://example.test/manage-booking",
};

describe("notification templates", () => {
  it("renders a booking confirmation with reference, totals and manage link", () => {
    const rendered = bookingConfirmation(confirmationData);
    expect(rendered.subject).toContain("HD-AAAA-BBBB-CCCC");
    expect(rendered.text).toContain("Asha Guest");
    expect(rendered.text).toContain("HD-AAAA-BBBB-CCCC");
    expect(rendered.text).toContain("₹5,000");
    expect(rendered.text).toContain("₹1,000");
    expect(rendered.text).toContain("₹4,000");
    expect(rendered.text).toContain("https://example.test/manage-booking");
    expect(rendered.html).toContain("HD-AAAA-BBBB-CCCC");
  });

  it("renders a payment receipt with the amount received", () => {
    const rendered = paymentReceipt({
      guestName: "Asha Guest",
      reference: "HD-AAAA-BBBB-CCCC",
      amountPaise: 100000,
      paidAt: "2026-09-06T10:00:00.000Z",
      outstandingPaise: 400000,
    });
    expect(rendered.subject).toContain("HD-AAAA-BBBB-CCCC");
    expect(rendered.text).toContain("₹1,000");
    expect(rendered.text).toContain("₹4,000");
  });

  it("renders an amendment with the change kind and revised total", () => {
    const rendered = bookingAmended({
      guestName: "Asha Guest",
      reference: "HD-AAAA-BBBB-CCCC",
      changeKind: "Guest change",
      summaryLines: ["Guests now: 3 adults."],
      subtotalPaise: 600000,
      outstandingPaise: 500000,
      manageUrl: "https://example.test/manage-booking",
    });
    expect(rendered.subject).toContain("HD-AAAA-BBBB-CCCC");
    expect(rendered.text).toContain("Guest change");
    expect(rendered.text).toContain("Guests now: 3 adults.");
    expect(rendered.text).toContain("₹6,000");
  });

  it("renders a cancellation with the refundable amount when one is due", () => {
    const rendered = bookingCancelled({
      guestName: "Asha Guest",
      reference: "HD-AAAA-BBBB-CCCC",
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      deductionPaise: 20000,
      refundablePaise: 80000,
    });
    expect(rendered.text).toContain("₹800");
    expect(rendered.text).toContain("₹200");
  });

  it("renders a cancellation with no refund due without a refund line", () => {
    const rendered = bookingCancelled({
      guestName: "Asha Guest",
      reference: "HD-AAAA-BBBB-CCCC",
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      deductionPaise: 100000,
      refundablePaise: 0,
    });
    expect(rendered.text).toContain("No refund is due");
  });

  it("renders a processed refund with amount and provider reference", () => {
    const rendered = refundProcessed({
      guestName: "Asha Guest",
      reference: "HD-AAAA-BBBB-CCCC",
      amountPaise: 80000,
      providerReference: "rfnd_test_123",
    });
    expect(rendered.subject).toContain("HD-AAAA-BBBB-CCCC");
    expect(rendered.text).toContain("₹800");
    expect(rendered.text).toContain("rfnd_test_123");
  });

  it("renders staff alerts with desk links and no guest-facing tone", () => {
    const created = staffNewBooking({
      reference: "HD-AAAA-BBBB-CCCC",
      source: "ONLINE",
      guestName: "Asha Guest",
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      subtotalPaise: 500000,
      advancePaidPaise: 100000,
      deskUrl: "https://example.test/admin/bookings/1",
    });
    expect(created.subject).toContain("HD-AAAA-BBBB-CCCC");
    expect(created.text).toContain("https://example.test/admin/bookings/1");

    const exception = staffPaymentException({
      reference: null,
      bookingId: "booking-id",
      reason: "Payment arrived after the room hold expired.",
      amountPaise: 100000,
      deskUrl: "https://example.test/admin/bookings/1",
    });
    expect(exception.subject).toContain("booking-id");
    expect(exception.text).toContain("₹1,000");
  });

  it("escapes interpolated values in the HTML variant", () => {
    const rendered = bookingConfirmation({ ...confirmationData, guestName: "<script>alert(1)</script>" });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.text).toContain("<script>alert(1)</script>");
  });

  it("recognises the registered template keys", () => {
    expect(isNotificationTemplate("booking_confirmation")).toBe(true);
    expect(isNotificationTemplate("staff_payment_exception")).toBe(true);
    expect(isNotificationTemplate("sms_reminder")).toBe(false);
  });
});

describe("notification provider resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to the console provider and never to resend", () => {
    vi.stubEnv("EMAIL_PROVIDER", "");
    expect(emailProviderName()).toBe("console");
    vi.stubEnv("EMAIL_PROVIDER", "whatsapp");
    expect(emailProviderName()).toBe("console");
    vi.stubEnv("EMAIL_PROVIDER", "resend");
    expect(emailProviderName()).toBe("resend");
  });

  it("reads the staff alert address only when configured", () => {
    vi.stubEnv("STAFF_ALERT_EMAIL", "");
    expect(staffAlertEmail()).toBeNull();
    vi.stubEnv("STAFF_ALERT_EMAIL", "desk@example.test");
    expect(staffAlertEmail()).toBe("desk@example.test");
  });
});

describe("outbox backoff", () => {
  it("spaces retries at 1, 5, 15 and 60 minutes", () => {
    const now = new Date("2026-09-06T10:00:00.000Z");
    expect(computeNextAttemptAt(1, now).toISOString()).toBe("2026-09-06T10:01:00.000Z");
    expect(computeNextAttemptAt(2, now).toISOString()).toBe("2026-09-06T10:05:00.000Z");
    expect(computeNextAttemptAt(3, now).toISOString()).toBe("2026-09-06T10:15:00.000Z");
    expect(computeNextAttemptAt(4, now).toISOString()).toBe("2026-09-06T11:00:00.000Z");
    expect(computeNextAttemptAt(9, now).toISOString()).toBe("2026-09-06T11:00:00.000Z");
  });
});
