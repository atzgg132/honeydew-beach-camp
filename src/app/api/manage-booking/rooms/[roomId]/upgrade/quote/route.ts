import { NextRequest } from "next/server";
import { requireManageSession } from "@/server/auth/manage-session";
import { requireUuidParam, route } from "@/server/http";
import { quoteAcUpgrade } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ roomId: string }> }) {
  return route(async () => {
    const session = await requireManageSession(request);
    const roomId = requireUuidParam((await context.params).roomId, "roomId");
    return quoteAcUpgrade(session.bookingId, roomId);
  });
}
