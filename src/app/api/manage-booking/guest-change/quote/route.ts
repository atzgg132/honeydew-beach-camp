import { NextRequest } from "next/server";
import { guestChangeQuoteContract } from "@/contracts/manage-booking";
import { requireManageSession } from "@/server/auth/manage-session";
import { parseJson, route } from "@/server/http";
import { quoteGuestChange } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    const session = await requireManageSession(request);
    const { composition } = await parseJson(request, guestChangeQuoteContract);
    return quoteGuestChange(session.bookingId, composition);
  });
}
