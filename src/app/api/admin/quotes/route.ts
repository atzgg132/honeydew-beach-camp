import { NextRequest } from "next/server";
import { quoteRequestContract } from "@/contracts/booking";
import { requireAdminRead } from "@/server/auth/admin-api";
import { parseJson, route } from "@/server/http";
import { createQuote } from "@/server/services/quote-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    await requireAdminRead(request);
    return createQuote(await parseJson(request, quoteRequestContract));
  });
}
