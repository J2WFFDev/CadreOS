# Phase 16E Validation Checklist: GearOps Assignment Workflows

## Build Validation

- [ ] `npm run lint` — no new lint errors
- [ ] `npm run typecheck` — no new TypeScript errors
- [ ] `npm run build` — build succeeds without errors
- [ ] `DATABASE_URL=... ./node_modules/.bin/prisma validate` — schema validation passes (schema unchanged)

---

## Permissions

- [ ] `gearAssignment.create` added to `SupportedAction` union in `lib/permissions/index.ts`
- [ ] `gearAssignment.update` added to `SupportedAction` union in `lib/permissions/index.ts`
- [ ] Both actions added to `ORGANIZATION_ADMIN` role set
- [ ] Both actions added to `PROGRAM_DIRECTOR` role set
- [ ] Both actions added to `COACH` role set
- [ ] Neither action added to `ASSISTANT_COACH`, `PARENT_GUARDIAN`, or `ATHLETE` role sets
- [ ] Neither action added to `SCOPED_ACTIONS` (org-scoped only)
- [ ] Both actions added to `SUPPORTED_ACTIONS`

---

## Workflow Schema

- [ ] `gearAssignmentWorkflowSchema` added to `lib/workflows/index.ts`
- [ ] `GearAssignmentWorkflowInput` type exported
- [ ] `GearAssignmentStatus` imported in workflows module
- [ ] `requirePhase1CMutationPermission` action union includes `gearAssignment.create` and `gearAssignment.update`
- [ ] `status` field validates against `GearAssignmentStatus` enum
- [ ] Exactly one assignment context is required across person/team/event
- [ ] `expectedReturnAt` validates YYYY-MM-DDTHH:mm pattern if provided
- [ ] `returnedAt` validates YYYY-MM-DDTHH:mm pattern if provided
- [ ] `notes` max 4000 characters
- [ ] All optional context fields transform to `null` when empty string

---

## Assign Form Page (`/gear-ops/items/[itemId]/assign`)

- [ ] Page renders correctly when item exists and user has staff access
- [ ] `resolveGearOpsReadAccess` is called and access denial is handled
- [ ] Displays item name and organization in the header
- [ ] Shows "Assign gear item" heading
- [ ] All dropdowns populated: persons, teams, events
- [ ] Status dropdown shows all `GearAssignmentStatus` values
- [ ] Form UI presents person/team/event selectors with a clear single-context expectation
- [ ] Form posts to `/gear-ops/items/[itemId]/assign/create`
- [ ] Cancel link navigates back to item detail
- [ ] Form pre-fills values from search params on validation error redirect
- [ ] General error message shown when `error` search param present
- [ ] Field-level error messages shown for each erroring field
- [ ] Not-found state shown with back link when item does not exist in scope
- [ ] Schema unavailable state handled with error message

---

## Create Assignment Route (`POST /gear-ops/items/[itemId]/assign/create`)

- [ ] Requires `gearAssignment.create` permission via `requirePhase1CMutationPermission`
- [ ] Returns 303 redirect to form with error when database not ready
- [ ] Returns 303 redirect to form with error when no organization context
- [ ] Returns 303 redirect to form with field errors when validation fails
- [ ] Verifies `gearItemId` belongs to the authenticated organization
- [ ] Cross-org guard for `assignedToPersonId` if provided
- [ ] Cross-org guard for `assignedToTeamId` if provided
- [ ] Cross-org guard for `assignedToEventId` if provided
- [ ] Resolves `assignedByPersonId` via `resolveActorPersonId`
- [ ] Returns error redirect if no actor person can be resolved
- [ ] Creates `GearAssignment` record with correct `organizationId` and `gearItemId`
- [ ] Redirects to `/gear-ops/items/[itemId]` on success
- [ ] Permission denied error surfaces actor-facing message
- [ ] Schema unavailable error surfaces appropriate message

---

## Edit Assignment Form Page (`/gear-ops/items/[itemId]/assignments/[assignmentId]/edit`)

- [ ] Page renders correctly when item and assignment exist and user has staff access
- [ ] `resolveGearOpsReadAccess` is called and access denial is handled
- [ ] Displays item name and assignment metadata in the header
- [ ] Shows "Edit assignment" heading
- [ ] All dropdowns populated: persons, teams, events
- [ ] Form pre-fills values from existing assignment record
- [ ] Form pre-fills values from search params when present (validation error redirect)
- [ ] Form posts to `/gear-ops/items/[itemId]/assignments/[assignmentId]/edit/update`
- [ ] Cancel link navigates back to item detail
- [ ] General error message shown when `error` search param present
- [ ] Field-level error messages shown for each erroring field
- [ ] Not-found state for item shown with back link to items list
- [ ] Not-found state for assignment shown with back link to item detail
- [ ] Schema unavailable state handled with error message

---

## Update Assignment Route (`POST /gear-ops/items/[itemId]/assignments/[assignmentId]/edit/update`)

- [ ] Requires `gearAssignment.update` permission via `requirePhase1CMutationPermission`
- [ ] Returns 303 redirect to form with error when database not ready
- [ ] Returns 303 redirect to form with error when no organization context
- [ ] Returns 303 redirect to form with field errors when validation fails
- [ ] Cross-org guard for `assignedToPersonId` if provided
- [ ] Cross-org guard for `assignedToTeamId` if provided
- [ ] Cross-org guard for `assignedToEventId` if provided
- [ ] Uses `updateMany` with `id + gearItemId + organizationId` filter to prevent cross-org writes
- [ ] Returns error redirect when `updated.count === 0` (assignment not found)
- [ ] Redirects to `/gear-ops/items/[itemId]` on success
- [ ] Permission denied error surfaces actor-facing message
- [ ] Schema unavailable error surfaces appropriate message
- [ ] `assignedByPersonId` is not modified on update

---

## Item Detail Page Enhancements

- [ ] "Assign gear" button visible in Assignments section header
- [ ] "Assign gear" button links to `/gear-ops/items/[itemId]/assign`
- [ ] "Edit" link visible on each assignment card
- [ ] "Edit" link navigates to correct `/gear-ops/items/[itemId]/assignments/[assignmentId]/edit`
- [ ] Current assignments and assignment history sections are both shown when assignments exist
- [ ] Assignment cards show labeled person/team/event/program context values when present
- [ ] Assignments section empty state remains safe when no assignments exist

---

## Preserved Behavior

- [ ] All Arc 16C read-only catalog routes still render correctly
- [ ] GearCategory create/edit routes (Arc 16D) still function correctly
- [ ] GearItem create/edit routes (Arc 16D) still function correctly
- [ ] All Core routes (people, teams, events, notes, tasks) unaffected
- [ ] All FieldOps routes unaffected
- [ ] Prisma schema is unchanged

---

## Planning Documentation

- [ ] `planning/PHASE_16E_GEAROPS_ASSIGNMENT_WORKFLOWS.md` created
- [ ] `planning/PHASE_16E_VALIDATION_CHECKLIST.md` created (this file)
- [ ] `planning/README.md` updated with Arc 16E entries under GearOps Phase Sequence section
