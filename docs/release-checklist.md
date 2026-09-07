# Release Checklist

Run top to bottom before any production release or the launch itself.

## Gates (all must pass)

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run test:unit` green (CI additionally runs integration, API, and
  browser suites plus the migration rehearsal — do not ship over a red CI)

## Data

- [ ] Fresh Neon backup branch exists
- [ ] `npm run db:migrate:deploy` applied once, `db:verify` reports all
  constraints (22 as of 2026-09-06)

## Production smoke (on the live domain)

- [ ] Homepage, rooms, gallery, policies render
- [ ] Availability search returns live inventory for a test date range
- [ ] Quote → hold → order creation succeeds
- [ ] Manage Booking verification works for a known booking
- [ ] Desk login works; overview, bookings, rooms grid load
- [ ] `/admin/notifications` shows no unexpected dead letters

## Money and mail (live keys)

- [ ] One real booking completes: modal → signature → CONFIRMED
- [ ] Razorpay webhook deliveries show 200s (`payment.captured`/`order.paid`)
- [ ] Guest gets confirmation + receipt mail within ~5 minutes
- [ ] Cancel + OTP refund to source completes; `refund.processed` reconciles
- [ ] Scheduled-tasks workflow green within the last 15 minutes

## After release

- [ ] Watch webhook deliveries and dead letters for the first hour
- [ ] Keep the previous deployment noted for instant rollback
- [ ] Record the release (date, commits, migration, backup branch) here or in
  the release notes
