# Phase 17D Validation Checklist

## Purpose

Confirms Arc 17D (Team and Program Move Workflow) is implemented correctly, preserves existing behavior, and stays within Arc 17 scope boundaries.

---

## 1. Scope Compliance

- [x] Move workflow route is added at `/people/[personId]/move`.
- [x] Move action route is added at `POST /people/[personId]/move/update`.
- [x] Person detail shows move workflow entry point(s) for staff.
- [x] Existing roster membership visibility on person detail is preserved.
- [x] Lifecycle status is preserved (no activate/inactive/archive mutation in move flow).
- [x] No inactive/archive workflows added.
- [x] No season rollover workflows added.
- [x] No guardian maintenance workflows added.
- [x] No reporting pages added.
- [x] No messaging/notification workflows added.
- [x] No parent portal behavior added.
- [x] No payments/dues/billing added.
- [x] FieldOps behavior is unchanged.
- [x] GearOps behavior is unchanged.
- [x] Prisma schema is unchanged in Arc 17D.

---

## 2. Authorization

- [x] `person.move` action is defined in `lib/permissions/index.ts`.
- [x] `person.move` is granted to `ORGANIZATION_ADMIN` and `PROGRAM_DIRECTOR`.
- [x] `COACH`, `ASSISTANT_COACH`, `ATHLETE`, and `PARENT_GUARDIAN` do not have `person.move`.
- [x] Move action route uses `requirePhase1CMutationPermission` with action `person.move`.
- [x] Existing permissions (`person.create`, `person.activate`, role/roster actions) remain unchanged.

---

## 3. Organization Scoping and Validation

- [x] Move workflow validates person belongs to current organization.
- [x] Move workflow validates selected program belongs to current organization.
- [x] Move workflow validates selected team belongs to current organization.
- [x] Move workflow validates selected season belongs to current organization.
- [x] Move workflow validates selected team belongs to selected program.
- [x] Move workflow validates selected season belongs to selected program.
- [x] Optional source membership validation ensures membership belongs to selected person + organization.
- [x] Invalid IDs return clear field/general error states.

---

## 4. Membership Transition Safety

- [x] Move workflow updates roster membership context (no unrelated person-field mutation).
- [x] Existing membership history is not destructively deleted.
- [x] Duplicate target membership is prevented (`teamId + seasonId + personId`).
- [x] Practical same-program/same-season duplicate guard is enforced when creating new membership context.
- [x] In-season clean transition path is supported by in-place membership update when source membership is selected.

---

## 5. Existing Behavior Preservation

- [x] Join/create workflow remains unchanged.
- [x] Activate workflow remains unchanged.
- [x] Role assignment behavior remains unchanged.
- [x] Guardian relationship behavior remains unchanged.
- [x] FieldOps behavior remains unchanged.
- [x] GearOps behavior remains unchanged.

---

## 6. Automated Validation

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
Expected: Successful build and routes include `/people/[personId]/move`.

### Prisma Validate
```
DATABASE_URL=<connection_string> ./node_modules/.bin/prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid 🚀`

---

## 7. Manual Verification

### Successful move
- [ ] Open `/people/[personId]/move` from person detail.
- [ ] Select target program/team/season/role.
- [ ] Submit.
- [ ] Redirects to `/people/[personId]`.
- [ ] Success message is shown.
- [ ] Roster memberships reflect the selected target context.

### Invalid team-program pair
- [ ] Submit with team not belonging to selected program.
- [ ] Error shown: team/program mismatch.

### Invalid person/program/team/season IDs
- [ ] Submit invalid IDs directly.
- [ ] Route returns safe redirect with clear errors.

### Duplicate prevention
- [ ] Attempt move to existing team+season membership.
- [ ] Duplicate membership is blocked with clear error.

### Lifecycle preservation
- [ ] Confirm `Person.lifecycleStatus` remains unchanged after move.

---

## 8. Arc 17D Closeout Sign-off

- [ ] Automated validation passes (lint, typecheck, build, prisma validate).
- [ ] Scope constraints are met (no deferred/out-of-scope features introduced).
- [ ] Planning documentation created: `PHASE_17D_TEAM_PROGRAM_MOVE_WORKFLOW.md`.
- [ ] Validation checklist created: `PHASE_17D_VALIDATION_CHECKLIST.md`.
- [ ] `planning/README.md` updated with Arc 17D entries.
- [ ] PR submitted for review.
