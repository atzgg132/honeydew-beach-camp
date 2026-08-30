import { NextRequest } from "next/server";
import { assertMutationSecurity } from "@/server/auth/cookies";
import { requireManageSession } from "@/server/auth/manage-session";
import { requireIdempotencyKey, route } from "@/server/http";
import { cancelManagedBooking } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    assertMutationSecurity(request, "manage");
    const session = await requireManageSession(request);
    return cancelManagedBooking(session.bookingId, requireIdempotencyKey(request));
  });
}
