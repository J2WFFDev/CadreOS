# Phase 17F Validation Checklist

## Purpose

Confirms Arc 17F (Season Rollover Workflow) is implemented correctly, preserves existing behavior, and stays within Arc 17 scope boundaries.

---

## 1. Scope Compliance

- [x] Season rollover page is added at `GET /programs/[programId]/seasons/[seasonId]/rollover`.
- [x] Season rollover execute route is added at `POST /programs/[programId]/seasons/[seasonId]/rollover/execute`.
- [x] Program detail page shows a **Rollover** link next to each season.
- [x] Existing activate, inactive, archive, and move entry points are preserved.
- [x] Rollover does not delete source-season roster memberships.
- [x] Rollover does not change `Person.lifecycleStatus`.
- [x] Rollover does not modify role assignments.
- [x] Rollover does not modify guardian relationships.
- [x] Rollover does not modify attendance, notes, tasks, FieldOps, or GearOps records.
- [x] No guardian maintenance workflows added.
- [x] No reporting pages added.
- [x] No messaging/notification workflows added.
- [x] No parent portal behavior added.
- [x] No payments/dues/billing added.
- [x] FieldOps behavior is unchanged.
- [x] GearOps behavior is unchanged.
- [x] Prisma schema is unchanged in Arc 17F.

---

## 2. Authorization

- [x] `season.rollover` action is defined in `lib/permissions/index.ts`.
- [x] `season.rollover` is granted to `ORGANIZATION_ADMIN`.
- [x] `season.rollover` is granted to `PROGRAM_DIRECTOR`.
- [x] `season.rollover` is NOT granted to `COACH`.
- [x] `season.rollover` is NOT granted to `ASSISTANT_COACH`, `ATHLETE`, or `PARENT_GUARDIAN`.
- [x] `season.rollover` is in `SCOPED_ACTIONS` (program-scoped, same as `season.create`).
- [x] Execute route uses `requirePhase1CMutationPermission` with action `season.rollover` and `programId`.
- [x] Rollover page uses `evaluateStaffOnlyContentAccess` for display-level staff check.
- [x] Existing permissions (`season.create`, `season.update`, `person.activate`, `person.move`, etc.) remain unchanged.

---

## 3. Organization Scoping and Validation

- [x] Source season is validated as belonging to the current organization and program.
- [x] Target season is validated as belonging to the current organization and same program.
- [x] Source and target season must be different.
- [x] Invalid source season ID returns safe not-found state on page.
- [x] Invalid target season ID returns error redirect on execute.
- [x] Same-season rollover attempt returns error redirect on execute.

---

## 4. Eligible Membership Filtering

- [x] ARCHIVED persons are always excluded from rollover.
- [x] INACTIVE persons are excluded by default (`includeInactive` not set).
- [x] INACTIVE persons are included when `includeInactive=1` is present.
- [x] ACTIVE, PROSPECT, and ALUMNI persons are always included.
- [x] Preview on rollover page reflects current `includeInactive` filter setting.

---

## 5. Rollover Execution Safety

- [x] New `RosterMembership` records are created for target season.
- [x] `createMany` with `skipDuplicates: true` prevents duplicate target-season memberships.
- [x] Source-season `RosterMembership` records are not deleted or modified.
- [x] `Person.lifecycleStatus` is not changed by rollover.
- [x] `RoleAssignment` records are not deleted or modified.
- [x] `AthleteGuardianRelationship` records are not deleted or modified.
- [x] `AttendanceRecord` records are not deleted or modified.
- [x] `ObservationNote` records are not deleted or modified.
- [x] `FollowUpTask` records are not deleted or modified.
- [x] `GearAssignment` records are not deleted or modified.
- [x] `GearCheckout` records are not deleted or modified.
- [x] FieldOps booking references are not modified.

---

## 6. Redirect Behavior

- [x] Successful rollover redirects to `/programs/[programId]?rolloverSuccess=...`.
- [x] Program page displays green success banner when `rolloverSuccess` query param is present.
- [x] Validation or scoping errors redirect to rollover page with `?error=...`.
- [x] Permission denied error redirects to rollover page with error message.
- [x] Schema unavailable error redirects to rollover page with safe error message.

---

## 7. Existing Behavior Preservation

- [x] Join/create workflow remains unchanged.
- [x] Activate workflow remains unchanged.
- [x] Inactive workflow remains unchanged.
- [x] Archive workflow remains unchanged.
- [x] Move workflow remains unchanged.
- [x] Role assignment behavior remains unchanged.
- [x] Guardian relationship behavior remains unchanged.
- [x] FieldOps behavior remains unchanged.
- [x] GearOps behavior remains unchanged.

---

## 8. Automated Validation

### Lint
```
npm run lint
```
Expected: No errors.

### Typecheck
```
npm run typecheck
```
Expected: No errors.

### Build
```
npm run build
```
Expected: Successful build. Routes include `/programs/[programId]/seasons/[seasonId]/rollover` and `/programs/[programId]/seasons/[seasonId]/rollover/execute`.

### Prisma Validate
```
DATABASE_URL=<connection_string> ./node_modules/.bin/prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid 🚀`

---

## 9. Manual Verification

### Open rollover page — valid season
- [ ] Open `/programs/[programId]`.
- [ ] Confirm **Rollover** link is visible next to each season.
- [ ] Click **Rollover** link for a season.
- [ ] Rollover page loads with source season context shown.
- [ ] Target season dropdown shows all other seasons in the same program.
- [ ] Include Inactive checkbox is visible and unchecked by default.
- [ ] Eligible members list shows non-ARCHIVED, non-INACTIVE members from source season.
- [ ] Confirmation form shows execute button and cancel link.

### Preview with Include Inactive
- [ ] Check the Include Inactive checkbox on the rollover page.
- [ ] Click "Refresh preview".
- [ ] Eligible members list now includes INACTIVE members (if any exist).
- [ ] ARCHIVED members remain excluded from the list.

### Execute rollover — default filters
- [ ] Select a valid target season.
- [ ] Leave Include Inactive unchecked.
- [ ] Click "Execute rollover".
- [ ] Redirects to `/programs/[programId]?rolloverSuccess=...`.
- [ ] Green success banner shows on program page.
- [ ] Source-season roster memberships are unchanged.
- [ ] Target-season roster memberships are created for all non-ARCHIVED, non-INACTIVE members.
- [ ] Person lifecycle statuses are unchanged.

### Execute rollover — with Include Inactive
- [ ] Select a valid target season.
- [ ] Check Include Inactive.
- [ ] Click "Execute rollover".
- [ ] Target-season memberships include INACTIVE persons.
- [ ] ARCHIVED persons remain excluded.

### Execute rollover — idempotency (duplicate skip)
- [ ] Execute rollover a second time with the same source/target season.
- [ ] Rollover succeeds without error (duplicates are skipped).
- [ ] No duplicate memberships created in target season.

### Execute rollover — same season (blocked)
- [ ] Manually POST with `targetSeasonId` = source season ID.
- [ ] Error redirect with "Source and target season must be different."

### Execute rollover — invalid target season (blocked)
- [ ] Manually POST with an invalid or other-program `targetSeasonId`.
- [ ] Error redirect with "Target season not found in the selected organization and program."

### Rollover page — invalid source season ID
- [ ] Navigate to `/programs/[programId]/seasons/invalid-id/rollover`.
- [ ] Not-found message shown with back link to program.

### No target seasons available
- [ ] Navigate to rollover page for a program with only one season.
- [ ] Message shown that no other seasons exist.
- [ ] Confirmation form is not shown.
- [ ] Back to program link is shown.

### Unauthorized access
- [ ] User without staff role attempts to view rollover page.
- [ ] Access denied message shown.
- [ ] No rollover form visible.

---

## 10. Arc 17F Closeout Sign-off

- [ ] Automated validation passes (lint, typecheck, build, prisma validate).
- [ ] Scope constraints are met (no deferred/out-of-scope features introduced).
- [ ] Planning documentation created: `PHASE_17F_SEASON_ROLLOVER_WORKFLOW.md`.
- [ ] Validation checklist created: `PHASE_17F_VALIDATION_CHECKLIST.md`.
- [ ] `planning/README.md` updated with Arc 17F entries.
- [ ] PR submitted for review.
