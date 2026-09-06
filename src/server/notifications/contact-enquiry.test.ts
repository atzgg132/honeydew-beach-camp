import { describe, expect, it } from "vitest";
import {
  isNotificationTemplate,
  staffContactEnquiry,
} from "@/server/notifications/templates";

describe("contact enquiry notification", () => {
  it("is a registered staff template", () => {
    expect(isNotificationTemplate("staff_contact_enquiry")).toBe(true);
  });

  it("renders the guest details and message for the desk", () => {
    const rendered = staffContactEnquiry({
      guestName: "Asha Guest",
      phone: "9876543210",
      email: "asha@example.com",
      message: "Is an early check-in possible?",
    });
    expect(rendered.subject).toContain("Asha Guest");
    expect(rendered.text).toContain("9876543210");
    expect(rendered.text).toContain("asha@example.com");
    expect(rendered.text).toContain("Is an early check-in possible?");
  });

  it("still names the reply channel when only one is left", () => {
    const rendered = staffContactEnquiry({
      guestName: "Asha Guest",
      phone: "",
      email: "asha@example.com",
      message: "Hello, we are two adults arriving Friday.",
    });
    expect(rendered.text).toContain("asha@example.com");
  });

  it("escapes the message in the HTML variant", () => {
    const rendered = staffContactEnquiry({
      guestName: "<b>Asha</b>",
      phone: "",
      email: "asha@example.com",
      message: "<script>alert(1)</script>",
    });
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.text).toContain("<script>alert(1)</script>");
  });
});
