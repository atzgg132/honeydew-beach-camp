import { NextRequest } from "next/server";
import { mutationQuoteContract } from "@/contracts/manage-booking";
import { assertMutationSecurity } from "@/server/auth/cookies";
import { requireManageSession } from "@/server/auth/manage-session";
import { parseJson, requireIdempotencyKey, route } from "@/server/http";
import { applyGuestChange } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    assertMutationSecurity(request, "manage");
    const session = await requireManageSession(request);
    const { quoteToken } = await parseJson(request, mutationQuoteContract);
    return applyGuestChange(session.bookingId, quoteToken, requireIdempotencyKey(request));
  });
}
