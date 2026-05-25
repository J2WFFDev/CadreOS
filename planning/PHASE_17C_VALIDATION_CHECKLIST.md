# Phase 17C Validation Checklist

## Purpose

Confirms that Arc 17C (Join and Activate Member Workflow) is implemented correctly, does not break existing behavior, and meets the scope constraints defined in the problem statement.

---

## 1. Scope Compliance

- [x] Join workflow (person create with lifecycle status) is implemented.
- [x] Activate workflow (PROSPECT/INACTIVE/ALUMNI → ACTIVE) is implemented.
- [x] Lifecycle status is visible on the people list page.
- [x] Lifecycle status is visible on the person detail page.
- [x] Team/program move workflows are NOT added.
- [x] Inactive/archive workflows are NOT added.
- [x] Season rollover workflows are NOT added.
- [x] Guardian maintenance workflows are NOT added.
- [x] No reporting pages are added.
- [x] No messaging/notification workflows are added.
- [x] No parent portal behavior is added.
- [x] No payments/dues/billing is added.
- [x] FieldOps behavior is not modified.
- [x] GearOps behavior is not modified.
- [x] Prisma schema is not expanded beyond what is necessary for join/activate support (no schema changes in 17C; all schema support was added in 17B).

---

## 2. Authorization

- [x] `person.activate` permission action is defined in `lib/permissions/index.ts`.
- [x] `person.activate` is granted to ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, and COACH.
- [x] ASSISTANT_COACH, ATHLETE, and PARENT_GUARDIAN do NOT have `person.activate`.
- [x] `person.create` permission is unchanged.
- [x] Activate route uses `requirePhase1CMutationPermission` with `"person.activate"` action.
- [x] Create route uses `requirePhase1CMutationPermission` with `"person.create"` action (unchanged).

---

## 3. Organization Scoping

- [x] Person create always scoped to `scope.organizationId`.
- [x] Person activate lookup uses `{ id: personId, organizationId: scope.organizationId }` to prevent cross-org access.
- [x] Person activate update uses `{ id: personId, organizationId: scope.organizationId }` where clause.

---

## 4. Validation

- [x] `joinPersonWorkflowSchema` validates all person fields plus `lifecycleStatus` as a required `MemberLifecycleStatus` enum.
- [x] `memberLifecycleActivateSchema` validates `confirm=1` is present.
- [x] Invalid `lifecycleStatus` values are rejected with a field error.
- [x] Activate route guards against activating ACTIVE or ARCHIVED persons.
- [x] Activate route returns a user-visible error if the person is not found.

---

## 5. Existing Behavior Preservation

- [x] `personWorkflowSchema` export is unchanged.
- [x] Edit person workflow (`/people/[personId]/edit`) is unchanged.
- [x] Role assignment workflows are unchanged.
- [x] Roster membership workflows are unchanged.
- [x] Guardian relationship workflows are unchanged.
- [x] Activation does not modify roles, roster memberships, or guardian relationships.
- [x] People list page displays all existing columns plus the new Status column.
- [x] Person detail page displays all existing sections plus the new lifecycle status section.

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
Expected: No new errors introduced by Arc 17C changes (pre-existing module resolution errors from the test environment are unrelated).

### Build
```
npm run build
```
Expected: Successful build. Route `/people/[personId]/activate` appears in the route list.

### Prisma Validate
```
DATABASE_URL=<connection_string> ./node_modules/.bin/prisma validate
```
Expected: "The schema at prisma/schema.prisma is valid 🚀"

---

## 7. Manual Workflow Verification

### Join as Active
- [ ] Staff (org admin) navigates to `/people/new`.
- [ ] The form shows a **Member status** select defaulting to `Active`.
- [ ] Submitting with valid fields creates the person with `lifecycleStatus = ACTIVE`.
- [ ] Redirects to the person detail page.
- [ ] Person detail page shows **Member lifecycle status: Active** (green).
- [ ] No "Activate member" button is visible.

### Join as Prospect
- [ ] Staff selects `Prospect (pending activation)` from the Member status select.
- [ ] Submitting creates the person with `lifecycleStatus = PROSPECT`.
- [ ] Redirects to the person detail page.
- [ ] Person detail page shows **Member lifecycle status: Prospect** (blue).
- [ ] "Activate member" button is visible.

### Activate a Prospect
- [ ] Staff on the person detail page for a PROSPECT person clicks "Activate member".
- [ ] The form submits to `/people/[personId]/activate` with `confirm=1`.
- [ ] Page reloads showing **Member lifecycle status: Active** (green).
- [ ] "Activate member" button is no longer visible.
- [ ] Person's roles, roster memberships, and guardian relationships are unchanged.

### Attempt to Activate an Already-Active Person (Edge Case)
- [ ] Direct POST to `/people/[personId]/activate` for an ACTIVE person.
- [ ] Returns error: "This person cannot be activated from their current status (ACTIVE)."

### People List
- [ ] People list shows the **Status** column.
- [ ] Status values are correctly formatted (e.g., "Active", "Prospect", "Inactive").

---

## 8. Arc 17C Closeout Sign-off

- [ ] All automated validation passes (lint, typecheck, build, prisma validate).
- [ ] Scope constraints are met — no deferred workflows or out-of-scope features introduced.
- [ ] Planning documentation created: `PHASE_17C_JOIN_ACTIVATE_MEMBER_WORKFLOW.md`.
- [ ] Validation checklist created: `PHASE_17C_VALIDATION_CHECKLIST.md`.
- [ ] `planning/README.md` updated with Arc 17C entries.
- [ ] PR submitted for review.
