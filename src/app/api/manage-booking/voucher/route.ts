import type { NextRequest } from "next/server";
import { requireManageSession } from "@/server/auth/manage-session";
import { route } from "@/server/http";
import { getManagedBooking } from "@/server/services/manage-booking-service";
import { toVoucherResponse } from "@/server/voucher/voucher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return route(async () => {
    const session = await requireManageSession(request);
    const booking = await getManagedBooking(session.bookingId);
    return toVoucherResponse(booking);
  });
}
