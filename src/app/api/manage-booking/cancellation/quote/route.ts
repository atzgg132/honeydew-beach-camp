import { NextRequest } from "next/server";
import { requireManageSession } from "@/server/auth/manage-session";
import { route } from "@/server/http";
import { getCancellationQuote } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return route(async () => {
    const session = await requireManageSession(request);
    return getCancellationQuote(session.bookingId);
  });
}
