import { NextRequest } from "next/server";
import { availabilitySearchContract } from "@/contracts/booking";
import { parseJson, route } from "@/server/http";
import { consumeRateLimit } from "@/server/rate-limit";
import { searchAvailability } from "@/server/services/availability-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    await consumeRateLimit({ request, scope: "availability", windowSeconds: 60 * 60, limit: 120 });
    return searchAvailability(await parseJson(request, availabilitySearchContract));
  });
}
