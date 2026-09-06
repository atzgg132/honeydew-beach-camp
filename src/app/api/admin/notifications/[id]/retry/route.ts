import { NextRequest } from "next/server";
import { requireAdminMutation } from "@/server/auth/admin-api";
import { requireUuidParam, route } from "@/server/http";
import { retryNotification } from "@/server/notifications/outbox";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    await requireAdminMutation(request);
    const id = requireUuidParam((await context.params).id, "id");
    return retryNotification(id);
  });
}
