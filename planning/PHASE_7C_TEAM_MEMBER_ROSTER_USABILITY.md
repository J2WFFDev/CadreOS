# Phase 7C — Team/Member Roster Usability

## Goal

Improve Team/Member Management usability so coach/admin users can quickly understand team rosters, role assignments, and guardian relationship gaps without expanding scope.

## Scope Guardrails Applied

- No FieldOps changes.
- No communications, messaging, or notifications.
- No payments, billing, fundraising, or sponsorship features.
- No mobile-native behavior.
- No major schema redesign or new major dependencies.
- Preserved organization-scoped data access and existing auth patterns.

## Phase 7C Output

### 1) Team list readability improvements (`/teams`)

- Kept existing team cards and added stronger context per team:
  - team name
  - program context
  - selected season context (where available)
  - selected-season roster count with athlete count
  - team role assignment count
- Retained existing no-teams empty state.

### 2) Team roster detail readability improvements (`/teams/[teamId]`)

- Improved roster display to make coach/admin review faster by showing:
  - member/person name (and email when available)
  - roster role
  - role assignment status
  - member status
  - guardian/relationship status
- Added explicit gap labels in roster output:
  - **Role assignment missing**
  - **No guardian linked**
  - **Guardian support not modeled yet** (for non-athlete roster roles)
  - **Inactive/unassigned member** (team role assignee not on selected season roster)
- Added low-risk filter support:
  - roster role filter (All + each role type)
  - season filter (existing, preserved)
- Added/clarified empty states for:
  - no members on selected season roster
  - no members for selected role filter
  - no role assignments on team
  - no guardian relationship data for selected roster context

### 3) Relationship and role gap visibility

- Added roster-level summary for role assignment gaps.
- Preserved and clarified athlete guardian coverage summary.
- Added explicit copy when guardian relationship data is absent for selected roster context.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## What remains for later phases

- Member add/edit lifecycle improvements beyond current minimal workflows.
- Dedicated guardian relationship create/edit/delete workflow modeling.
- Invite/onboarding workflows.
- Communications and messaging workflows.
- Attendance linkage improvements across roster and participation workflows.
