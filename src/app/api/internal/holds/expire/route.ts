import { ApiError } from "@/contracts/errors";
import { route } from "@/server/http";
import { expireStaleHolds } from "@/server/services/availability-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return route(async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new ApiError(401, "UNAUTHORIZED", "Authorization is required.");
    }
    return { expired: await expireStaleHolds() };
  });
}
