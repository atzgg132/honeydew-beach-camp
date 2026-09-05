# Honey Dew Beach Camp

Customer website and server-authoritative booking application for Honey Dew Beach Camp, Mousuni Island.

## Architecture

- Next.js 16 App Router and Node.js Route Handlers
- Prisma 7 with PostgreSQL
- Physical-room reservations for all holds, confirmed stays, and future room blocks
- PostgreSQL GiST exclusion constraint as the final double-booking guard
- Integer paise pricing, basis-point percentages, and immutable tariff/policy revisions
- Signed 10-minute quotes and transactionally allocated 15-minute holds
- Opaque checkout and Manage Booking sessions with HttpOnly cookies and CSRF protection
- Razorpay Standard Checkout for the stay advance; a development-only simulator remains for CI

Browser calculations are responsive previews only. PostgreSQL and the server booking domain own availability, allocation, price, payment state, outstanding balances, changes, and cancellation.

## Local setup

1. Copy `.env.example` to `.env.local` and replace every placeholder secret.
2. Provide a PostgreSQL database that supports `btree_gist`.
3. Install, migrate, seed, and start:

```bash
npm install
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

`PAYMENT_PROVIDER=razorpay` with `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` enables Standard Checkout.
`ENABLE_DEV_PAYMENT=true` enables the local payment simulator only when `NODE_ENV` is not `production`
(used by CI; set `PAYMENT_PROVIDER=dev` to force it when Razorpay keys are also present).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check |
| `npm test` | Run every Vitest project |
| `npm run test:unit` | Run the unit project only (no database) |
| `npm run test:integration` | Run the database-backed integration project |
| `npm run test:e2e` | Run the main Playwright flow |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:migrate:deploy` | Apply versioned migrations in release environments |
| `npm run db:seed` | Upsert operational configuration and inventory |
| `npm run db:verify` | Assert the hand-written constraints and indexes exist |

## Tests and CI

Vitest is split into three projects. `unit` is pure logic and needs no database.
`integration` and `api` need a migrated and seeded PostgreSQL database supplied as
`TEST_DATABASE_URL`, and they truncate tables — `test/setup/integration.ts` refuses to run
them against anything that looks like production, or against the same database as
`DATABASE_URL`.

`.github/workflows/ci.yml` runs five jobs on every push: static analysis, unit tests, a
migration rehearsal, the database-backed suites, and browser tests. The rehearsal applies
migrations to an empty database, fails on drift against the Prisma schema, asserts that
every hand-written CHECK constraint, partial unique index and the room-overlap exclusion
constraint exists, and proves the seed is idempotent.

Run the full suite locally with a second, disposable database:

```bash
TEST_DATABASE_URL="postgresql://user:password@127.0.0.1:5432/honeydew_test" npm test
```

See `docs/environment-variables.md` for the complete environment surface, and
`docs/manual-launch-blockers.md` for what still needs an owner decision or credential.

## Database and releases

Use a pooled `DATABASE_URL` for application traffic and a direct/session `DIRECT_URL` for migrations and seeds. Keep the Vercel function and database regions aligned. Production, preview, and test must use separate databases or Neon branches.

Release order:

1. Back up the database and verify the restore procedure periodically.
2. Run `npm run db:migrate:deploy` once from a serialized release job.
3. Deploy the application.
4. Smoke-test availability, quote creation, a non-production payment flow, Manage Booking verification, and hold expiry.

Never use `prisma db push` in production. Custom checks, partial indexes, and the reservation exclusion constraint live in the versioned migration under `prisma/migrations/`.

## Payment activation

Checkout creates a Razorpay order for the held advance, opens Standard Checkout, and confirms the
booking only after the HMAC signature matches. A webhook at `/api/payments/webhook/razorpay` is the
fallback when the guest closes the modal after paying.

Set `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and
`NEXT_PUBLIC_RAZORPAY_KEY_ID` in `.env.local` and in Vercel. Add `PAYMENT_WEBHOOK_SECRET` once the
Razorpay webhook is registered. Live keys stay off until the owner approves taking real money. See
blocker **B2**.

## Operational rules

- Room stays occupy `[checkIn, checkOut)`, so the checkout date can be reused.
- AC and Non-AC modes share physical inventory.
- Guests aged 11+ are adults; children 5–10 are half-price; under-five guests are free but occupy capacity.
- One person in a Single-Bed Room uses tariff tier two.
- Guest changes and AC upgrades use the booking's original tariff revision.
- Self-service closes at 11:00 AM Asia/Kolkata on check-in day.
- Cancellations release reservations atomically; refunds remain in hotel-review state.
- Cancelled and expired business records are retained.
