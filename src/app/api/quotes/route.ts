import { NextRequest } from "next/server";
import { quoteRequestContract } from "@/contracts/booking";
import { parseJson, route } from "@/server/http";
import { consumeRateLimit } from "@/server/rate-limit";
import { createQuote } from "@/server/services/quote-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return route(async () => {
    await consumeRateLimit({ request, scope: "quote", windowSeconds: 60 * 60, limit: 60 });
    return createQuote(await parseJson(request, quoteRequestContract));
  });
}
