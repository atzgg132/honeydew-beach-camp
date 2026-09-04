import { NextRequest } from "next/server";
import { adminReassignContract } from "@/contracts/admin";
import { requireAdminMutation, requireAdminRead } from "@/server/auth/admin-api";
import { parseJson, requireIdempotencyKey, requireUuidParam, route } from "@/server/http";
import { listAssignableRooms, reassignBookingRoom } from "@/server/services/admin-inventory";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string; roomId: string }> },
) {
  return route(async () => {
    await requireAdminRead(request);
    const roomId = requireUuidParam((await context.params).roomId, "roomId");
    return listAssignableRooms(roomId);
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; roomId: string }> },
) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const params = await context.params;
    const bookingId = requireUuidParam(params.id, "id");
    const bookingRoomId = requireUuidParam(params.roomId, "roomId");
    const input = await parseJson(request, adminReassignContract);
    return reassignBookingRoom({
      bookingId,
      bookingRoomId,
      roomId: input.roomId,
      actor,
      idempotencyKey: requireIdempotencyKey(request),
    });
  });
}
