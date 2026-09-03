import { NextRequest } from "next/server";
import { adminUnallocatedNoteContract } from "@/contracts/admin";
import { requireAdminMutation } from "@/server/auth/admin-api";
import { parseJson, requireIdempotencyKey, requireUuidParam, route } from "@/server/http";
import { notePaidUnallocatedRefund } from "@/server/services/admin-booking-write";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const bookingId = requireUuidParam((await context.params).id, "id");
    const input = await parseJson(request, adminUnallocatedNoteContract);
    return notePaidUnallocatedRefund(bookingId, actor, input.note, requireIdempotencyKey(request));
  });
}
