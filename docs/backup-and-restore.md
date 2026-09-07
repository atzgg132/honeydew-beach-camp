# Backup And Restore

Backups are Neon branches (copy-on-write snapshots). The standing backup
branch is **`prelaunch-backup`**, taken 2026-09-06 before the credential
rotation. Keep one recent branch at all times; delete drill branches after
each drill.

## Take a backup

Neon console → project `honeydew` → Branches → Create branch (from
`production`). Instant, no downtime. Name it with the date and reason.

## Restore drill (last executed 2026-09-06 — PASS)

1. Created disposable branch `restore-drill` from `production` with an
   endpoint, via the Neon API.
2. Connected directly and verified: `Booking=0`, `Room=7`, `RoomGroup=2`,
   `TariffRate=12`, `TariffRevision=1`, `HotelSettings=1`,
   `BookingPolicyRevision=1`, `AdminUser=1`, `RoomBlock=0`,
   `PaymentOrder=0`, 5/5 migrations applied — identical to production.
3. Deleted the drill branch. `production` and `prelaunch-backup` retained.

## Restore for real

1. Stop the bleeding first: if the app writes bad data, put Vercel into
   maintenance or promote a holding deployment.
2. Neon console → the backup branch → restore to a **new** branch first and
   point a Preview deployment at it to confirm contents.
3. Only then make it live (rename/swap per Neon's flow) and redeploy
   production against it.
4. Re-run `docs/release-checklist.md` smoke tests before announcing.

## Limits (honest)

- Branches are snapshots, not point-in-time logs: anything written after the
  branch point is not in it. Branch **before** risky operations.
- Free-plan branch/compute limits apply; delete drill branches promptly.
- The drill above proves restore readability, not a timed production failover.
