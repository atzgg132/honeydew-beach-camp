import "server-only";
import type { NextRequest } from "next/server";
import { ApiError } from "@/contracts/errors";
import { keyedIdentifier } from "@/server/crypto";
import { db } from "@/server/db/client";

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function consumeRateLimit(input: {
  request: NextRequest;
  scope: string;
  discriminator?: string;
  windowSeconds: number;
  limit: number;
}) {
  const nowMs = Date.now();
  const windowStart = new Date(Math.floor(nowMs / (input.windowSeconds * 1000)) * input.windowSeconds * 1000);
  const rawKey = `${clientIp(input.request)}\0${input.discriminator ?? ""}`;
  const bucketKeyHash = keyedIdentifier(rawKey, `rate-limit:${input.scope}`);
  const bucket = await db().rateLimitBucket.upsert({
    where: {
      bucketKeyHash_windowStart_windowSeconds: {
        bucketKeyHash,
        windowStart,
        windowSeconds: input.windowSeconds,
      },
    },
    create: { bucketKeyHash, windowStart, windowSeconds: input.windowSeconds, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (bucket.count > input.limit) {
    throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait and try again.");
  }
  if (Math.random() < 0.01) {
    await db().rateLimitBucket.deleteMany({
      where: { windowStart: { lt: new Date(nowMs - 48 * 60 * 60_000) } },
    });
  }
}
