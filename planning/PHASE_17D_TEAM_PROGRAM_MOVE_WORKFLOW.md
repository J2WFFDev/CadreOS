# Phase 17D — Team and Program Move Workflow

## Goal

Add a controlled staff-scoped move workflow so an operator can move a member between team and/or program roster contexts without changing member lifecycle status or breaking existing operational behavior.

## Scope

- Add a staff-only move entry point from person detail.
- Add move workflow route: `/people/[personId]/move`.
- Add move action route: `POST /people/[personId]/move`.
- Reuse organization scoping and existing authorization patterns.
- Validate person, program, team, and season IDs are organization-scoped.
- Validate selected team belongs to selected program.
- Preserve `Person.lifecycleStatus`; no activate/inactive/archive changes in this phase.
- Preserve role assignment behavior.
- Preserve guardian relationship behavior.
- Preserve FieldOps and GearOps behavior.
- Avoid destructive deletion of prior membership history.
- Avoid duplicate active roster memberships where practical.

## Authorization

### New action

- Added `person.move` permission action.
- Granted to:
  - `ORGANIZATION_ADMIN`
  - `PROGRAM_DIRECTOR`
- Not granted to:
  - `COACH`
  - `ASSISTANT_COACH`
  - `ATHLETE`
  - `PARENT_GUARDIAN`

### Runtime enforcement

- Move route uses `requirePhase1CMutationPermission` with action `person.move`.
- Scope is resolved from selected program/team/season context.

## Workflow Surfaces

### Person detail (`/people/[personId]`)

- Existing roster membership visibility is preserved.
- Added staff-only move entry points:
  - Header action: **Change team/program**
  - Roster section action: **Move member**
- Added move success banner (`moveSuccess` query param).

### Move page (`/people/[personId]/move`)

- Shows current roster memberships for context.
- Provides move form fields:
  - current membership to transition (optional)
  - target program
  - target team
  - target season
  - target roster role
- Provides safe cancel/back link to person detail.
- Shows clear field/general error states from query params.

## Move Action Behavior

### Validations

- Person must exist in current organization.
- Program must exist in current organization.
- Team must exist in current organization.
- Season must exist in current organization.
- Team must belong to selected program.
- Season must belong to selected program.
- Optional source membership must belong to the same person and organization.

### Membership transition model

- If source membership is selected **and** target season is the same season:
  - update that membership in place (team/role change),
  - supports a clean transition without creating a second active row for that season context.
- Otherwise:
  - create a new roster membership in the target context.
- Prior memberships are not destructively deleted.
- Duplicate target membership (`teamId + seasonId + personId`) is blocked.
- Additional practical duplicate guard:
  - when creating new context (instead of in-place transition), if a same-program/same-season membership already exists, action is blocked and operator is asked to transition from the current membership instead.

## Backward Compatibility

- Join/create and activate workflows remain unchanged.
- Existing roster visibility remains in place.
- Existing role assignment routes and behavior remain unchanged.
- Existing guardian relationship visibility/behavior remains unchanged.
- No schema expansion in Arc 17D.
- No FieldOps/GearOps workflow changes in Arc 17D.

## Deferred (Not in 17D)

- Inactive/archive workflows.
- Season rollover workflows.
- Guardian maintenance workflows.
- Reporting pages.
- Messaging/notifications.
- Parent portal behavior.
- Payments/dues/billing.

## Arc 17D Output Summary

Arc 17D introduces a staff-scoped team/program move workflow with organization-safe validation and scoped authorization, adds person-detail move entry points, and transitions roster membership context without lifecycle-status mutation or destructive history deletion, while preserving existing role, guardian, FieldOps, and GearOps behavior.
