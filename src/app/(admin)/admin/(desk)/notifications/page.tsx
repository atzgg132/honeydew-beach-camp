import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { RetryNotificationButton } from "@/features/admin/notifications/RetryNotificationButton";
import {
  listNotifications,
  parseOutboxStatus,
} from "@/server/notifications/outbox";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Notifications" };

const FILTERS = [
  { value: null, label: "All" },
  { value: "QUEUED", label: "Queued" },
  { value: "SENT", label: "Sent" },
  { value: "DEAD_LETTER", label: "Dead-lettered" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "Queued",
  SENDING: "Sending",
  SENT: "Sent",
  DEAD_LETTER: "Dead-lettered",
};

function NotificationStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[6px] border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        status === "DEAD_LETTER" && "border-danger/30 text-danger",
        status === "QUEUED" && "border-honey/50 text-lagoon-900",
        status === "SENT" && "border-lagoon-800/25 text-lagoon-800",
        status === "SENDING" && "border-line text-ink/80",
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function filterHref(bookingId: string | undefined, status: string | null) {
  const params = new URLSearchParams();
  if (bookingId) params.set("bookingId", bookingId);
  if (status) params.set("status", status);
  const query = params.toString();
  return query ? `/admin/notifications?${query}` : "/admin/notifications";
}

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const bookingParam = typeof raw.bookingId === "string" ? raw.bookingId : undefined;
  const statusParam = typeof raw.status === "string" ? raw.status : null;
  let status: "QUEUED" | "SENDING" | "SENT" | "DEAD_LETTER" | null = null;
  let filterError: string | null = null;
  try {
    status = parseOutboxStatus(statusParam);
  } catch {
    filterError = "That status filter is invalid.";
  }
  const notifications = filterError
    ? []
    : await listNotifications({
        bookingId: bookingParam && /^[0-9a-f-]{36}$/i.test(bookingParam) ? bookingParam : undefined,
        status,
      });

  const activeStatus = statusParam ?? "all";
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Notifications</h1>
        <p className="text-sm text-ink/65">
          Every queued, delivered and dead-lettered email, newest first. Dead-lettered
          messages need staff follow-up after a retry.
        </p>
      </div>
      <nav aria-label="Filter notifications" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const value = filter.value ?? "all";
          const isActive = activeStatus === value || (filter.value !== null && status === filter.value);
          return (
            <Link
              key={value}
              href={filterHref(bookingParam, filter.value)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-[6px] border px-3 text-xs font-medium",
                isActive
                  ? "border-lagoon-900 bg-lagoon-900 text-cream"
                  : "border-line bg-cream-raised text-ink/80 hover:border-lagoon-900/40",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>
      {filterError ? <Notice tone="error">{filterError}</Notice> : null}
      {notifications.length === 0 ? (
        <Notice>No notifications match these filters.</Notice>
      ) : (
        <ol className="flex flex-col gap-3">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className="rounded-[6px] border border-line bg-cream-raised p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{notification.subject}</p>
                <NotificationStatusBadge status={notification.status} />
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-ink/70 sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="shrink-0 font-medium">Template</dt>
                  <dd className="font-mono">{notification.template}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 font-medium">Attempts</dt>
                  <dd>
                    {notification.attempts} of {notification.maxAttempts}
                    {notification.nextAttemptAt && notification.status === "QUEUED"
                      ? ` · next try ${new Date(notification.nextAttemptAt).toLocaleString("en-IN")}`
                      : null}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 font-medium">Queued</dt>
                  <dd>{new Date(notification.createdAt).toLocaleString("en-IN")}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 font-medium">Delivered</dt>
                  <dd>
                    {notification.sentAt
                      ? new Date(notification.sentAt).toLocaleString("en-IN")
                      : "—"}
                  </dd>
                </div>
                {notification.bookingId ? (
                  <div className="flex gap-2">
                    <dt className="shrink-0 font-medium">Booking</dt>
                    <dd>
                      <Link
                        href={`/admin/bookings/${notification.bookingId}`}
                        className="underline underline-offset-2 hover:text-ink"
                      >
                        Open in the desk
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
              {notification.lastError ? (
                <p className="mt-2 text-xs text-danger">{notification.lastError}</p>
              ) : null}
              {notification.deliveryAttempts.length > 0 ? (
                <ol className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-xs text-ink/65">
                  {notification.deliveryAttempts.map((attempt) => (
                    <li key={attempt.attemptNo}>
                      Try {attempt.attemptNo} · {new Date(attempt.createdAt).toLocaleString("en-IN")} ·{" "}
                      {attempt.ok ? "delivered" : (attempt.error ?? "failed")}
                    </li>
                  ))}
                </ol>
              ) : null}
              {notification.status === "DEAD_LETTER" || notification.status === "QUEUED" ? (
                <div className="mt-3">
                  <RetryNotificationButton id={notification.id} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
