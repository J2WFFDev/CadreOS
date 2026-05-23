# Phase 6D — FieldOps DB Update and Schema Validation

## Goal

Validate that Phase 6C FieldOps Prisma schema is database-ready for Neon and does not break existing Core MVP routes.

---

## Schema Readiness Check

Confirmed in `prisma/schema.prisma`:

- FieldOps models exist:
  - `Facility`
  - `FacilityResource`
  - `ResourceBooking`
  - `BookingConflict`
- FieldOps enums exist:
  - `FacilityStatus`
  - `ResourceStatus`
  - `ResourceType`
  - `BookingStatus`
  - `PrecheckStatus`
  - `ApprovalStatus`
  - `ConflictType`
  - `ConflictSeverity`

Validation command:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require&pgbouncer=true" npx prisma validate
```

Result: schema validates successfully.

---

## DB Update Path (Manual / Controlled)

Do **not** run DB migration automatically from app startup/runtime code.

Use one of these manual paths:

1. **Preferred (repo workflow):** GitHub Actions `Manual DB Setup`
   - Workflow: `.github/workflows/manual-db-setup.yml`
   - Trigger: `workflow_dispatch` only
   - Steps:
     1. `npm ci`
     2. `npx prisma generate`
     3. `npx prisma db push`
     4. `npm run prisma:seed`
   - Requirement: repository secret `DATABASE_URL` must target Neon.

2. **Equivalent local/manual operator path:**
   - `npm ci`
   - `npx prisma generate`
   - `DATABASE_URL="..." npx prisma db push`
   - `DATABASE_URL="..." npm run prisma:seed`

---

## Seed Behavior Confirmation

`prisma/seed.mjs` includes FieldOps demo data and remains idempotent:

- Uses fixed IDs and `upsert` for:
  - `Facility` (`cadreos-demo-facility`)
  - `FacilityResource` (`cadreos-demo-resource-bay-a`, `cadreos-demo-resource-bay-b`)
- No `ResourceBooking` or `BookingConflict` demo records are seeded in this phase.
- Existing non-FieldOps seed entries remain controlled/manual and re-runnable.

---

## Validation Steps

Run:

```bash
npm run typecheck
npm run lint
DATABASE_URL="..." npx prisma validate
```

Then confirm DB push/seed step has been run manually for the target Neon environment.

---

## Smoke Test Checklist (Post-DB-Update)

After manual DB update (`db push`) and seed:

- [ ] `GET /api/health/db` returns healthy DB response
- [ ] `/dashboard` loads
- [ ] `/people` loads
- [ ] `/programs` loads
- [ ] `/teams` loads
- [ ] `/events` loads
- [ ] `/notes` loads
- [ ] `/tasks` loads
- [ ] `/account` loads
- [ ] No FieldOps UI is visible yet (expected for this phase)
- [ ] No runtime Prisma missing-table errors occur after DB update

Expected outcome:

- Existing Core MVP routes continue to work.
- FieldOps schema is present in DB, but FieldOps UX/workflows are still deferred.

---

## Rollback Concerns

- `prisma db push` is a direct schema sync, not a versioned migration history.
- Rollback requires operator-managed database recovery strategy (backup/restore or forward-fix schema change).
- Run DB update in controlled windows and verify smoke checks immediately.
- Keep this phase limited to schema/table readiness only (no runtime behavior toggles).

---

## Known Limitations

- No FieldOps UI/routes in this phase.
- No booking request workflow implementation.
- No conflict detection logic execution.
- No approval workflow implementation.
- No GearOps work.
- No Entry/Inbox implementation.
- No refactor of Notes/Tasks/Events behavior.

---

## Phase 6D Output Summary

1. **Files changed**
   - `planning/PHASE_6D_FIELDOPS_DB_UPDATE_VALIDATION.md`
   - `planning/README.md`

2. **DB update steps documented**
   - Yes — manual GitHub workflow and equivalent local operator path.

3. **Seed behavior confirmed**
   - Yes — FieldOps facility/resource seed is idempotent and booking seed remains deferred.

4. **Smoke test checklist**
   - Included for `/api/health/db`, dashboard, people, programs, teams, events, notes, tasks, account, and no FieldOps UI/missing-table errors.

5. **FieldOps readiness for read-only views**
   - **Ready for Phase 6E read-only view implementation** after manual DB push + smoke checks pass in target environment.
