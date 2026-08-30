import { ApiError } from "@/contracts/errors";
import { requireProviderParam, route } from "@/server/http";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ provider: string }> }) {
  return route(async () => {
    const provider = requireProviderParam((await context.params).provider);
    throw new ApiError(404, "PAYMENT_PROVIDER_NOT_CONFIGURED", `Payment provider ${provider} is not configured.`);
  });
}
