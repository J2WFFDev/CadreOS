# Phase 17H — Roster Lifecycle Dashboard and Readiness Integration

## Goal

Add staff-scoped, read-only roster lifecycle readiness visibility across existing dashboard and operational surfaces so operators can quickly assess:

- member lifecycle status mix
- roster readiness by team/program/season context
- guardian relationship readiness gaps
- active members missing roster membership context

without adding new lifecycle mutation workflows.

## Scope

- Add read-only roster lifecycle readiness summaries to existing surfaces.
- Reuse existing organization scoping (`getOrganizationScope`) and staff authorization helpers.
- Preserve all Arc 17C–17G lifecycle/guardian mutation workflows unchanged.
- Preserve FieldOps and GearOps behavior unchanged.
- Add safe empty states and safe links to existing workflows.

## Surfaces Updated

### Dashboard (`/dashboard`)

- Added **Roster lifecycle readiness** section with:
  - lifecycle mix counts (Active, Prospect, Inactive, Archived, Alumni)
  - count and short list of Active members with no roster membership
  - quick links to People, Teams, and Programs operational surfaces
- Added metric tile for **Active members with no roster membership**.
- Preserved existing team readiness and guardian-linkage readiness sections.

### People list (`/people`)

- Added **Roster lifecycle readiness** summary card with:
  - lifecycle mix counts in current scope
  - Active members with no roster membership count
  - athlete profiles missing guardian linkage count (staff-visible contexts only)
- Preserved existing staff-only visibility and person table behavior.

### Person detail (`/people/[personId]`)

- Added lifecycle/roster readiness cues:
  - readiness gap cue when member is `ACTIVE` but has no roster membership in current scope
  - lifecycle note when non-Active member has roster membership
- Enhanced empty roster state with safe link to existing move workflow.

### Team detail (`/teams/[teamId]`)

- Added selected-season lifecycle mix summary for roster members.
- Added count of selected-season roster members not in `ACTIVE` lifecycle status.
- Updated roster table “Member status” to display actual `Person.lifecycleStatus` rather than a hardcoded active label.
- Preserved existing guardian-readiness and role-assignment readiness diagnostics.

### Program detail (`/programs/[programId]`)

- Added **Roster lifecycle readiness** summary based on selected/current season:
  - unique roster member count
  - lifecycle mix (Active/Prospect/Inactive/Archived/Alumni)
  - athlete rows missing guardian linkage
- Preserved existing season rollover links/workflow and program/team role visibility.

## Authorization and Privacy

- Visibility remains staff-scoped through existing dashboard/people/team/program access patterns.
- No parent/guardian portal behavior added.
- No messaging/notifications added.
- No exposure of staff-only notes to guardians.
- No new authorization model introduced.

## Data and Workflow Safety

- No Prisma schema changes in 17H.
- No lifecycle mutation route changes in 17H.
- No guardian maintenance mutation route changes in 17H.
- Season rollover behavior preserved.
- FieldOps and GearOps runtime behavior preserved.
- All readiness output is informational/read-only.

## Deferred (Not in 17H)

- New lifecycle mutation workflows
- New reporting pages
- Messaging/notifications
- Parent portal behavior
- Payments/dues/billing
- External integrations

## Arc 17H Output Summary

Arc 17H integrates roster lifecycle and readiness visibility into existing staff operational surfaces (dashboard, people, team, program) with read-only lifecycle/roster/guardian context summaries and safe navigation to existing workflows, while preserving Arc 17 mutation workflows, authorization boundaries, and Core/FieldOps/GearOps behavior.
