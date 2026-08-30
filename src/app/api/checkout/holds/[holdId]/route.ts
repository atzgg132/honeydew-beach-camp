import { NextRequest } from "next/server";
import { requireCheckoutSession } from "@/server/auth/checkout-session";
import { requireUuidParam, route } from "@/server/http";
import { getCheckoutStatus } from "@/server/services/checkout-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ holdId: string }> }) {
  return route(async () => {
    const holdId = requireUuidParam((await context.params).holdId, "holdId");
    await requireCheckoutSession(request, holdId);
    return getCheckoutStatus(holdId);
  });
}
