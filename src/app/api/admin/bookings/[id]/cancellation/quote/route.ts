import { NextRequest } from "next/server";
import { requireAdminRead } from "@/server/auth/admin-api";
import { requireUuidParam, route } from "@/server/http";
import { getCancellationQuote } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const actor = await requireAdminRead(request);
    const bookingId = requireUuidParam((await context.params).id, "id");
    return getCancellationQuote(bookingId, { kind: "admin", id: actor.id });
  });
}
