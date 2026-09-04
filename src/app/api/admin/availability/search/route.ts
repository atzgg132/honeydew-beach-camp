import { NextRequest } from "next/server";
import { availabilitySearchContract } from "@/contracts/booking";
import { requireAdminRead } from "@/server/auth/admin-api";
import { parseJson, route } from "@/server/http";
import { searchAvailability } from "@/server/services/availability-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    await requireAdminRead(request);
    return searchAvailability(await parseJson(request, availabilitySearchContract));
  });
}
