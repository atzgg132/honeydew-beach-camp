import { NextRequest, NextResponse } from "next/server";
import { assertMutationSecurity, clearSessionCookies } from "@/server/auth/cookies";
import { requireManageSession, revokeManageSession } from "@/server/auth/manage-session";
import { route } from "@/server/http";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  return route(async () => {
    assertMutationSecurity(request, "manage");
    await requireManageSession(request);
    await revokeManageSession(request);
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookies(response, "manage");
    return response;
  });
}
