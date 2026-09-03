import { NextRequest } from "next/server";
import { adminGuestChangeContract } from "@/contracts/admin";
import { requireAdminRead } from "@/server/auth/admin-api";
import { parseJson, requireUuidParam, route } from "@/server/http";
import { quoteGuestChange } from "@/server/services/manage-booking-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const actor = await requireAdminRead(request);
    const bookingId = requireUuidParam((await context.params).id, "id");
    const input = await parseJson(request, adminGuestChangeContract);
    return quoteGuestChange(bookingId, input.composition, { kind: "admin", id: actor.id });
  });
}
