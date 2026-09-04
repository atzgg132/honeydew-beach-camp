import { NextRequest } from "next/server";
import { adminInviteContract } from "@/contracts/admin";
import { inviteAdmin, requireAdminSession } from "@/server/auth/admin-session";
import { assertMutationSecurity } from "@/server/auth/cookies";
import { parseJson, route } from "@/server/http";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    assertMutationSecurity(request, "admin");
    const session = await requireAdminSession(request);
    const input = await parseJson(request, adminInviteContract);
    return inviteAdmin(input.email, { id: session.adminUserId, email: session.email });
  });
}
