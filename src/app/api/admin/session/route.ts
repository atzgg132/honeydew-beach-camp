import { NextRequest, NextResponse } from "next/server";
import { adminLoginContract } from "@/contracts/admin";
import { assertMutationSecurity, clearSessionCookies, setOpaqueSessionCookies } from "@/server/auth/cookies";
import { loginAdmin, requireAdminSession, revokeAdminSession } from "@/server/auth/admin-session";
import { parseJson, route } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    const input = await parseJson(request, adminLoginContract);
    const result = await loginAdmin(request, input.email, input.password);
    const response = NextResponse.json({ data: { email: result.email } });
    setOpaqueSessionCookies(response, "admin", result.token, result.csrf, result.expiresAt);
    return response;
  });
}

export async function DELETE(request: NextRequest) {
  return route(async () => {
    assertMutationSecurity(request, "admin");
    await requireAdminSession(request);
    await revokeAdminSession(request);
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookies(response, "admin");
    return response;
  });
}
