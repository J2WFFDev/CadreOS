# Phase 17E — Inactive and Archive Member Workflow

## Goal

Add controlled staff-scoped inactive and archive workflows so an operator can mark a member/person as INACTIVE or ARCHIVED while preserving roster history, lifecycle status integrity, guardian relationships, role assignments, FieldOps, and GearOps behavior.

## Scope

- Add staff-only inactive/archive action entry points on person detail.
- Add inactive action route: `POST /people/[personId]/inactive`.
- Add archive action route: `POST /people/[personId]/archive`.
- Add `person.deactivate` and `person.archive` permission actions.
- Reuse existing organization scoping and authorization patterns.
- Validate person belongs to current organization server-side.
- Validate requested lifecycle status transition server-side.
- Preserve existing activate and move entry points.
- Preserve roster membership history without destructive deletion.
- Do not delete role assignments, guardian relationships, attendance, notes, tasks, FieldOps, or GearOps records.
- Preserve join/activate behavior.
- Preserve team/program move behavior.

## Authorization

### New permission actions

- `person.deactivate` — marks a person INACTIVE.
- `person.archive` — marks a person ARCHIVED.

Both actions are granted to:
- `ORGANIZATION_ADMIN`
- `PROGRAM_DIRECTOR`
- `COACH`

Both actions are not granted to:
- `ASSISTANT_COACH`
- `ATHLETE`
- `PARENT_GUARDIAN`

### Runtime enforcement

- Inactive route uses `requirePhase1CMutationPermission` with action `person.deactivate`.
- Archive route uses `requirePhase1CMutationPermission` with action `person.archive`.
- Both new actions follow the same non-scoped pattern as `person.activate` (require ORGANIZATION scope role assignment for the permitted role types).
- Existing permissions (`person.create`, `person.update`, `person.activate`, `person.move`) remain unchanged.

## Lifecycle Transition Rules

### INACTIVE transition

Allowed from:
- `ACTIVE` → `INACTIVE`
- `PROSPECT` → `INACTIVE`
- `ALUMNI` → `INACTIVE`

Not allowed from:
- `INACTIVE` (already inactive)
- `ARCHIVED` (use archive directly)

### ARCHIVED transition

Allowed from:
- `ACTIVE` → `ARCHIVED`
- `PROSPECT` → `ARCHIVED`
- `INACTIVE` → `ARCHIVED`
- `ALUMNI` → `ARCHIVED`

Not allowed from:
- `ARCHIVED` (already archived)

## Workflow Surfaces

### Person detail (`/people/[personId]`)

**Lifecycle status card changes:**

- Added `lifecycleError` query param support (shown as red error message below activate error).
- Added ARCHIVED status color: red label (distinct from green Active, blue Prospect, zinc others).
- Added **Mark as inactive** button (shown for ACTIVE, PROSPECT, and ALUMNI persons).
  - Form confirmation: `confirm=1` hidden field.
  - Confirmation note: "Marking as inactive will change this person's status to Inactive. Roster history, roles, guardian relationships, and all operational records are preserved."
- Added **Archive member** button (shown for all non-ARCHIVED persons).
  - Form confirmation: `confirm=1` hidden field.
  - Visual distinction: red border and red text to indicate a significant action.
  - Confirmation note: "Archiving will change this person's status to Archived. Roster history, notes, tasks, attendance, gear records, and all operational history are preserved without deletion."
- Existing **Activate member** button (PROSPECT, INACTIVE, ALUMNI) is unchanged.
- Existing **Change team/program** button is unchanged.
- Existing **Edit person** button is unchanged.

## Route Behavior

### POST `/people/[personId]/inactive`

- Validates `confirm=1` via `memberLifecycleInactiveSchema`.
- Requires `person.deactivate` permission via `requirePhase1CMutationPermission`.
- Validates person exists in current organization.
- Validates current `lifecycleStatus` is one of `ACTIVE`, `PROSPECT`, or `ALUMNI`.
- Updates `lifecycleStatus` to `INACTIVE`.
- Redirects to `/people/[personId]` on success.
- Redirects to `/people/[personId]?lifecycleError=...` on failure.
- Does not delete or modify role assignments, roster memberships, guardian relationships, notes, tasks, attendance, FieldOps, or GearOps records.

### POST `/people/[personId]/archive`

- Validates `confirm=1` via `memberLifecycleArchiveSchema`.
- Requires `person.archive` permission via `requirePhase1CMutationPermission`.
- Validates person exists in current organization.
- Validates current `lifecycleStatus` is one of `ACTIVE`, `PROSPECT`, `INACTIVE`, or `ALUMNI`.
- Updates `lifecycleStatus` to `ARCHIVED`.
- Redirects to `/people/[personId]` on success.
- Redirects to `/people/[personId]?lifecycleError=...` on failure.
- Does not delete or modify role assignments, roster memberships, guardian relationships, notes, tasks, attendance, FieldOps, or GearOps records.

## Implementation

### lib/permissions/index.ts

- Added `"person.deactivate"` and `"person.archive"` to the `SupportedAction` union type.
- Added `"person.deactivate"` and `"person.archive"` to `ORGANIZATION_ADMIN`, `PROGRAM_DIRECTOR`, and `COACH` role action sets.
- Added `"person.deactivate"` and `"person.archive"` to `SUPPORTED_ACTIONS`.
- `SCOPED_ACTIONS` is not modified (both new actions use non-scoped, org-level role checks, same as `person.activate`).

### lib/workflows/index.ts

- Added `memberLifecycleInactiveSchema`: validates `confirm=1` for deactivation intent.
- Added `memberLifecycleArchiveSchema`: validates `confirm=1` for archive intent.
- Added `"person.deactivate"` and `"person.archive"` to the `requirePhase1CMutationPermission` action union.

### app/(dashboard)/people/[personId]/inactive/route.ts (NEW)

- POST handler for `person.deactivate` workflow.
- Organization-scoped person lookup before update.
- Guards against marking INACTIVE persons inactive again or ARCHIVED persons inactive.
- Uses `db.person.update` with org-scoped where clause.
- Error redirect uses `lifecycleError` query param.

### app/(dashboard)/people/[personId]/archive/route.ts (NEW)

- POST handler for `person.archive` workflow.
- Organization-scoped person lookup before update.
- Guards against archiving already-ARCHIVED persons.
- Uses `db.person.update` with org-scoped where clause.
- Error redirect uses `lifecycleError` query param.

### app/(dashboard)/people/[personId]/page.tsx

- Added `lifecycleError` search param read.
- Added ARCHIVED lifecycle status color (red).
- Added `lifecycleError` display block in the lifecycle card.
- Added **Mark as inactive** form for ACTIVE/PROSPECT/ALUMNI persons.
- Added **Archive member** form for all non-ARCHIVED persons.
- Existing **Activate member** form, **Edit person** link, and **Change team/program** link are unchanged.

## Referential Safety

All historical data is preserved on inactive/archive transition:

| Record type | Behavior on lifecycle change |
|---|---|
| `RosterMembership` | Preserved without modification |
| `RoleAssignment` | Preserved without modification |
| `AthleteGuardianRelationship` | Preserved without modification |
| `AttendanceRecord` | Preserved without modification |
| `ObservationNote` | Preserved without modification; STAFF_ONLY visibility unchanged |
| `FollowUpTask` | Preserved without modification |
| `GearAssignment` | Preserved without modification |
| `GearCheckout` | Preserved without modification |
| FieldOps booking references | Preserved without modification |

No cascade operations are triggered. No records are deleted. No records are modified except `Person.lifecycleStatus`.

## Backward Compatibility

- Existing `personWorkflowSchema` and `joinPersonWorkflowSchema` are unchanged.
- Existing `memberLifecycleActivateSchema` is unchanged.
- Existing `memberMoveWorkflowSchema` is unchanged.
- Activate workflow remains unchanged.
- Move workflow remains unchanged.
- Role assignment behavior is unchanged.
- Guardian relationship behavior is unchanged.
- No Prisma schema changes in Arc 17E.
- No FieldOps or GearOps behavior changes in Arc 17E.

## Deferred (Not in 17E)

- Season rollover workflows
- Guardian relationship maintenance workflows
- Roster readiness dashboards
- Reporting, messaging, and communications
- Parent portal behavior
- Payments/dues/billing
- Re-invite or reinstate-from-archive workflows (deferred to later Arc 17 phases)

## Arc 17E Output Summary

Arc 17E introduces staff-scoped inactive and archive lifecycle workflows with organization-safe validation and scoped authorization. Staff with `person.deactivate` permission (ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, COACH) can mark ACTIVE, PROSPECT, or ALUMNI persons as INACTIVE. Staff with `person.archive` permission (ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, COACH) can archive any non-ARCHIVED person. Both workflows use confirmation forms, preserve all historical records, and display clear status context and error states. All existing join, activate, and move behavior is preserved.
