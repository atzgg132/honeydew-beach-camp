import "server-only";
import type { ContactEnquiryInput } from "@/contracts/contact";
import { hotel } from "@/data/hotel";
import { staffAlertEmail } from "@/server/notifications/config";
import { enqueueNotification } from "@/server/notifications/outbox";
import { staffContactEnquiry } from "@/server/notifications/templates";

/**
 * Website contact enquiries. There is no booking to attach the message to, so the
 * enquiry itself is the persisted record: one `NotificationOutbox` row addressed to
 * the camp. That reuses the existing durability and staff-visibility story — the
 * desk `/admin/notifications` page lists it alongside booking mail, with the same
 * retry and dead-letter handling — instead of inventing a second queue.
 *
 * Unlike booking staff alerts (skipped when `STAFF_ALERT_EMAIL` is unset), an
 * enquiry must never vanish: with no staff address configured it falls back to the
 * camp's public inbox, which is always staff-visible.
 */
export async function submitContactEnquiry(input: ContactEnquiryInput): Promise<{ id: string }> {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  const message = input.message.trim();
  const rendered = staffContactEnquiry({ guestName: name, phone, email, message });
  const to = staffAlertEmail() ?? hotel.email;
  const replyLine = [phone, email].filter((part) => part.length > 0).join(" · ");
  return enqueueNotification({
    template: "staff_contact_enquiry",
    to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    payload: {
      kind: "contact-enquiry",
      name,
      phone,
      email,
      replyLine,
      message,
    },
  });
}
