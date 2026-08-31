import "server-only";
import { timingSafeEqual } from "node:crypto";
import { ApiError } from "@/contracts/errors";

/**
 * Authentication for scheduled endpoints.
 *
 * These run unattended and mutate booking state — expiring holds, releasing inventory,
 * delivering notifications, reconciling payments. A caller who can invoke them can release
 * rooms out from under paying guests, so the secret is compared in constant time and a
 * missing configuration is a refusal rather than an open door.
 */
export function requireCronSecret(request: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Deliberately identical to a wrong secret: an unconfigured deployment must not be
    // distinguishable from a wrong guess.
    throw new ApiError(401, "UNAUTHORIZED", "Authorization is required.");
  }
  const presented = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new ApiError(401, "UNAUTHORIZED", "Authorization is required.");
  }
}
