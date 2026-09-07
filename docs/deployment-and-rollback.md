# Deployment And Rollback

## Deploy

1. Merge to `main`. Vercel builds and deploys automatically, or run
   `vercel --prod --yes` from the repo root with the Vercel CLI.
2. Environment changes take effect **only on the next deployment** — changing
   a variable without redeploying does nothing.
3. Database first, app second: `npm run db:migrate:deploy` (serialized, once),
   then deploy, then smoke-test (see `docs/release-checklist.md`). Never
   `prisma db push` against production.

## Domain gotcha (learned 2026-09-06)

The custom domains (`honeydewbeachcamp.com`, `www`) are **pinned to specific
deployments** — `vercel --prod` moves the `*.vercel.app` aliases but not them.
After every production deploy, re-point both:

```bash
vercel alias set <new-deployment>.vercel.app www.honeydewbeachcamp.com
vercel alias set <new-deployment>.vercel.app honeydewbeachcamp.com
```

Verify with the cron probe (expect HTTP 200) and the homepage before
announcing. Until the domains are re-attached at project level, **every**
production deploy needs this step.

## Rollback

- **App:** Vercel dashboard → Deployments → promote the previous good build,
  then re-point both custom domains at it (same gotcha). Instant, no data
  effects.
- **Database:** forward-fix with a new migration is preferred. For data
  recovery, restore from a Neon branch (see `docs/backup-and-restore.md`).
  Never roll the schema back without a matching code rollback.
