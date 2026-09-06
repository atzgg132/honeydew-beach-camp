# Notifications

Email delivery for booking lifecycle mail and staff alerts. Guest WhatsApp is a
deferred owner decision (blocker B8); everything below is email only.

## How it works

Booking, payment and mutation paths never send mail. They **enqueue** a row in
`NotificationOutbox` inside the same database transaction as the state change, so a
confirmed booking cannot exist without its confirmation mail queued, and a
rolled-back write leaves no orphan mail. A scheduled worker then delivers:

1. `POST /api/internal/notifications/deliver` (bearer `CRON_SECRET`, same pattern as
   hold expiry) calls `requeueStuckDeliveries()` and `processDueNotifications()`.
2. The worker claims due rows (`QUEUED`, `nextAttemptAt` reached), sends through the
   configured provider, and records every attempt in `NotificationAttempt`.
3. Failures back off (1 minute, 5 minutes, 15 minutes, 1 hour) and dead-letter after
   5 attempts, reporting `notification.dead_letter` for staff follow-up.

Dedupe keys (`booking-confirmed:{bookingId}`, `payment-receipt:{orderId}`,
`refund-processed:{cancellationId}`, …) make enqueue idempotent: webhook
redeliveries and idempotency-key replays upsert the same key instead of queueing a
second mail.

## Templates

Guest mail, rendered at enqueue time in `src/server/notifications/templates.ts`:

| Template | Sent when |
|---|---|
| `booking_confirmation` | Booking confirmed (online payment, staff allocation, staff-created) |
| `payment_receipt` | Advance received online |
| `booking_amended` | Guest composition change or AC upgrade, by guest or desk |
| `booking_cancelled` | Booking cancelled, by guest or desk |
| `refund_processed` | Refund marked processed in the desk |

Staff alerts to `STAFF_ALERT_EMAIL`:

| Template | Sent when |
|---|---|
| `staff_new_booking` | Any confirmation |
| `staff_booking_cancelled` | Any cancellation |
| `staff_booking_modified` | Any amendment |
| `staff_payment_exception` | Paid-after-expiry or amount mismatch — needs manual resolution |
| `staff_contact_enquiry` | Website contact-page enquiry (no booking; falls back to the camp inbox when `STAFF_ALERT_EMAIL` is unset so it never vanishes) |

## Configuration

See `docs/environment-variables.md` (Notifications) and blocker B3. `EMAIL_PROVIDER`
is `smtp` or `console` (default). `console` writes messages to the structured log
instead of sending and needs no credentials. `smtp` sends through Gmail by default
and needs `SMTP_USER` plus a Gmail App Password in `SMTP_PASS`; without them the delivery run fails
loudly and messages stay queued. `STAFF_ALERT_EMAIL` unset means staff alerts are
skipped (guest mail still queues).

## Operations

- **Delivery history:** the desk `/admin/notifications` page lists every message with
  per-attempt history, filterable by status and booking. `GET /api/admin/notifications`
  serves the same data.
- **Retry:** `POST /api/admin/notifications/{id}/retry` (or the button on a
  dead-lettered row) re-queues a message with a fresh attempt cycle.
- **No real mail in tests:** suites use the `console` provider or an injected fake.
  Never set real SMTP credentials outside production.
- **Scheduler:** until blocker B7 is resolved, trigger delivery by POSTing the
  internal endpoint with the `CRON_SECRET` bearer on the chosen cadence (every few
  minutes; backoff already spaces retries).
