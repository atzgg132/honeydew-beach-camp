import { requireCronSecret } from "@/server/auth/cron";
import { route } from "@/server/http";
import { processDueNotifications, requeueStuckDeliveries } from "@/server/notifications/outbox";

export const runtime = "nodejs";

/**
 * Scheduled delivery for the notification outbox. Same `CRON_SECRET` bearer pattern
 * as hold expiry: without the secret every request is refused, so queued mail simply
 * waits instead of leaking. The scheduler (GitHub Actions workflow per blocker B7,
 * or Vercel cron) POSTs here every few minutes.
 */
export async function POST(request: Request) {
  return route(async () => {
    requireCronSecret(request);
    const { requeued } = await requeueStuckDeliveries();
    const delivery = await processDueNotifications();
    return { requeued, ...delivery };
  });
}
