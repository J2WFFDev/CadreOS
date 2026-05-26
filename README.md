# CadreOS
“Coordinate athletes, families, staff, facilities, equipment, and operations through a unified organizational system.”

## Deployment policy
- `main` keeps normal Vercel deployments enabled.
- All non-`main` branches are disabled for automatic Vercel deployments.
- Copilot branches do not create Vercel previews because all non-`main` branches are disabled.

## Production database migrations (Vercel)
- Production schema changes must be applied with Prisma migrations, not `prisma db push`.
- Local schema changes should be created with:
  - `npx prisma migrate dev`
- Run this against the production database before/with production rollout:
  - `npx prisma migrate deploy`
- Recommended order for production release:
  1. Ensure `DATABASE_URL` points to production.
  2. Run `npx prisma migrate deploy`.
  3. Redeploy application build to Vercel after migration.
- The manual DB setup workflow must use the same `DATABASE_URL` secret value used by Vercel production.
