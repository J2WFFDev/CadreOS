# Phase 17G Validation Checklist

## Purpose

Confirm Arc 17G guardian relationship maintenance workflows are implemented correctly, preserve existing behavior, and stay within Arc 17 boundaries.

---

## 1. Scope Compliance

- [x] Guardian maintenance page added at `GET /people/[personId]/guardians`.
- [x] Guardian create form page added at `GET /people/[personId]/guardians/new`.
- [x] Guardian create route added at `POST /people/[personId]/guardians/create`.
- [x] Guardian edit form page added at `GET /people/[personId]/guardians/[relationshipId]/edit`.
- [x] Guardian update route added at `POST /people/[personId]/guardians/[relationshipId]/edit/update`.
- [x] Person detail page shows clear guardian/athlete relationship visibility and maintenance entry point.
- [x] Person detail page continues to preserve lifecycle/roster/move/inactive/archive/rollover visibility.
- [x] No reporting pages added.
- [x] No messaging/notification workflows added.
- [x] No parent portal behavior added.
- [x] No payments/dues/billing behavior added.
- [x] No external integrations added.
- [x] No Prisma schema expansion was required.

---

## 2. Authorization

- [x] `guardianRelationship.create` action is defined in `lib/permissions/index.ts`.
- [x] `guardianRelationship.update` action is defined in `lib/permissions/index.ts`.
- [x] Both actions are granted to `ORGANIZATION_ADMIN`.
- [x] Both actions are granted to `PROGRAM_DIRECTOR`.
- [x] Both actions are NOT granted to `COACH`, `ASSISTANT_COACH`, `ATHLETE`, or `PARENT_GUARDIAN`.
- [x] Create route enforces permission through `requirePhase1CMutationPermission`.
- [x] Update route enforces permission through `requirePhase1CMutationPermission`.
- [x] Existing lifecycle and roster permission actions remain unchanged.

---

## 3. Organization Scoping and Validation

- [x] Person (athlete/member target) is validated in current organization for create/update.
- [x] Guardian person is validated in current organization for create/update.
- [x] Relationship ID is validated in current organization and person context for edit/update.
- [x] Cross-organization person/guardian/relationship references are blocked.
- [x] Invalid person/guardian/relationship IDs produce clear and safe error states.

---

## 4. Guardian Relationship Safety Rules

- [x] Self-relationship is blocked.
- [x] Duplicate active guardian relationship rows are blocked where practical.
- [x] Create route preserves existing relationships without destructive updates.
- [x] Update route preserves all unrelated relationship records.
- [x] Safe cancel/back links are present on new/edit pages.
- [x] Safe redirect on create/update success routes to `/people/[personId]/guardians`.

---

## 5. Lifecycle and Operational Preservation

- [x] `Person.lifecycleStatus` is not changed in guardian maintenance routes.
- [x] `RosterMembership` history is not deleted or modified.
- [x] `RoleAssignment` records are not deleted or modified.
- [x] `AttendanceRecord` records are not deleted or modified.
- [x] `ObservationNote` records are not deleted or modified.
- [x] `FollowUpTask` records are not deleted or modified.
- [x] FieldOps behavior remains unchanged.
- [x] GearOps behavior remains unchanged.

---

## 6. Automated Validation

### Lint
```bash
npm run lint
```
Expected: No errors.

### Typecheck
```bash
npm run typecheck
```
Expected: No errors.

### Build
```bash
npm run build
```
Expected: Successful build, including new guardian maintenance routes.

### Prisma Validate
```bash
DATABASE_URL=<connection_string> ./node_modules/.bin/prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid 🚀`

---

## 7. Manual Verification

### Person detail visibility
- [ ] Open `/people/[personId]`.
- [ ] Confirm guardian relationship section clearly shows:
  - [ ] as athlete/member relationships
  - [ ] as guardian relationships
  - [ ] relationship type per link
  - [ ] safe empty state when no links exist
- [ ] Confirm link to `/people/[personId]/guardians` is present.

### Open maintenance page
- [ ] Open `/people/[personId]/guardians`.
- [ ] Confirm both relationship directions are shown with clear labels.
- [ ] Confirm no parent portal/messaging behavior appears.

### Create relationship
- [ ] Open `/people/[personId]/guardians/new`.
- [ ] Select guardian and relationship type.
- [ ] Submit create.
- [ ] Confirm redirect to `/people/[personId]/guardians?guardianSuccess=...`.
- [ ] Confirm new relationship appears in list and person detail.

### Update relationship
- [ ] Open `/people/[personId]/guardians/[relationshipId]/edit`.
- [ ] Change guardian and/or relationship type.
- [ ] Submit update.
- [ ] Confirm redirect to `/people/[personId]/guardians?guardianSuccess=...`.
- [ ] Confirm updated relationship is shown.

### Invalid ID handling
- [ ] Navigate to invalid person ID guardian route.
- [ ] Confirm safe not-found state.
- [ ] Navigate to invalid relationship ID edit route.
- [ ] Confirm clear invalid relationship state.

### Safety checks
- [ ] Attempt self-relationship create.
- [ ] Confirm blocked with clear error.
- [ ] Attempt duplicate create/update.
- [ ] Confirm blocked with clear error.

---

## 8. Arc 17G Closeout Sign-off

- [ ] Automated validation passes (`lint`, `typecheck`, `build`, `prisma validate`).
- [ ] Arc 17G scope constraints are met.
- [ ] Planning documentation created: `PHASE_17G_GUARDIAN_RELATIONSHIP_MAINTENANCE.md`.
- [ ] Validation checklist created: `PHASE_17G_VALIDATION_CHECKLIST.md`.
- [ ] `planning/README.md` updated with Arc 17G entries.
- [ ] PR submitted for review.
