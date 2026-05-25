# Phase 17E Validation Checklist

## Purpose

Confirms Arc 17E (Inactive and Archive Member Workflow) is implemented correctly, preserves existing behavior, and stays within Arc 17 scope boundaries.

---

## 1. Scope Compliance

- [x] Inactive action route is added at `POST /people/[personId]/inactive`.
- [x] Archive action route is added at `POST /people/[personId]/archive`.
- [x] Person detail shows inactive and archive workflow entry points for staff.
- [x] Existing activate and move entry points are preserved.
- [x] Existing roster membership visibility on person detail is preserved.
- [x] No inactive/archive workflows destructively delete records.
- [x] No season rollover workflows added.
- [x] No guardian maintenance workflows added.
- [x] No reporting pages added.
- [x] No messaging/notification workflows added.
- [x] No parent portal behavior added.
- [x] No payments/dues/billing added.
- [x] FieldOps behavior is unchanged.
- [x] GearOps behavior is unchanged.
- [x] Prisma schema is unchanged in Arc 17E.

---

## 2. Authorization

- [x] `person.deactivate` action is defined in `lib/permissions/index.ts`.
- [x] `person.archive` action is defined in `lib/permissions/index.ts`.
- [x] `person.deactivate` is granted to `ORGANIZATION_ADMIN`, `PROGRAM_DIRECTOR`, and `COACH`.
- [x] `person.archive` is granted to `ORGANIZATION_ADMIN`, `PROGRAM_DIRECTOR`, and `COACH`.
- [x] `ASSISTANT_COACH`, `ATHLETE`, and `PARENT_GUARDIAN` do not have `person.deactivate` or `person.archive`.
- [x] Inactive action route uses `requirePhase1CMutationPermission` with action `person.deactivate`.
- [x] Archive action route uses `requirePhase1CMutationPermission` with action `person.archive`.
- [x] Existing permissions (`person.create`, `person.update`, `person.activate`, `person.move`) remain unchanged.

---

## 3. Organization Scoping and Validation

- [x] Inactive workflow validates person belongs to current organization.
- [x] Archive workflow validates person belongs to current organization.
- [x] Inactive workflow validates lifecycle transition before updating.
- [x] Archive workflow validates lifecycle transition before updating.
- [x] Invalid person IDs return safe redirect with `lifecycleError` query param.
- [x] Invalid status transitions return safe redirect with clear error message.

---

## 4. Lifecycle Transition Safety

- [x] ACTIVE → INACTIVE is allowed.
- [x] PROSPECT → INACTIVE is allowed.
- [x] ALUMNI → INACTIVE is allowed.
- [x] INACTIVE → INACTIVE is blocked with error.
- [x] ARCHIVED → INACTIVE is blocked with error.
- [x] ACTIVE → ARCHIVED is allowed.
- [x] PROSPECT → ARCHIVED is allowed.
- [x] INACTIVE → ARCHIVED is allowed.
- [x] ALUMNI → ARCHIVED is allowed.
- [x] ARCHIVED → ARCHIVED is blocked with error.

---

## 5. Referential Safety (Data Preservation)

- [x] `RosterMembership` records are not deleted or modified.
- [x] `RoleAssignment` records are not deleted or modified.
- [x] `AthleteGuardianRelationship` records are not deleted or modified.
- [x] `AttendanceRecord` records are not deleted or modified.
- [x] `ObservationNote` records are not deleted or modified.
- [x] `FollowUpTask` records are not deleted or modified.
- [x] `GearAssignment` records are not deleted or modified.
- [x] `GearCheckout` records are not deleted or modified.
- [x] FieldOps booking references are not modified.

---

## 6. Existing Behavior Preservation

- [x] Join/create workflow remains unchanged.
- [x] Activate workflow remains unchanged.
- [x] Move workflow remains unchanged.
- [x] Role assignment behavior remains unchanged.
- [x] Guardian relationship behavior remains unchanged.
- [x] FieldOps behavior remains unchanged.
- [x] GearOps behavior remains unchanged.

---

## 7. Automated Validation

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
Expected: Successful build. Routes include `/people/[personId]/inactive` and `/people/[personId]/archive`.

### Prisma Validate
```
DATABASE_URL=<connection_string> ./node_modules/.bin/prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid 🚀`

---

## 8. Manual Verification

### Mark as inactive — ACTIVE person
- [ ] Open `/people/[personId]` for an ACTIVE person.
- [ ] Confirm "Mark as inactive" button is shown.
- [ ] Confirm "Archive member" button is shown.
- [ ] Confirm "Activate member" button is NOT shown.
- [ ] Submit "Mark as inactive".
- [ ] Redirects to `/people/[personId]`.
- [ ] Status label shows "Inactive".
- [ ] Roster memberships, roles, guardian relationships are unchanged.

### Mark as inactive — PROSPECT person
- [ ] Open `/people/[personId]` for a PROSPECT person.
- [ ] Confirm "Mark as inactive" button is shown.
- [ ] Confirm "Activate member" button is shown.
- [ ] Submit "Mark as inactive".
- [ ] Status label shows "Inactive".

### Mark as inactive — ALUMNI person
- [ ] Open `/people/[personId]` for an ALUMNI person.
- [ ] Confirm "Mark as inactive" button is shown.
- [ ] Submit "Mark as inactive".
- [ ] Status label shows "Inactive".

### Mark as inactive — INACTIVE person (blocked)
- [ ] Open `/people/[personId]` for an INACTIVE person.
- [ ] Confirm "Mark as inactive" button is NOT shown.
- [ ] Confirm "Activate member" button is shown.
- [ ] Confirm "Archive member" button is shown.
- [ ] POST directly to `/people/[personId]/inactive` with `confirm=1`.
- [ ] Error redirect with `lifecycleError` shown on person detail.

### Mark as inactive — ARCHIVED person (blocked)
- [ ] Open `/people/[personId]` for an ARCHIVED person.
- [ ] Confirm "Mark as inactive" button is NOT shown.
- [ ] Confirm "Archive member" button is NOT shown.
- [ ] Confirm "Activate member" button is NOT shown.
- [ ] POST directly to `/people/[personId]/inactive` with `confirm=1`.
- [ ] Error redirect with `lifecycleError` shown on person detail.

### Archive member — INACTIVE person
- [ ] Open `/people/[personId]` for an INACTIVE person.
- [ ] Confirm "Archive member" button is shown.
- [ ] Submit "Archive member".
- [ ] Status label shows "Archived" (in red).
- [ ] Roster memberships, roles, guardian relationships are unchanged.

### Archive member — ACTIVE person
- [ ] Open `/people/[personId]` for an ACTIVE person.
- [ ] Submit "Archive member".
- [ ] Status label shows "Archived".

### Archive member — ARCHIVED person (blocked)
- [ ] POST directly to `/people/[personId]/archive` with `confirm=1` for an ARCHIVED person.
- [ ] Error redirect with `lifecycleError` shown on person detail.

### Activate from INACTIVE
- [ ] Archive member, then attempt to activate.
- [ ] Confirm "Activate member" is not shown for ARCHIVED.
- [ ] Mark as inactive first, confirm "Activate member" appears.
- [ ] Activate. Status returns to Active.

### Invalid person ID
- [ ] POST to `/people/invalid-id/inactive` with `confirm=1`.
- [ ] Error redirect with `lifecycleError` shown.

---

## 9. Arc 17E Closeout Sign-off

- [ ] Automated validation passes (lint, typecheck, build, prisma validate).
- [ ] Scope constraints are met (no deferred/out-of-scope features introduced).
- [ ] Planning documentation created: `PHASE_17E_INACTIVE_ARCHIVE_MEMBER_WORKFLOW.md`.
- [ ] Validation checklist created: `PHASE_17E_VALIDATION_CHECKLIST.md`.
- [ ] `planning/README.md` updated with Arc 17E entries.
- [ ] PR submitted for review.
