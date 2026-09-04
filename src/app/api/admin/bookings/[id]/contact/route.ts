import { NextRequest } from "next/server";
import { bookingContactContract } from "@/contracts/booking";
import { requireAdminMutation } from "@/server/auth/admin-api";
import { parseJson, requireIdempotencyKey, requireUuidParam, route } from "@/server/http";
import { getStaffBooking } from "@/server/services/admin-booking-query";
import { updateManagedContact } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const bookingId = requireUuidParam((await context.params).id, "id");
    const contact = await parseJson(request, bookingContactContract);
    await updateManagedContact(bookingId, contact, requireIdempotencyKey(request), { kind: "admin", id: actor.id });
    return getStaffBooking(bookingId);
  });
}
