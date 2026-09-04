import { NextRequest } from "next/server";
import { requireAdminMutation } from "@/server/auth/admin-api";
import { requireIdempotencyKey, requireUuidParam, route } from "@/server/http";
import { getStaffBooking } from "@/server/services/admin-booking-query";
import { cancelManagedBooking } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const bookingId = requireUuidParam((await context.params).id, "id");
    await cancelManagedBooking(bookingId, requireIdempotencyKey(request), { kind: "admin", id: actor.id });
    return getStaffBooking(bookingId);
  });
}
