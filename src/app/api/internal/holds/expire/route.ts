import { requireCronSecret } from "@/server/auth/cron";
import { route } from "@/server/http";
import { expireStaleHolds } from "@/server/services/availability-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return route(async () => {
    requireCronSecret(request);
    return { expired: await expireStaleHolds() };
  });
}
