import { NextRequest } from "next/server";
import { adminRoomBlockContract } from "@/contracts/admin";
import { requireAdminMutation } from "@/server/auth/admin-api";
import { parseJson, route } from "@/server/http";
import { createRoomBlock } from "@/server/services/admin-inventory";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const input = await parseJson(request, adminRoomBlockContract);
    return createRoomBlock({ ...input, actor });
  });
}
