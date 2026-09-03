import { NextRequest } from "next/server";
import { adminTariffRevisionContract } from "@/contracts/admin";
import { requireAdminMutation } from "@/server/auth/admin-api";
import { parseJson, route } from "@/server/http";
import { publishTariffRevision } from "@/server/services/admin-config";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    const actor = await requireAdminMutation(request);
    const input = await parseJson(request, adminTariffRevisionContract);
    return publishTariffRevision(input.rates, actor);
  });
}
