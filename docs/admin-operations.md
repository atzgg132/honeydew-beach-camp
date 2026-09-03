# Admin operations

Staff use `/admin` on the same Honey Dew site. There is no public signup.

## First administrator

1. Set `ADMIN_BOOTSTRAP_EMAIL` to the owner's address.
2. Run `npm run admin:bootstrap` against the target database (`DIRECT_URL` or `DATABASE_URL`).
3. The command refuses to run if any administrator already exists.
4. It prints a single-use `/admin/accept?token=...` link. Open it, set a password of at least 12 characters, and sign in.

Email delivery is not wired yet. Pass the printed link by hand.

## Inviting more staff

Signed-in staff can create another invitation from the desk overview. The accept URL is shown on screen. Use it once within 24 hours.

## Sessions

Staff sessions last 12 hours. Sign out from the sidebar or the mobile More menu. Disabled accounts cannot sign in.

## Desk work

- **Overview** — arrivals, departures, in-house stays, refunds waiting, outstanding balances, paid-unallocated payments, live holds, and rooms blocked today.
- **Bookings** — search by reference, name, phone, email, dates, status, payment view, source, room group, or room number.
- **New booking** — phone or walk-in. Same pricing and room allocation as the website. Confirm immediately and record cash collected now (including zero).
- **Rooms** — 14-day grid. Reassign from a booking. Block a room for a date range; blocked dates disappear from customer availability. Click a block cell to release it.
- **Pricing** — publish a new tariff revision or advance percentage. Changes apply to future quotes only. Historical bookings keep their snapshots. Marketing pages still show the seeded revision-1 card until that copy is updated separately.
- **Refunds** — queued cancellations. Approve or reject, then mark processed with the amount actually returned. The site does not pay the guest automatically.

## Rules the desk must not bypass

Totals, outstanding balances, and cancellation charges are calculated by the booking services. Staff record intent (collect this amount, cancel this stay, move this room). Do not edit money columns by hand.

Unpaid website holds cannot be marked cancelled. Drop the hold instead. They expire without a booking reference.

A payment that arrives after a hold lapses stays `PAID_UNALLOCATED` until staff allocate rooms or record a refund note and pay the guest out of band. The note is an event, not a cancellation.

## Cancellation display

The desk shows the slab the server calculated from advance paid and hours until 11:00 Asia/Kolkata on the check-in date. The browser does not recompute percentages.