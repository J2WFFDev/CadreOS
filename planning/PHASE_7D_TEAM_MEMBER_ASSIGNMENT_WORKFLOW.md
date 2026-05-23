# Phase 7D — Team/Member Assignment Workflow

## Goal

Add a controlled Team/Member Management maintenance workflow so an authorized coach/admin can manage basic team membership and role assignments using the existing data model.

## Scope Guardrails Applied

- No FieldOps changes.
- No communications, messaging, or notifications.
- No payments, billing, fundraising, or sponsorship features.
- No mobile-native behavior.
- No major schema redesign or new major dependencies.
- No guardian onboarding added.
- No broad Person/member schema redesign.
- Preserved organization-scoped data access and existing auth/permission patterns.

## Existing Models Used

The following models were used without modification:

| Model | Used for |
|---|---|
| `Person` | Member selection in roster and role assignment forms |
| `Team` | Team context for all assignment operations |
| `RosterMembership` | Team roster add and remove |
| `RoleAssignment` | Team-scoped role create and delete |
| `Season` | Roster membership season targeting |
| `Program` | Automatically derived from team for role assignments |

## Phase 7D Output

### 1) New permission: `rosterMembership.delete`

Added `rosterMembership.delete` to the authorization system (`lib/permissions/index.ts`) following the exact pattern of `roleAssignment.delete`. Granted to ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, and COACH, all at scoped (team/program/org) level.

### 2) Remove roster member workflow (`/teams/[teamId]/roster/[membershipId]/remove`)

- POST route that deletes a `RosterMembership` record.
- Requires `rosterMembership.delete` permission scoped to the team.
- Validates membership belongs to the correct team and organization.
- Preserves selected `seasonId` filter in redirect after remove.
- Redirects with `?rosterSuccess=Member removed from roster.` on success.
- Redirects with `?rosterError=...` on error.

### 3) Assign team-scoped role from team page (`/teams/[teamId]/role-assignments/create`)

- POST route that creates a team-scoped `RoleAssignment` for a given person and role type.
- Requires `roleAssignment.create` permission scoped to the team.
- Validates person and team exist within the organization.
- Checks for and prevents duplicate active role assignments (same person + role type + team).
- Handles `P2002` unique constraint violations as a duplicate guard.
- Redirects with `?roleSuccess=Role assigned.` on success.
- Redirects with `?teamRoleError=...` (and optional field errors) on failure.

### 4) Remove team-scoped role from team page (`/teams/[teamId]/role-assignments/[roleAssignmentId]/delete`)

- POST route that deletes a `RoleAssignment` scoped to the team.
- Requires `roleAssignment.delete` permission scoped to the team.
- Validates assignment belongs to the correct team and organization.
- Redirects with `?roleSuccess=Role assignment removed.` on success.
- Redirects with `?teamRoleError=...` on failure.

### 5) Team detail page improvements (`/teams/[teamId]`)

- Added `rosterSuccess` and `roleSuccess` green success banner feedback.
- Added "Remove" action button for each roster member in the roster table (new Actions column).
- Added deferred-feature note to "Add roster member" form (linking to `/people/new`).
- Added "Remove role" button for each team role assignment in the role assignments list.
- Added new "Assign team role" section with:
  - Select from all organization people.
  - Select role type.
  - Duplicate check (server-side) before create.
  - Field-level error feedback.
  - Deferred-feature note (creating people, guardian onboarding, invitations deferred).
- Roster create route (`/teams/[teamId]/roster`) now redirects with `?rosterSuccess=Member added to roster.` on success.

## Validation Run

- `npm run typecheck` — passes clean.
- `npm run lint` — passes clean.
- `npm run build` — passes clean; all new routes appear in build output.

## Authorization Coverage

| Action | ORGANIZATION_ADMIN | PROGRAM_DIRECTOR | COACH | ASSISTANT_COACH | ATHLETE |
|---|---|---|---|---|---|
| Add roster member | ✅ | ✅ | ✅ (team-scoped) | ❌ | ❌ |
| Remove roster member | ✅ | ✅ | ✅ (team-scoped) | ❌ | ❌ |
| Assign team role | ✅ | ❌ | ❌ | ❌ | ❌ |
| Remove team role | ✅ | ❌ | ❌ | ❌ | ❌ |

Note: `roleAssignment.create` and `roleAssignment.delete` remain ORGANIZATION_ADMIN-only (per existing policy); coaches can manage roster membership (add/remove) but not role assignments.

## Intentionally Deferred

The following items are explicitly not included in this phase:

- **Creating brand-new people** — must use the existing `/people/new` workflow first.
- **Guardian onboarding** — `AthleteGuardianRelationship` create/manage UI is deferred.
- **Member invitations** — invite/onboarding flows are deferred.
- **Communications** — no messaging surfaces added.
- **Attendance linkage** — roster and attendance linkage improvements are deferred.
- **Bulk import** — no CSV/bulk import added.
- **Marking a member inactive** — `RosterMembership` has no `active/inactive` flag; removing from roster is the supported operation. A future phase may add an `isActive` flag if needed.
- **Season rollover ergonomics** — moving members across seasons is deferred.

## What Remains After Phase 7D

- Guardian relationship create/edit/delete UI workflow.
- Member lifecycle improvements (move/inactive/season rollover ergonomics).
- Role/roster consistency guardrails beyond current create/delete coverage.
- Entry/Inbox schema migration work.
- Any invite/onboarding workflows.
