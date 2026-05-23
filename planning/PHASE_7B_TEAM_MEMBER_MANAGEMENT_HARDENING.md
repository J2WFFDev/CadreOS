# Phase 7B — Team/Member Management Hardening

## Goal

Apply a small, safe hardening slice focused on coach/admin clarity for team membership, roles, program/team ownership, and current guardian relationship support boundaries.

## Scope Guardrails

- No FieldOps expansion.
- No communications/messaging.
- No notifications.
- No payments, billing, fundraising, or sponsorship.
- No mobile-native behavior.
- No major new dependencies.
- Preserve organization scoping and existing auth/data access patterns.

## Current Implementation State (before this slice)

- **Organizations/programs/seasons/teams/people** are implemented with organization-scoped queries and route guards via `getOrganizationScope()`.
- **Team/member foundation exists** via `Team`, `RosterMembership`, `Season`, and `RoleAssignment`.
- **Write workflows already exist** for:
  - person create
  - team create
  - role assignment create/delete
  - roster membership create
- **Read views already exist** for:
  - programs list/detail
  - teams list/detail
  - people list/detail
- **Guardian relationships exist in schema/UI** through `AthleteGuardianRelationship` and person detail read sections.
- **Known limitation**: dedicated guardian relationship create/manage UI workflow is not implemented yet.

## Gaps vs Phase 7A Recommendation

1. Team/member visibility was present but still light for quick coach decisions:
   - team list did not show membership/role volume at a glance
   - people list did not clearly show team/program membership context per person
2. Guardian relationship support existed, but support boundaries were not explicit enough in UI copy.
3. Basic loading states were missing for team/people segments.
4. No Phase 7B output summary document existed to capture what was hardened vs deferred.

## Phase 7B Hardening Output (this PR)

### 1) Team/Member read-view hardening

- **Teams list (`/teams`)**
  - Added roster membership count and team-scoped role assignment count per team.
- **Team detail (`/teams/[teamId]`)**
  - Roster members now link directly to person detail.
  - Team role assignees now link directly to person detail.
  - Added guardian-link visibility for athlete roster rows.
  - Added selected-season guardian coverage summary (athletes with/without guardian links).
- **People list (`/people`)**
  - Added Team/Program membership summary column.
  - Added guardian-link summary column.
- **Person detail (`/people/[personId]`)**
  - Roster membership now shows linked program + team context.
  - Added explicit note that guardian relationship records are visible, while dedicated relationship management workflows are still deferred.

### 2) Loading-state hardening

- Added segment loading UIs:
  - `app/(dashboard)/people/loading.tsx`
  - `app/(dashboard)/teams/loading.tsx`

### 3) Documentation hardening

- Added this Phase 7B output summary to keep implementation and remaining gaps explicit.

## Validation Run

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## What remains after this Phase 7B slice

- Guardian relationship create/edit/delete workflows.
- Member lifecycle workflows beyond current add-only roster operations (e.g., move/inactive/season rollover ergonomics).
- Additional role/roster consistency guardrails beyond current create/delete coverage.
- Any Entry/Inbox schema migration work (still future and out of scope for this slice).
