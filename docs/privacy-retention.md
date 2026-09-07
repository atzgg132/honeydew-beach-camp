# Privacy Retention

> Status: PROPOSED — the destructive path is disabled. Nothing here runs
> without the owner's written approval (blocker B5).

## Data inventory (guest PII)

- `Booking.contactFullName`, `contactEmail`, `contactPhone`,
  `contactPhoneLookupHash` (HMAC with `PII_LOOKUP_PEPPER`).
- Money and stay records (`PaymentOrder`, `PaymentTransaction`,
  `BookingRoom`, `Cancellation`, events) reference bookings but carry no
  contact details themselves.
- `NotificationOutbox`/`NotificationAttempt` store recipient addresses and
  rendered mail bodies (delivery history for the desk).

## Proposed schedule (awaits owner decision)

- Operational window: keep full contact details for **13 months** after
  checkout (covers chargebacks, tax queries, repeat-guest lookup).
- After that: anonymise name/email/phone to `redacted`, keep money, dates,
  room and event rows for accounts. Lookup hashes are recomputed or dropped
  so old phone numbers stop resolving.
- Staff accounts and audit events are never anonymised.

## Engine state

Retention runs in **dry-run only**: it reports exactly which records would be
affected and never writes. Enabling destruction requires an explicit
configuration flag plus the owner's written approval — never a code change
alone. Rotating `PII_LOOKUP_PEPPER` without a hash-recomputation migration
breaks Manage Booking lookup for existing stays, so pepper rotation is part
of any retention change, not an independent action.
