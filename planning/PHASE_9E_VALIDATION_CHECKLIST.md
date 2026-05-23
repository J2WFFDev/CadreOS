# Phase 9E — Manual Validation Checklist

This project does not have an automated test framework. This checklist defines the manual validation steps that must be performed to confirm Phase 9E changes are correct and safe.

> **No automated test framework was introduced in this phase.** If an automated test framework is added in a future phase, the cases in this checklist should be converted to unit tests covering `lib/authorization/index.ts`.

---

## Pre-validation setup

- [ ] A working local or staging deployment with a seeded database is required.
- [ ] The database must contain at least one organization with:
  - At least one staff person with a role assignment (e.g., ORGANIZATION_ADMIN or COACH).
  - At least one non-staff person (a person with PARENT_GUARDIAN or ATHLETE role, or a person with a UserAccount but no role assignment).
  - At least one ObservationNote.
  - At least one FollowUpTask.

---

## 1. Build validation

- [ ] `npm run typecheck` exits with zero errors.
- [ ] `npm run lint` exits with zero warnings.
- [ ] `npm run build` completes without errors.
- [ ] `DATABASE_URL=... ./node_modules/.bin/prisma validate` passes.

---

## 2. Staff user — notes read path

Perform these steps as a user whose Clerk account is linked to a Person that holds a staff role assignment (ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, COACH, or ASSISTANT_COACH):

- [ ] Navigate to `/notes`. The notes list loads normally with all expected notes visible.
- [ ] Notes count and content match what was visible before the Phase 9E change.
- [ ] Filter controls (team, athlete, author, guardian context) work correctly.
- [ ] Individual note links navigate to note detail pages correctly.
- [ ] No "You do not have staff access" message is shown.

---

## 3. Staff user — tasks read path

Perform these steps as a staff user (same as section 2):

- [ ] Navigate to `/tasks`. The tasks list loads normally.
- [ ] Task filters (status, assignee, team, due window, etc.) work correctly.
- [ ] Individual task links navigate to task detail pages correctly.
- [ ] No "You do not have staff access" message is shown.

---

## 4. Non-staff or unlinked user — notes read path

Perform these steps as a user whose Clerk account either:
  - Has a linked Person with only PARENT_GUARDIAN or ATHLETE role, OR
  - Has a UserAccount with no linked Person (personId = null):

- [ ] Navigate to `/notes`. The page renders with the message:
  > "You do not have staff access to view notes. All notes require a staff role assignment."
- [ ] No note records are returned to the browser (confirm via browser dev tools network tab if possible).
- [ ] Confirm no ObservationNote data leaks through the response.

---

## 5. Non-staff or unlinked user — tasks read path

Same setup as section 4:

- [ ] Navigate to `/tasks`. The page renders with the message:
  > "You do not have staff access to view tasks. All tasks require a staff role assignment."
- [ ] No task records are returned.

---

## 6. Organization scoping — unchanged

Perform these steps to confirm organization scoping remains intact:

- [ ] A staff user in Organization A cannot see notes belonging to Organization B (organization scope is enforced by `organizationId` filter in the Prisma query; this is not changed in Phase 9E).
- [ ] A staff user in Organization A cannot see tasks belonging to Organization B.

---

## 7. `lib/authorization/index.ts` — unit-level manual review

These are logic checks that do not require a running deployment:

### `resolveActorRoleContext`

- [ ] When `actorPersonId = null`, the returned context has `isStaffMember = false`, `isOrganizationAdmin = false`, and `staffRoleAssignments = []`.
- [ ] When the actor holds ORGANIZATION_ADMIN at ORGANIZATION scope, `isOrganizationAdmin = true` and `isStaffMember = true`.
- [ ] When the actor holds only COACH at TEAM scope, `isOrganizationAdmin = false` and `isStaffMember = true`.
- [ ] When the actor holds only PARENT_GUARDIAN (non-staff role), `isStaffMember = false` (the Prisma query filters to staff role types only).
- [ ] When the actor holds ATHLETE only, `isStaffMember = false`.

### `canReadStaffOnlyContent`

- [ ] Returns `true` for context with `isStaffMember = true`.
- [ ] Returns `false` for context with `isStaffMember = false`.

### `canReadTeamScopedContent`

- [ ] Returns `false` for non-staff context, regardless of `teamId`.
- [ ] Returns `true` for any staff context when `teamId = null` (org-level record).
- [ ] Returns `true` for org admin context with any `teamId`.
- [ ] Returns `true` for ORGANIZATION scope staff assignment with any `teamId`.
- [ ] Returns `true` for TEAM scope assignment when `assignment.teamId === teamId`.
- [ ] Returns `false` for TEAM scope assignment when `assignment.teamId !== teamId` and actor has no other encompassing assignment.
- [ ] Returns `true` for PROGRAM scope assignment (conservative: team-to-program mapping not verified at this layer).

### `canAccessFollowUpTask`

- [ ] Returns `true` for staff context regardless of task assignee/creator.
- [ ] Returns `false` for non-staff context with `actorPersonId = null`.
- [ ] Returns `true` for non-staff context where `actorPersonId === task.assigneePersonId`.
- [ ] Returns `true` for non-staff context where `actorPersonId === task.createdByPersonId`.
- [ ] Returns `false` for non-staff context where `actorPersonId` matches neither.

### `assertStaffAccess`

- [ ] Throws `AuthorizationDeniedError` when `actorPersonId = null`.
- [ ] Throws `AuthorizationDeniedError` when `isStaffMember = false`.
- [ ] Does not throw when `isStaffMember = true`.

### `assertOrganizationAdminAccess`

- [ ] Throws `AuthorizationDeniedError` when `actorPersonId = null`.
- [ ] Throws `AuthorizationDeniedError` when `isOrganizationAdmin = false` (even if `isStaffMember = true`).
- [ ] Does not throw when `isOrganizationAdmin = true`.

---

## 8. Regression — existing write workflows

- [ ] Create an ObservationNote as a staff user. The note appears in the notes list.
- [ ] Create a FollowUpTask from a note as a staff user. The task appears in the task list.
- [ ] Edit an existing ObservationNote. Changes are saved and reflected in the note detail.
- [ ] Edit an existing FollowUpTask status. Status change is saved and reflected in the task list.

---

## 9. Confirm no Entry/Feed/Inbox/Journal behavior added

- [ ] No `Entry` table or model exists in `prisma/schema.prisma`.
- [ ] No `/feed`, `/inbox`, `/journal` routes exist under `app/(dashboard)/`.
- [ ] No messaging or notification routes exist.
- [ ] `lib/authorization/index.ts` contains no references to `Entry`, `Feed`, `Inbox`, or `Journal`.

---

## 10. Confirm guardian access not changed

- [ ] Staff user navigating to a person detail page still sees guardian relationship diagnostic indicators (unchanged from Phase 8).
- [ ] `resolveGuardianRelationshipAccess` is still called for the guardian diagnostic panel in notes and tasks pages.
- [ ] No guardian-facing note or task read surface exists.

---

## Sign-off

| Check | Status |
|---|---|
| Build validation (typecheck, lint, build) | |
| Staff user notes/tasks access unchanged | |
| Non-staff access denied on notes/tasks | |
| Regression — write workflows functional | |
| No Entry/Feed/Inbox/Journal behavior added | |
| Guardian access unchanged | |
