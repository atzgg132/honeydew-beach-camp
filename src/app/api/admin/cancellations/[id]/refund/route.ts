import { NextRequest } from "next/server";
import { adminRefundActionContract } from "@/contracts/admin";
import { requireAdminMutation } from "@/server/auth/admin-api";
import { parseJson, requireUuidParam, route } from "@/server/http";
import { updateRefundStatus } from "@/server/services/admin-refunds";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const cancellationId = requireUuidParam((await context.params).id, "id");
    const input = await parseJson(request, adminRefundActionContract);
    return updateRefundStatus({
      cancellationId,
      actor,
      action: input.action,
      actualRefundPaise: input.action === "process" ? input.actualRefundPaise : undefined,
      reference: input.action === "process" ? input.reference : undefined,
    });
  });
}
