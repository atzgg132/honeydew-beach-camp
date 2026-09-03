import { NextRequest } from "next/server";
import { requireAdminRead } from "@/server/auth/admin-api";
import { requireUuidParam, route } from "@/server/http";
import { getStaffBooking } from "@/server/services/admin-booking-query";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    await requireAdminRead(request);
    const bookingId = requireUuidParam((await context.params).id, "id");
    return getStaffBooking(bookingId);
  });
}
