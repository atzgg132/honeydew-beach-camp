import { NextRequest } from "next/server";
import { requireAdminMutation } from "@/server/auth/admin-api";
import { requireIdempotencyKey, requireUuidParam, route } from "@/server/http";
import { allocatePaidUnallocated } from "@/server/services/admin-booking-write";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const bookingId = requireUuidParam((await context.params).id, "id");
    return allocatePaidUnallocated(bookingId, actor, requireIdempotencyKey(request));
  });
}
