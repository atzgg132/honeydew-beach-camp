import { NextRequest } from "next/server";
import { requireAdminRead } from "@/server/auth/admin-api";
import { requireUuidParam, route } from "@/server/http";
import { quoteAcUpgrade } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; roomId: string }> },
) {
  return route(async () => {
    const actor = await requireAdminRead(request);
    const params = await context.params;
    const bookingId = requireUuidParam(params.id, "id");
    const roomId = requireUuidParam(params.roomId, "roomId");
    return quoteAcUpgrade(bookingId, roomId, { kind: "admin", id: actor.id });
  });
}
