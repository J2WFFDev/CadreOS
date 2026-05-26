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
- Existing Neon production data must be preserved. Do not use `prisma migrate reset`, `prisma db push --force-reset`, `DROP TABLE`, or `TRUNCATE`.
- Current committed migration order is:
  1. `20260525153000_entry_system`
  2. `20260526004640_arc19a_operational_entry_architecture`
  3. `20260526014000_arc19d_operational_graph`
  4. `20260526020000_arc19e_workflow_orchestration`
  5. `20260526024000_arc19f_notifications_activity`
  6. `20260526143000_add_person_lifecycle_status`
  7. `20260526152000_add_gearops_core_tables`
- The existing production database should be baselined only through:
  - `20260526024000_arc19f_notifications_activity`
- One-time baseline flow for an existing production database:
  1. Merge the code that contains the migration files.
  2. Run the **Manual DB Baseline** workflow against the same `DATABASE_URL` secret used by Vercel production.
  3. That one-time workflow runs `npx prisma migrate status`, marks only the historical migrations above as applied via `npx prisma migrate resolve --applied <migration_name>`, then runs `npx prisma migrate deploy`.
  4. Confirm `npx prisma migrate deploy` applies:
     - `20260526143000_add_person_lifecycle_status`
     - `20260526152000_add_gearops_core_tables`
  5. Redeploy the application build to Vercel after the database migration succeeds.
- Normal production runs after baseline:
  - `npx prisma migrate deploy`
- Recommended order for production release:
  1. Ensure `DATABASE_URL` points to production.
  2. If the database predates Prisma migration history, run the one-time **Manual DB Baseline** workflow first.
  3. Run the **Manual DB Setup** workflow, which uses `npx prisma migrate status` and `npx prisma migrate deploy`.
  4. Redeploy application build to Vercel after migration.
- The manual DB baseline/setup workflows must use the same `DATABASE_URL` secret value used by Vercel production.
