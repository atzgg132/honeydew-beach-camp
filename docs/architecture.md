# Architecture

Next.js 16 App Router on Vercel (`sin1`), PostgreSQL on Neon (`aws-ap-southeast-1`).
One codebase serves the marketing site, the booking flow, the Manage Booking
self-service, and the staff desk (`/admin`) on a single domain.

## Request paths

- **Pages** (`src/app/(site)`, `(home)`, `(booking)`, `(admin)`) — server
  components read through `src/server/services`; the browser never computes
  money, availability, or state. Its previews are indicative only.
- **Route Handlers** (`src/app/api`) — `availability/search`, `quotes`,
  `checkout/holds`, `create-order`, `payments/verify`, `payments/webhook/*`,
  `manage-booking/*`, `contact`, `admin/*`, `internal/*`. All run on the Node.js
  runtime (`export const runtime = "nodejs"`); `server-only` imports keep
  server modules out of client bundles.
- **Domain** (`src/domain/booking`) — pure pricing, slabs, state machines,
  refund-reference rules. Covered by unit tests with no database.

## Data and safety

- Prisma 7 with pooled `DATABASE_URL` for traffic and direct `DIRECT_URL` for
  migrations/seeds. Money is integer paise; percentages are basis points.
- Tariff and policy changes publish immutable revisions; historical bookings
  keep their snapshots.
- Physical-room reservations plus a PostgreSQL GiST exclusion constraint make
  double-booking impossible even under contention.
- Signed 10-minute quotes → transactionally allocated 15-minute holds →
  Razorpay Standard Checkout for the advance; HMAC verification before
  settlement, webhook as fallback.
- Booking writes only **enqueue** mail into `NotificationOutbox` in the same
  transaction; a 5-minute scheduler (GitHub Actions → authenticated internal
  endpoints) expires holds and delivers mail with backoff + dead-lettering.
- Email goes out over SMTP (Gmail by default, nodemailer); automated desk
  refunds additionally require a one-time approval code mailed to a fixed
  inbox before Razorpay is called.

See `docs/payments.md`, `docs/notifications.md`, and `docs/environment-variables.md`.
