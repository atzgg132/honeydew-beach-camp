import { describe, expect, it } from "vitest";
import { contactEnquiryContract } from "@/contracts/contact";

const base = {
  name: "Asha Guest",
  phone: "98765 43210",
  email: "asha@example.com",
  message: "We are two adults arriving Friday. Is an early check-in possible?",
};

describe("contact enquiry contract", () => {
  it("accepts a complete enquiry", () => {
    expect(contactEnquiryContract.safeParse(base).success).toBe(true);
  });

  it("accepts phone-only contact", () => {
    expect(contactEnquiryContract.safeParse({ ...base, email: "" }).success).toBe(true);
  });

  it("accepts email-only contact", () => {
    expect(contactEnquiryContract.safeParse({ ...base, phone: "" }).success).toBe(true);
  });

  it("rejects an enquiry with no way to reply", () => {
    const result = contactEnquiryContract.safeParse({ ...base, phone: "", email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a phone and an email that are both invalid", () => {
    const result = contactEnquiryContract.safeParse({ ...base, phone: "123", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a nameless or near-empty message", () => {
    expect(contactEnquiryContract.safeParse({ ...base, name: " " }).success).toBe(false);
    expect(contactEnquiryContract.safeParse({ ...base, message: "Hi there" }).success).toBe(false);
  });
});
