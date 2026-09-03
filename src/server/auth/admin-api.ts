import "server-only";
import type { NextRequest } from "next/server";
import { requireAdminSession, type AdminActor } from "@/server/auth/admin-session";
import { assertMutationSecurity } from "@/server/auth/cookies";

export async function requireAdminRead(request: NextRequest): Promise<AdminActor> {
  const session = await requireAdminSession(request);
  return { id: session.adminUserId, email: session.email };
}

export async function requireAdminMutation(request: NextRequest): Promise<AdminActor> {
  assertMutationSecurity(request, "admin");
  return requireAdminRead(request);
}
