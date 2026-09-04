import { NextRequest } from "next/server";
import { requireAdminRead } from "@/server/auth/admin-api";
import { route } from "@/server/http";
import { getAdminOverview } from "@/server/services/admin-overview";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return route(async () => {
    await requireAdminRead(request);
    return getAdminOverview();
  });
}
