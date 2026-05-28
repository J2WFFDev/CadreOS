# CadreOS
“Coordinate athletes, families, staff, facilities, equipment, and operations through a unified organizational system.”

## Deployment policy
- `main` keeps normal Vercel deployments enabled.
- All non-`main` branches are disabled for automatic Vercel deployments.
- Copilot branches do not create Vercel previews because all non-`main` branches are disabled.

## Operational release ribbon
- The dashboard header includes a compact operational release ribbon in the top-right app shell area.
- Preferred format: `CadreOS Preview · Arc 21D · Build 21D.3 · a1b2c3d · Nav v2`.
- It reads these public environment variables:
  - `NEXT_PUBLIC_APP_ENV`
  - `NEXT_PUBLIC_RELEASE_ARC`
  - `NEXT_PUBLIC_BUILD_ITERATION`
  - `NEXT_PUBLIC_GIT_SHA`
  - `NEXT_PUBLIC_NAV_VERSION`
- Commit SHA values are shortened to 7 characters.
- Vercel fallback metadata is supported through:
  - `NEXT_PUBLIC_VERCEL_ENV` or `VERCEL_ENV`
  - `NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF` or `VERCEL_GIT_COMMIT_REF`
  - `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` or `VERCEL_GIT_COMMIT_SHA`
- `CadreOS dev · local build` is only shown when no release metadata is present at all.

### Local development
Set values in `.env.local` (or copy from `.env.example`):

```bash
NEXT_PUBLIC_APP_VERSION=0.1.0-local
NEXT_PUBLIC_RELEASE_ARC=21D
NEXT_PUBLIC_BUILD_ITERATION=21D.3
NEXT_PUBLIC_GIT_SHA=$(git rev-parse --short HEAD)
NEXT_PUBLIC_NAV_VERSION=2
NEXT_PUBLIC_APP_ENV=local
```

### GitHub Actions
Provide metadata in workflow `env` (job-level or step-level):

```yaml
env:
  NEXT_PUBLIC_RELEASE_ARC: 21D
  NEXT_PUBLIC_BUILD_ITERATION: 21D.3
  NEXT_PUBLIC_GIT_SHA: ${{ github.sha }}
  NEXT_PUBLIC_NAV_VERSION: 2
  NEXT_PUBLIC_APP_ENV: production
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF: main
```

### Vercel
Vercel can provide commit/env metadata through:

- `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`
- `NEXT_PUBLIC_VERCEL_ENV`
- `NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF`

The badge will use those when app-specific values are not present.

## Releases
- `.github/workflows/release.yml` automatically bumps the repo version on every push to `main`, commits the new `package.json` / `package-lock.json` version, tags it as `vX.Y.Z`, and creates a GitHub release.
- Preferred labels for merged PRs:
  - `release:major`
  - `release:minor`
  - `release:patch`
- If no release label is present, the workflow falls back to:
  - `major` for `BREAKING CHANGE` / conventional-commit `type!:` markers
  - `minor` for `feat` / `feature`
  - `patch` otherwise
- The release workflow skips its own `chore(release): vX.Y.Z` commits to avoid loops.
- If `main` is branch-protected, allow GitHub Actions to push the automated `chore(release): vX.Y.Z` release commit and tag.

## Database migration workflows
- Schema changes must be applied with Prisma migrations, not `prisma db push`.
- Local schema changes should be created with:
  - `npx prisma migrate dev`
- Current committed migration order is:
  1. `20260525000000_initial_cadreos_core`
  2. `20260525153000_entry_system`
  3. `20260526004640_arc19a_operational_entry_architecture`
  4. `20260526014000_arc19d_operational_graph`
  5. `20260526020000_arc19e_workflow_orchestration`
  6. `20260526024000_arc19f_notifications_activity`
  7. `20260526143000_add_person_lifecycle_status`
  8. `20260526152000_add_gearops_core_tables`
  9. `20260526223000_fix_missing_gearops_consumable_tables`
  10. `20260527000000_add_gear_reservation`
  11. `20260527133000_add_gearcategory_configuration_columns`
  12. `20260527143000_align_gearops_schema_readiness`
- `MIGRATE_DATABASE_URL` should be the Neon direct connection string for baseline/rebuild workflows and must not use the `-pooler` host.
- **Manual DB Setup** uses the runtime `DATABASE_URL` value (same secret used by Vercel app runtime).

### Manual DB Baseline
- Use **Manual DB Baseline** only for preserving an existing schema/data set that predates Prisma migration history.
- Use **Manual DB Schema Inventory** first to safely inspect table names and migration markers (no row data or secrets output).
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
     - `20260526223000_fix_missing_gearops_consumable_tables`
     - `20260527000000_add_gear_reservation`
     - `20260527133000_add_gearcategory_configuration_columns`
     - `20260527143000_align_gearops_schema_readiness`
  5. Redeploy the application build to Vercel after the database migration succeeds.
- Decision guidance for non-empty databases with no Prisma migration history:
  - If no historical core or Arc-19 markers exist, do **not** baseline historical migrations. Migrate forward (and add compatibility migrations only if concrete conflicts occur).
  - If some historical markers exist contiguously, baseline only that verified contiguous subset.

### Manual DB Rebuild (DESTRUCTIVE)
- **Manual DB Rebuild** is destructive and is only for disposable Neon dev databases.
- It requires typing `REBUILD_DISPOSABLE_DEV_DB` exactly before it will run.
- It uses `MIGRATE_DATABASE_URL`, refuses pooled Neon hosts, prints only safe diagnostics, drops and recreates the `public` schema, reapplies the full committed Prisma migration chain from `20260525000000_initial_cadreos_core` forward, regenerates the Prisma client, verifies migration status, and can optionally run the safe dev seed.
- Never use **Manual DB Rebuild** for production or any database whose existing data must be preserved.

### Manual DB Setup
- **Manual DB Setup** is the normal future migration path after baseline or rebuild is complete.
- It uses the same production `DATABASE_URL` secret value that Vercel runtime uses.
- It runs `npx prisma migrate status` and `npx prisma migrate deploy` for normal forward migration runs.
- It now verifies required GearOps tables after migration deploy.
- Use it for routine follow-up migrations after the database has a complete valid Prisma migration history with no missing earlier migrations.

#### Post-merge / post-deploy database runbook
1. Merge the PR that includes the Prisma migration files into `main`.
2. In GitHub Actions, run workflow **Manual DB Setup** (`.github/workflows/manual-db-setup.yml`) against `main`.
3. Confirm the workflow passes, including **Verify required GearOps tables exist**.
4. Trigger/confirm Vercel deployment of the latest `main` commit after the DB workflow succeeds.

## Season setup expectations
- Seasons are created per program from the app at `Programs → [Program] → New season`.
- Program and team detail pages now support a no-season state and show: `No season has been created yet.`
- The existing manual setup and seed flow remains valid:
  - Safe dev seed: `npm run prisma:seed`
  - Manual DB workflows: Baseline / Rebuild / Setup

### Manual Neon SQL season insert
- Table: `"Season"`
- Required fields:
  - `"id"` (TEXT primary key, Prisma uses `cuid()`)
  - `"organizationId"` (TEXT, FK to `"Organization"."id"`)
  - `"programId"` (TEXT, FK to `"Program"."id"`)
  - `"name"` (TEXT, unique per program via `"Season_programId_name_key"`)
  - `"updatedAt"` (TIMESTAMP(3) NOT NULL)
- Optional fields:
  - `"startDate"` (TIMESTAMP(3))
  - `"endDate"` (TIMESTAMP(3))
- Auto-default field:
  - `"createdAt"` (TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)
