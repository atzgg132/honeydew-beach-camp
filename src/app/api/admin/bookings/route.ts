import { NextRequest } from "next/server";
import { adminCreateBookingContract } from "@/contracts/admin";
import { requireAdminMutation, requireAdminRead } from "@/server/auth/admin-api";
import { parseJson, requireIdempotencyKey, route } from "@/server/http";
import { listStaffBookings, parseAdminBookingListQuery } from "@/server/services/admin-booking-query";
import { createStaffBooking } from "@/server/services/admin-booking-write";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return route(async () => {
    await requireAdminRead(request);
    return listStaffBookings(parseAdminBookingListQuery(request.nextUrl.searchParams));
  });
}

export async function POST(request: NextRequest) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const input = await parseJson(request, adminCreateBookingContract);
    return createStaffBooking({
      ...input,
      idempotencyKey: requireIdempotencyKey(request),
      actor,
    });
  });
}
