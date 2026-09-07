# Incident Runbooks

Alert kinds are defined in `src/server/observability/errors.ts`. Until a
vendor adapter exists, reports go to the structured log (`alertKind` field);
triage starts in Vercel logs, then the desk.

## Money arrived but rooms are gone (`payment.paid_unallocated`)

Desk → booking → allocate rooms from another date/room, or record the refund
note and pay the guest out of band. Do not confirm over occupied inventory;
the exclusion constraint will refuse and that is correct.

## Provider charged something unexpected (`payment.amount_mismatch`)

Freeze the booking (do not amend), compare the Razorpay payment page against
`PaymentOrder`/`PaymentTransaction` rows, resolve with the guest before
touching state.

## Webhook failures (`payment.webhook_unverified`)

One is noise (a scanner). A burst is an attack or a rotated secret: check
Razorpay → Webhooks → delivery log for non-200s, and confirm
`PAYMENT_WEBHOOK_SECRET` matches between Razorpay and Vercel Production
(a redeploy is required after changing it, plus the domain re-point).

## Refund failed (`payment.refund_failed`)

The refund is re-queued as `APPROVED`. Check the Razorpay refund (`rfnd_…`)
status on the dashboard; retry from the desk with a fresh approval code once
the cause (usually insufficient settleable balance) is fixed.

## Mail stuck (`notification.dead_letter`)

Desk → Notifications shows per-attempt history. Retry from the row. If many
die at once, check `SMTP_USER`/`SMTP_PASS` and Gmail sending limits before
retrying.

## Scheduler silent (no hold expiry, no mail for >10 min)

GitHub repo → Actions → Scheduled tasks: re-run manually. Check
`CRON_SECRET`/`CRON_TARGET_URL` secrets. Holds self-heal on next availability
query, but mail only moves when the worker runs.

## Database unreachable (widespread 503 `DATABASE_NOT_CONFIGURED`/timeouts)

Check Neon status and the `DATABASE_URL` value in Vercel Production. Pool
exhaustion under load: lower `DATABASE_POOL_MAX`, then scale. Restore path:
`docs/backup-and-restore.md`.
