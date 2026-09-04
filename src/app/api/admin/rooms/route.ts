import { NextRequest } from "next/server";
import { requireAdminRead } from "@/server/auth/admin-api";
import { route } from "@/server/http";
import { getRoomGrid } from "@/server/services/admin-inventory";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return route(async () => {
    await requireAdminRead(request);
    const from = request.nextUrl.searchParams.get("from") ?? undefined;
    const daysRaw = Number(request.nextUrl.searchParams.get("days") ?? "14");
    const days = Number.isInteger(daysRaw) && daysRaw >= 1 && daysRaw <= 31 ? daysRaw : 14;
    return getRoomGrid(from, days);
  });
}
