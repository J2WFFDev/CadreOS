# Phase 17G — Guardian Relationship Maintenance Workflow

## Goal

Add controlled staff-scoped guardian relationship maintenance workflows so an operator can view, add, and update athlete/guardian relationships while preserving lifecycle status, roster history, role assignments, FieldOps, and GearOps behavior.

## Scope

- Add guardian relationship maintenance routes:
  - `GET /people/[personId]/guardians`
  - `GET /people/[personId]/guardians/new`
  - `POST /people/[personId]/guardians/create`
  - `GET /people/[personId]/guardians/[relationshipId]/edit`
  - `POST /people/[personId]/guardians/[relationshipId]/edit/update`
- Show guardian relationships clearly on person detail pages and in dedicated maintenance views.
- Show athlete relationships clearly where the person is a guardian.
- Preserve lifecycle workflows from 17C–17F (activate, move, inactive/archive, rollover).
- Preserve roster history and role assignment behavior.
- Preserve attendance, notes, tasks, FieldOps, and GearOps records.
- Keep parent/guardian portal behavior deferred.
- Keep messaging/notifications deferred.

## Authorization

### New permission actions

- `guardianRelationship.create`
- `guardianRelationship.update`

Granted to:
- `ORGANIZATION_ADMIN`
- `PROGRAM_DIRECTOR`

Not granted to:
- `COACH`
- `ASSISTANT_COACH`
- `ATHLETE`
- `PARENT_GUARDIAN`

### Runtime enforcement

- Write routes use `requirePhase1CMutationPermission`.
- Relationship writes are organization-scoped and deny cross-organization references.
- Display routes continue to use existing staff-only and scoped operational visibility helpers.

## Guardian Maintenance Behavior

### Visibility

- Person detail page keeps lifecycle, roster, role, and operational summary visibility intact.
- Person detail page now links directly to guardian relationship maintenance routes.
- Relationships are shown in both directions:
  - Person as athlete/member → linked guardians
  - Person as guardian → linked athletes
- Relationship type is shown for each relationship.
- Safe empty states are shown when no links exist.
- Primary/emergency flags and contact-permission notes are explicitly marked as deferred (not modeled yet).

### Create

- Validates person (athlete/member target) belongs to current organization.
- Validates selected guardian person belongs to current organization.
- Blocks self-relationship (`athletePersonId === guardianPersonId`).
- Blocks duplicate existing pair relationships where practical.
- Redirects safely to maintenance page on success with success message.
- Redirects back to form with field/general errors on validation failure.

### Update

- Validates relationship ID exists for the selected person in current organization.
- Validates selected guardian person belongs to current organization.
- Blocks self-relationship.
- Blocks duplicate existing pair relationships where practical.
- Redirects safely to maintenance page on success with success message.
- Redirects back to edit form with clear field/general errors on failure.

## Referential and Lifecycle Safety

Arc 17G guardian relationship maintenance updates only `AthleteGuardianRelationship` rows. It does not:

- change `Person.lifecycleStatus`
- create, delete, or rewrite historical `RosterMembership` records
- modify `RoleAssignment` records
- modify `AttendanceRecord`, `ObservationNote`, or `FollowUpTask` records
- modify FieldOps booking behavior
- modify GearOps inventory/assignment/checkout behavior

## Backward Compatibility

- Existing join, activate, move, inactive/archive, and rollover workflows remain unchanged.
- Existing organization context and authorization helper patterns remain in place.
- No Prisma schema expansion is required for Arc 17G.

## Deferred (Not in 17G)

- Parent/guardian portal behavior
- Messaging/notifications/communications
- Payments/dues/billing
- Reporting pages or lifecycle analytics
- External integrations
- Primary/emergency/contact-permission modeling on guardian relationship records

## Arc 17G Output Summary

Arc 17G introduces staff-scoped guardian relationship maintenance routes for viewing, creating, and updating athlete/guardian relationships with organization-safe validation and permission checks. The implementation blocks cross-organization references, self-relationships, and practical duplicates while preserving lifecycle status, roster history, role assignments, and all existing FieldOps/GearOps behavior.
