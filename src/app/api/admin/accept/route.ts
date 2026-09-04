import { NextRequest, NextResponse } from "next/server";
import { adminAcceptContract } from "@/contracts/admin";
import { acceptAdminInvitation } from "@/server/auth/admin-session";
import { setOpaqueSessionCookies } from "@/server/auth/cookies";
import { parseJson, route } from "@/server/http";
import { consumeRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    await consumeRateLimit({ request, scope: "admin-accept", windowSeconds: 60 * 60, limit: 30 });
    const input = await parseJson(request, adminAcceptContract);
    const result = await acceptAdminInvitation(input.token, input.password);
    const response = NextResponse.json({ data: { email: result.email } });
    setOpaqueSessionCookies(response, "admin", result.token, result.csrf, result.expiresAt);
    return response;
  });
}
