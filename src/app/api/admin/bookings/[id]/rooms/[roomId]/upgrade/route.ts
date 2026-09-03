import { NextRequest } from "next/server";
import { adminQuoteTokenContract } from "@/contracts/admin";
import { requireAdminMutation } from "@/server/auth/admin-api";
import { parseJson, requireIdempotencyKey, requireUuidParam, route } from "@/server/http";
import { getStaffBooking } from "@/server/services/admin-booking-query";
import { applyAcUpgrade } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; roomId: string }> },
) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const params = await context.params;
    const bookingId = requireUuidParam(params.id, "id");
    const roomId = requireUuidParam(params.roomId, "roomId");
    const input = await parseJson(request, adminQuoteTokenContract);
    await applyAcUpgrade(bookingId, roomId, input.quoteToken, requireIdempotencyKey(request), {
      kind: "admin",
      id: actor.id,
    });
    return getStaffBooking(bookingId);
  });
}
