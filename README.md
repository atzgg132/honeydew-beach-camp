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
- Development-only payment provider; production checkout remains unavailable until a real provider is configured

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

`ENABLE_DEV_PAYMENT=true` enables the local payment simulator only when `NODE_ENV` is not `production`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest unit tests |
| `npm run test:e2e` | Run the main Playwright flow |
| `npx tsc --noEmit` | Type-check |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:migrate:deploy` | Apply versioned migrations in release environments |
| `npm run db:seed` | Upsert operational configuration and inventory |

## Database and releases

Use a pooled `DATABASE_URL` for application traffic and a direct/session `DIRECT_URL` for migrations and seeds. Keep the Vercel function and database regions aligned. Production, preview, and test must use separate databases or Neon branches.

Release order:

1. Back up the database and verify the restore procedure periodically.
2. Run `npm run db:migrate:deploy` once from a serialized release job.
3. Deploy the application.
4. Smoke-test availability, quote creation, a non-production payment flow, Manage Booking verification, and hold expiry.

Never use `prisma db push` in production. Custom checks, partial indexes, and the reservation exclusion constraint live in the versioned migration under `prisma/migrations/`.

## Payment activation

The checked-in payment interface, order/transaction tables, replay-safe webhook table, and dev adapter are the integration seam. Before enabling production checkout, add a real provider adapter, raw-body signature verification, provider sandbox end-to-end tests, reconciliation, and the production cron secret. The current webhook endpoint deliberately reports that no production provider is configured.

## Operational rules

- Room stays occupy `[checkIn, checkOut)`, so the checkout date can be reused.
- AC and Non-AC modes share physical inventory.
- Guests aged 11+ are adults; children 5–10 are half-price; under-five guests are free but occupy capacity.
- One person in a Single-Bed Room uses tariff tier two.
- Guest changes and AC upgrades use the booking's original tariff revision.
- Self-service closes at 11:00 AM Asia/Kolkata on check-in day.
- Cancellations release reservations atomically; refunds remain in hotel-review state.
- Cancelled and expired business records are retained.
