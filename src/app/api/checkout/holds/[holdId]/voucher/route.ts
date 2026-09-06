import type { NextRequest } from "next/server";
import { ApiError } from "@/contracts/errors";
import { requireCheckoutSession } from "@/server/auth/checkout-session";
import { requireUuidParam, route } from "@/server/http";
import { getCheckoutStatus } from "@/server/services/checkout-service";
import { toVoucherResponse } from "@/server/voucher/voucher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ holdId: string }> }) {
  return route(async () => {
    const holdId = requireUuidParam((await context.params).holdId, "holdId");
    await requireCheckoutSession(request, holdId);
    const status = await getCheckoutStatus(holdId);
    if (!status.booking) {
      throw new ApiError(409, "INVALID_STATE", "This booking is not confirmed yet.");
    }
    return toVoucherResponse(status.booking);
  });
}
