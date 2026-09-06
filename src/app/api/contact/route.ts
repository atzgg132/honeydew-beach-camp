import { NextRequest } from "next/server";
import { contactEnquiryContract } from "@/contracts/contact";
import { parseJson, route } from "@/server/http";
import { consumeRateLimit } from "@/server/rate-limit";
import { submitContactEnquiry } from "@/server/services/contact-service";

export const runtime = "nodejs";

/**
 * Public contact endpoint. Validated with the same schema as the form, then
 * rate-limited (5 submissions per address per 15 minutes), then persisted as a
 * staff-visible notification-outbox row. No session: guests writing in may not
 * have a booking at all.
 */
export async function POST(request: NextRequest) {
  return route(async () => {
    const input = await parseJson(request, contactEnquiryContract);
    const discriminator = input.email.trim() || input.phone.trim();
    await consumeRateLimit({
      request,
      scope: "contact",
      discriminator,
      windowSeconds: 15 * 60,
      limit: 5,
    });
    await submitContactEnquiry(input);
    return { received: true };
  });
}
