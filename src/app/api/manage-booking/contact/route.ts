import { NextRequest } from "next/server";
import { updateContactContract } from "@/contracts/manage-booking";
import { assertMutationSecurity } from "@/server/auth/cookies";
import { requireManageSession } from "@/server/auth/manage-session";
import { parseJson, requireIdempotencyKey, route } from "@/server/http";
import { updateManagedContact } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  return route(async () => {
    assertMutationSecurity(request, "manage");
    const session = await requireManageSession(request);
    const input = await parseJson(request, updateContactContract);
    return updateManagedContact(session.bookingId, input, requireIdempotencyKey(request));
  });
}
