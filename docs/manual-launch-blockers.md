# Manual launch blockers

Every item here needs a human decision, a credential, a paid account, DNS access, or an action in a
third-party dashboard. Nothing on this list can be completed from the codebase alone.

This file is the single source of truth for "what is still owed by the owner". It is updated as work
proceeds — items are added when discovered and only removed when genuinely resolved. Items are **never**
marked done to make a report look complete.

**Never paste a secret value into this file, a commit, a log, or a pull request.** Record variable *names*
only. Values go into `.env.local` (git-ignored) and the Vercel dashboard.

Status legend: `OPEN` · `PARTIAL` (code ready, credential outstanding) · `RESOLVED`

---

## B1 — Rotate the Neon database credential

- **Status:** OPEN
- **Priority:** 1 — blocks final production acceptance
- **Why:** The Neon password was previously pasted into a conversation and must be treated as disclosed.
- **Who:** Repository owner (Neon console access).
- **Environment variables:** `DATABASE_URL` (pooled), `DIRECT_URL` (direct/session).
- **Dashboard action:** Neon console → project → Roles → reset the password for the application role.
  Copy both the pooled and the direct connection strings.
- **Testable beforehand:** Everything. The application does not care what the credential is.
- **Afterwards:**
  1. Update `DATABASE_URL` and `DIRECT_URL` in `.env.local`.
  2. Update both in the Vercel project for Production **and** Preview.
  3. Redeploy.
  4. Run the production smoke tests in `docs/deployment-and-rollback.md`.
- **Verification:** the availability endpoint returns live inventory after redeploy.

---

## B2 — Razorpay live keys and webhook secret

- **Status:** PARTIAL
- **Priority:** 2 — sandbox checkout is wired; live money and webhook fallback still need dashboard work
- **Why:** Standard Checkout creates a Razorpay order, opens the hosted modal, then verifies
  `HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)` before settlement. Test keys are enough
  to exercise that path. Live keys and a webhook secret are still required before taking real money
  and before Razorpay can confirm a payment if the guest closes the modal after paying.
- **Who:** Repository owner (Razorpay merchant onboarding and KYC).
- **Environment variables:**
  - `PAYMENT_PROVIDER` — set to `razorpay`
  - `RAZORPAY_KEY_ID` — the Key ID (`rzp_test_…` in sandbox, `rzp_live_…` in production)
  - `RAZORPAY_KEY_SECRET` — the Key Secret. Server-only.
  - `NEXT_PUBLIC_RAZORPAY_KEY_ID` — the same Key ID, for the checkout modal
  - `PAYMENT_WEBHOOK_SECRET` — the webhook secret used to verify `X-Razorpay-Signature`
- **Dashboard action:** Razorpay Dashboard → Account & Settings → API Keys (start with **test** keys).
  Then Developers → Webhooks → add `https://<site>/api/payments/webhook/razorpay` and subscribe to
  `payment.captured` and `order.paid`.
- **Testable beforehand:** test-mode Standard Checkout against the test keys, plus the development
  simulator (`ENABLE_DEV_PAYMENT=true`, `PAYMENT_PROVIDER=dev`) used by CI. Settlement, amount
  checks, replay protection, and the paid-after-hold-expiry path are shared with the simulator.
- **Afterwards:** set the same variable names in Vercel Preview with test keys, redeploy, complete a
  sandbox booking, and only then switch Production to live keys.
- **Do not** set live keys until the owner explicitly approves live activation. No real money is to
  move during testing.

---

## B3 — Resend account and sending-domain DNS

- **Status:** OPEN
- **Priority:** 3 — blocks real email delivery; the outbox queues and retries without it
- **Why:** Booking confirmations, payment receipts, amendment and cancellation notices, and staff alerts
  need a verified sending domain or they will land in spam.
- **Who:** Repository owner (Resend account plus DNS access for the sending domain).
- **Environment variables:** `EMAIL_PROVIDER` (`resend` | `console`), `RESEND_API_KEY`,
  `NOTIFICATION_FROM_EMAIL`, `NOTIFICATION_REPLY_TO_EMAIL`, `STAFF_ALERT_EMAIL`.
- **DNS action:** Resend dashboard → Domains → add the sending domain, then create the SPF (`TXT`),
  DKIM (`TXT`), and return-path records it displays, at the domain registrar. Wait for verification.
- **Testable beforehand:** all notification content, routing, retry, deduplication, delivery history and
  dead-lettering are testable with the `console` and `file` adapters.
- **Afterwards:** set `EMAIL_PROVIDER=resend` in Vercel, redeploy, and send one test booking confirmation
  to an owner-controlled address.

---

## B4 — First administrator identity

- **Status:** OPEN
- **Priority:** 2 — blocks all staff access to the admin application
- **Why:** Admin access is invitation-only. Exactly one bootstrap account must be created out-of-band.
- **Who:** Repository owner — supply the email address that should hold the `ADMIN` role.
- **Environment variables:** none persistent. `ADMIN_BOOTSTRAP_EMAIL` is read once by the bootstrap command.
- **Action:** run `npm run admin:bootstrap` against the target database. The command refuses to run if any
  administrator already exists. It prints a single-use invitation link; the owner sets their own password.
- **Testable beforehand:** the entire bootstrap, invitation, login, session and role flow is covered by
  automated tests against a disposable database.

---

## B5 — Approval of the PII retention policy

- **Status:** OPEN
- **Priority:** 4 — blocks destructive retention only; reporting works without it
- **Why:** Anonymising guest contact details is irreversible. It must not happen on an engineer's judgement.
- **Who:** Repository owner, in writing.
- **Action:** read the data inventory and proposed schedule in `docs/privacy-retention.md`, then approve,
  amend, or reject the proposed retention windows.
- **Testable beforehand:** the retention engine ships in **dry-run only** mode. It reports exactly which
  records would be affected and never writes.
- **Afterwards:** the destructive path is enabled by an explicit configuration flag, not by a code change.

---

## B6 — Custom production domain (`honeydewbeachcamp.com`)

- **Status:** OPEN
- **Priority:** 5 — `honeydew-iota.vercel.app` remains the working fallback until cutover
- **Why:** Canonical URLs, sitemap, robots, cookie domain, allowed request origins and the payment webhook
  URL all derive from the site URL.
- **Who:** Repository owner — domain purchase, registrar access, and explicit authorisation to cut over.
- **Environment variables:** `NEXT_PUBLIC_SITE_URL`.
- **DNS action:** Vercel project → Settings → Domains → add the domain, then create the `A` / `CNAME`
  records Vercel displays, at the registrar.
- **Testable beforehand:** everything, by setting `NEXT_PUBLIC_SITE_URL` locally.
- **Afterwards:** set `NEXT_PUBLIC_SITE_URL` to `https://honeydewbeachcamp.com` in Vercel, redeploy, re-register the Razorpay webhook URL
  (B2), and re-run the production smoke tests. Keep the `.vercel.app` host resolving until the custom
  domain has been validated.

---

## B7 — Scheduled job cadence

- **Status:** OPEN
- **Priority:** 4 — the system is self-healing without it, but bookkeeping lags
- **Why:** Room holds expire after 15 minutes. The Vercel Hobby plan permits two cron jobs at daily
  granularity only, which cannot service that interval.
- **Who:** Repository owner — choose one.
  - **Option A (recommended, free):** a GitHub Actions scheduled workflow calls the authenticated endpoint
    every five minutes. Requires the repository secrets `CRON_SECRET` and `CRON_TARGET_URL`.
  - **Option B:** upgrade to Vercel Pro for fine-grained cron.
- **Environment variables:** `CRON_SECRET` (in Vercel, and as a GitHub Actions secret under Option A).
- **Note:** availability is already correct without any scheduler — expired holds are excluded from
  availability queries and released opportunistically when the affected rooms are next locked. The
  scheduler exists for bookkeeping, outbox delivery, and payment reconciliation.

---

## B8 — WhatsApp Business messaging

- **Status:** OPEN — deferred by owner decision
- **Priority:** 6 — email covers launch
- **Why:** Guests in this market often prefer WhatsApp, but template approval takes days to weeks.
- **Who:** Repository owner — a Meta Business account, a dedicated phone number not attached to a personal
  WhatsApp account, and message-template submission and approval.
- **Environment variables (when adopted):** `WHATSAPP_PROVIDER`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_TEMPLATE_BOOKING_CONFIRMED`.
- **Shipped regardless:** the provider-neutral WhatsApp interface, outbox routing, a development adapter,
  and tests. Only the vendor adapter is outstanding.

---

## B9 — Backup restore drill

- **Status:** OPEN
- **Priority:** 3 — a backup that has never been restored is not a backup
- **Why:** The restore procedure must be proven, not asserted.
- **Who:** Repository owner or engineer, jointly — requires Neon branch or restore permissions.
- **Action:** follow `docs/backup-and-restore.md` end to end against a **disposable** database and record
  the date, the restore point, the elapsed time, and the verification query results.
- **This item will not be marked resolved unless the drill is actually executed.** No drill has been run.

---

## Resolved

_(nothing yet)_
