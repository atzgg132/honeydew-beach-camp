import { NextRequest, NextResponse } from "next/server";
import { verifyManageBookingContract } from "@/contracts/manage-booking";
import { setOpaqueSessionCookies } from "@/server/auth/cookies";
import { verifyManageBooking } from "@/server/auth/manage-session";
import { parseJson, route } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    const input = await parseJson(request, verifyManageBookingContract);
    const result = await verifyManageBooking(request, input.reference, input.phone);
    const response = NextResponse.json({ data: { booking: result.booking } });
    setOpaqueSessionCookies(response, "manage", result.token, result.csrf, result.expiresAt);
    return response;
  });
}
