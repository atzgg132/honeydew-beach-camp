import { NextRequest } from "next/server";
import { refundOtpRequestContract } from "@/contracts/admin";
import { requireAdminMutation } from "@/server/auth/admin-api";
import { parseJson, requireUuidParam, route } from "@/server/http";
import { requestRefundOtp } from "@/server/refunds/refund-otp";

export const runtime = "nodejs";

/**
 * Step 1 of the two-step online refund: mail a one-time approval code to the
 * OTP inbox for an approved refund. Returns the challenge — never the code.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const cancellationId = requireUuidParam((await context.params).id, "id");
    await parseJson(request, refundOtpRequestContract);
    return requestRefundOtp({ cancellationId, actor });
  });
}
