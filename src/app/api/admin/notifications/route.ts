import { NextRequest } from "next/server";
import { requireAdminRead } from "@/server/auth/admin-api";
import { requireUuidParam, route } from "@/server/http";
import { listNotifications, parseOutboxStatus } from "@/server/notifications/outbox";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return route(async () => {
    await requireAdminRead(request);
    const params = request.nextUrl.searchParams;
    const rawBookingId = params.get("bookingId");
    const bookingId = rawBookingId ? requireUuidParam(rawBookingId, "bookingId") : undefined;
    const status = parseOutboxStatus(params.get("status"));
    const rawLimit = Number.parseInt(params.get("limit") ?? "", 10);
    return listNotifications({
      bookingId,
      status,
      limit: Number.isInteger(rawLimit) ? rawLimit : undefined,
    });
  });
}
