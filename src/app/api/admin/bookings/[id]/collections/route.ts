import { NextRequest } from "next/server";
import { adminCollectionContract } from "@/contracts/admin";
import { requireAdminMutation } from "@/server/auth/admin-api";
import { parseJson, requireIdempotencyKey, requireUuidParam, route } from "@/server/http";
import { recordHotelCollection } from "@/server/services/admin-refunds";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const bookingId = requireUuidParam((await context.params).id, "id");
    const input = await parseJson(request, adminCollectionContract);
    return recordHotelCollection({
      bookingId,
      amountPaise: input.amountPaise,
      note: input.note,
      actor,
      idempotencyKey: requireIdempotencyKey(request),
    });
  });
}
