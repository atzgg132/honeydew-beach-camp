import { NextRequest } from "next/server";
import { requireAdminMutation } from "@/server/auth/admin-api";
import { requireUuidParam, route } from "@/server/http";
import { releaseRoomBlock } from "@/server/services/admin-inventory";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const blockId = requireUuidParam((await context.params).id, "id");
    return releaseRoomBlock(blockId, actor);
  });
}
