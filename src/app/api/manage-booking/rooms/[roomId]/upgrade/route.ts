import { NextRequest } from "next/server";
import { mutationQuoteContract } from "@/contracts/manage-booking";
import { assertMutationSecurity } from "@/server/auth/cookies";
import { requireManageSession } from "@/server/auth/manage-session";
import { parseJson, requireIdempotencyKey, requireUuidParam, route } from "@/server/http";
import { applyAcUpgrade } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ roomId: string }> }) {
  return route(async () => {
    assertMutationSecurity(request, "manage");
    const session = await requireManageSession(request);
    const roomId = requireUuidParam((await context.params).roomId, "roomId");
    const { quoteToken } = await parseJson(request, mutationQuoteContract);
    return applyAcUpgrade(session.bookingId, roomId, quoteToken, requireIdempotencyKey(request));
  });
}
