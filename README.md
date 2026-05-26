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
- Use **Manual DB Schema Inventory** first to safely inspect table names and migration markers (no row data/secrets output).
- One-time baseline flow for an existing production database:
  1. Merge the code that contains the migration files.
  2. Run **Manual DB Schema Inventory** and review:
     - existing table names
     - historical baseline marker presence
     - protected migration marker presence
     - missing target tables/columns vs `prisma/schema.prisma`
  3. Run **Manual DB Baseline** only after reviewing inventory output.
     - `baseline_migration=auto_detect_highest_existing` baselines only the contiguous historical migrations whose required tables/columns already exist.
     - Explicit boundary selection fails safely when expected markers are missing.
     - Protected migrations are never part of the baseline resolve list.
  4. Confirm `npx prisma migrate deploy` applies:
     - `20260526143000_add_person_lifecycle_status`
     - `20260526152000_add_gearops_core_tables`
  5. Redeploy the application build to Vercel after the database migration succeeds.
- Decision guidance for non-empty databases with no Prisma migration history:
  - If no historical Arc-19 markers exist, do **not** baseline Arc-19 migrations. Migrate forward (and add compatibility migrations only if concrete conflicts occur).
  - If some historical markers exist contiguously, baseline only that verified contiguous subset.
  - If database is empty-ish and has no production data value, perform reset/rebuild only with explicit approval.
- Normal production runs after baseline:
  - `npx prisma migrate deploy`
- Recommended order for production release:
  1. Ensure `DATABASE_URL` points to production.
  2. If the database predates Prisma migration history, run the one-time **Manual DB Baseline** workflow first.
  3. Run the **Manual DB Setup** workflow, which uses `npx prisma migrate status` and `npx prisma migrate deploy`.
  4. Redeploy application build to Vercel after migration.
- Vercel app runtime continues to use the production `DATABASE_URL` secret value.
- **Manual DB Setup** Prisma migration commands may use `MIGRATE_DATABASE_URL` when configured, and otherwise fall back to `DATABASE_URL`.
- `MIGRATE_DATABASE_URL` should be the Neon direct connection string for the same production database and should not use the `-pooler` host.
