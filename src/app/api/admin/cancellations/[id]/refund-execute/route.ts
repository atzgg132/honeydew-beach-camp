import { NextRequest } from "next/server";
import { refundExecuteContract } from "@/contracts/admin";
import { requireAdminMutation } from "@/server/auth/admin-api";
import { parseJson, requireUuidParam, route } from "@/server/http";
import { notifyRefundProcessed } from "@/server/notifications/notify";
import { executeOnlineRefund } from "@/server/services/admin-refund-online";

export const runtime = "nodejs";

/**
 * Step 2 of the two-step online refund: verify the approval code and pay the
 * refund to source through Razorpay. The refund write already committed, so
 * queueing the guest mail must not fail it.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const cancellationId = requireUuidParam((await context.params).id, "id");
    const input = await parseJson(request, refundExecuteContract);
    const result = await executeOnlineRefund({
      cancellationId,
      actor,
      challengeId: input.challengeId,
      otp: input.otp,
      actualRefundPaise: input.actualRefundPaise,
    });
    if (result.status === "PROCESSED") {
      await notifyRefundProcessed({ cancellationId });
    }
    return { booking: result.booking, refundId: result.refundId, status: result.status };
  });
}
