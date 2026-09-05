# Environment variables

Every variable the application reads, what breaks without it, and where it is set.

**Never commit a value.** `.env.local` is git-ignored and must stay that way. Production and
preview values live in the Vercel dashboard. CI uses throwaway values defined inline in
`.github/workflows/ci.yml` — that repository is public, so nothing there may ever be a real
credential.

Legend for **Required**: `always` · `runtime` (the deployed app) · `migrations` · `ci` · `optional`

---

## Database

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | runtime | Pooled PostgreSQL connection used by the application. Read by `src/server/db/client.ts`; a missing value returns `503 DATABASE_NOT_CONFIGURED` rather than crashing the process. |
| `DIRECT_URL` | migrations | Direct/session connection for `prisma migrate deploy` and `prisma db seed`. Pooled connections cannot run migrations reliably. Read by `prisma.config.ts` and `prisma/seed.ts`. |
| `DATABASE_POOL_MAX` | optional | Caps the pg pool size per process. Useful on serverless, where many warm instances each hold a pool. Unset means the driver default. |
| `TEST_DATABASE_URL` | ci | The **disposable** database the destructive integration suites truncate. Guarded by `test/setup/integration.ts`, which refuses to run if this resolves to the same host and database as `DATABASE_URL`, if the environment reports itself as production, or if it points at a remote host without `ALLOW_REMOTE_TEST_DATABASE`. |
| `ALLOW_REMOTE_TEST_DATABASE` | optional | Set to `true` only to point the destructive suites at a database branch created for testing. Local and CI service containers do not need it. |

`prisma.config.ts` deliberately has **no default connection string**. A missing value fails
loudly on the commands that need a database, instead of silently connecting elsewhere.

## Secrets

| Name | Required | Purpose |
|---|---|---|
| `APP_TOKEN_SECRET` | always | HMAC key for signed quotes, change quotes and derived session tokens. Must be at least 32 characters or every signing path returns `503 SERVER_NOT_CONFIGURED`. |
| `PII_LOOKUP_PEPPER` | always | Separate HMAC key for the phone lookup hash and rate-limit bucket keys. Kept distinct from `APP_TOKEN_SECRET` so a leak of one does not let an attacker enumerate guests by phone number. Also at least 32 characters. |

Generate each independently with a cryptographically secure source, for example
`node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`.

Rotating `APP_TOKEN_SECRET` invalidates every in-flight quote and checkout/manage session.
Rotating `PII_LOOKUP_PEPPER` invalidates every stored `contactPhoneLookupHash`, which breaks
Manage Booking lookup for existing bookings — it must not be rotated without a migration
that recomputes those hashes.

## Site

| Name | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | runtime | Canonical origin. Drives metadata, Open Graph, `sitemap.xml`, `robots.txt` and the payment webhook URL. Set to `https://honeydewbeachcamp.com` in production (blocker B6); the code falls back to that origin when unset, so local and preview builds must set their own value to avoid leaking production canonical URLs. |

## Scheduled jobs

| Name | Required | Purpose |
|---|---|---|
| `CRON_SECRET` | runtime | Bearer token for the internal scheduled endpoints. Without it those endpoints refuse every request, so hold expiry and outbox delivery stop running. Must also be set wherever the scheduler runs (see blocker B7). |

## Payments

| Name | Required | Purpose |
|---|---|---|
| `PAYMENT_PROVIDER` | runtime | Selects the adapter: `razorpay` or `dev`. Resolving `dev` is refused when `NODE_ENV` is production. Unset falls through to Razorpay when keys are present, otherwise to the development simulator. |
| `RAZORPAY_KEY_ID` | runtime | Razorpay Key ID. Public; also accepted as `PAYMENT_PROVIDER_KEY_ID`. |
| `RAZORPAY_KEY_SECRET` | runtime | Razorpay Key Secret. Server-only; never sent to the browser. Also accepted as `PAYMENT_PROVIDER_KEY_SECRET`. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | runtime | Same Key ID, exposed to the checkout modal. The create-order response also returns it in `clientData.keyId`. |
| `PAYMENT_WEBHOOK_SECRET` | runtime | Razorpay webhook secret. Verifies `X-Razorpay-Signature` on `/api/payments/webhook/razorpay`. Also accepted as `RAZORPAY_WEBHOOK_SECRET`. Checkout still confirms without this, via `/api/payments/verify`. |
| `ENABLE_DEV_PAYMENT` | optional | Enables the local payment simulator. Only honoured when `NODE_ENV` is not production, and the dev route returns 404 in production regardless. Used by CI so the browser suite can complete a booking without Razorpay. |

See blocker **B2**. Test keys enable sandbox checkout. Live keys and a webhook secret are still required before taking real money.

## Notifications

| Name | Required | Purpose |
|---|---|---|
| `EMAIL_PROVIDER` | runtime | `resend` or `console`. `console` writes messages to the log instead of sending. |
| `RESEND_API_KEY` | runtime | Resend API key. |
| `NOTIFICATION_FROM_EMAIL` | runtime | Sender address on a verified domain. |
| `NOTIFICATION_REPLY_TO_EMAIL` | optional | Reply-to address, typically the camp inbox. |
| `STAFF_ALERT_EMAIL` | runtime | Where payment and delivery exception alerts go. |

See blocker **B3**. WhatsApp variables are listed under blocker **B8** and are not read yet.

## Administration

| Name | Required | Purpose |
|---|---|---|
| `ADMIN_BOOTSTRAP_EMAIL` | optional | Read once by `npm run admin:bootstrap` to create the first administrator. Not needed afterwards; the command refuses to run if an administrator already exists. The script prints a single-use `/admin/accept` link. |

## Set by the platform

`NODE_ENV`, `VERCEL_ENV`, and `CI` are set by Next.js, Vercel and GitHub Actions. Do not set
them by hand. They gate the development payment simulator, the production-database guard,
secure-cookie flags, and CI-only test behaviour.

---

## Minimum sets

**Local development**

`DATABASE_URL`, `DIRECT_URL`, `APP_TOKEN_SECRET`, `PII_LOOKUP_PEPPER`,
`NEXT_PUBLIC_SITE_URL`, `ENABLE_DEV_PAYMENT=true`

**Full test suite locally**

The above, plus `TEST_DATABASE_URL` pointing at a second, disposable database.

**Production**

`DATABASE_URL`, `DIRECT_URL`, `APP_TOKEN_SECRET`, `PII_LOOKUP_PEPPER`,
`NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, and the payment and notification variables once
their blockers are cleared. `ENABLE_DEV_PAYMENT` must **not** be set.
