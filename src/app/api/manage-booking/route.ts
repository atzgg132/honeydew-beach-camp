import { NextRequest } from "next/server";
import { requireManageSession } from "@/server/auth/manage-session";
import { route } from "@/server/http";
import { getManagedBooking } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return route(async () => {
    const session = await requireManageSession(request);
    return getManagedBooking(session.bookingId);
  });
}
