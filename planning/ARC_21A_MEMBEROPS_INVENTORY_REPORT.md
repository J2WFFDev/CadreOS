# Arc 21A — MemberOps Inventory Report

## Executive Summary

CadreOS already has a functional **MemberOps / Roster Lifecycle** baseline centered on `Person`, `RoleAssignment`, `RosterMembership`, `AthleteGuardianRelationship`, `Program`, `Season`, and `Team`. The system supports member creation, role assignment, team/season membership, guardian linkage, lifecycle state changes, and roster rollover. The main Release 1 gaps are not “missing everything”; they are **stabilization gaps**:

- inconsistent domain naming
- hard-delete roster/role behavior
- incomplete offboarding semantics
- limited household/compliance modeling
- weak organization-wide filtering/export tooling
- no dedicated MemberOps automated test coverage

## File Inventory

### Prisma models

- `prisma/schema.prisma`
  - `Organization`
  - `Program`
  - `Season`
  - `Team`
  - `UserAccount`
  - `Person`
  - `RoleAssignment`
  - `AthleteGuardianRelationship`
  - `RosterMembership`

### MemberOps pages and route handlers

#### People

- `app/(dashboard)/people/page.tsx`
- `app/(dashboard)/people/new/page.tsx`
- `app/(dashboard)/people/create/route.ts`
- `app/(dashboard)/people/[personId]/page.tsx`
- `app/(dashboard)/people/[personId]/edit/page.tsx`
- `app/(dashboard)/people/[personId]/edit/update/route.ts`
- `app/(dashboard)/people/[personId]/activate/route.ts`
- `app/(dashboard)/people/[personId]/inactive/route.ts`
- `app/(dashboard)/people/[personId]/archive/route.ts`
- `app/(dashboard)/people/[personId]/move/page.tsx`
- `app/(dashboard)/people/[personId]/move/update/route.ts`
- `app/(dashboard)/people/[personId]/roles/create/route.ts`
- `app/(dashboard)/people/[personId]/roles/[roleAssignmentId]/delete/route.ts`
- `app/(dashboard)/people/[personId]/guardians/page.tsx`
- `app/(dashboard)/people/[personId]/guardians/new/page.tsx`
- `app/(dashboard)/people/[personId]/guardians/create/route.ts`
- `app/(dashboard)/people/[personId]/guardians/[relationshipId]/edit/page.tsx`
- `app/(dashboard)/people/[personId]/guardians/[relationshipId]/edit/update/route.ts`

#### Teams / roster

- `app/(dashboard)/teams/page.tsx`
- `app/(dashboard)/teams/new/page.tsx`
- `app/(dashboard)/teams/create/route.ts`
- `app/(dashboard)/teams/[teamId]/page.tsx`
- `app/(dashboard)/teams/[teamId]/roster/route.ts`
- `app/(dashboard)/teams/[teamId]/roster/[membershipId]/remove/route.ts`
- `app/(dashboard)/teams/[teamId]/role-assignments/create/route.ts`
- `app/(dashboard)/teams/[teamId]/role-assignments/[roleAssignmentId]/delete/route.ts`

#### Programs / seasons

- `app/(dashboard)/programs/page.tsx`
- `app/(dashboard)/programs/new/page.tsx`
- `app/(dashboard)/programs/create/route.ts`
- `app/(dashboard)/programs/[programId]/page.tsx`
- `app/(dashboard)/programs/[programId]/edit/page.tsx`
- `app/(dashboard)/programs/[programId]/edit/update/route.ts`
- `app/(dashboard)/programs/[programId]/seasons/new/page.tsx`
- `app/(dashboard)/programs/[programId]/seasons/create/route.ts`
- `app/(dashboard)/programs/[programId]/seasons/[seasonId]/edit/page.tsx`
- `app/(dashboard)/programs/[programId]/seasons/[seasonId]/edit/update/route.ts`
- `app/(dashboard)/programs/[programId]/seasons/[seasonId]/rollover/page.tsx`
- `app/(dashboard)/programs/[programId]/seasons/[seasonId]/rollover/execute/route.ts`

#### Supporting surfaces with MemberOps visibility

- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/reports/page.tsx`
- `app/(dashboard)/account/link-person/page.tsx`

### Supporting libraries and services

- `lib/workflows/index.ts`
- `lib/permissions/index.ts`
- `lib/authorization/index.ts`
- `lib/organization-context.ts`
- `lib/user-account.ts`
- `lib/guardian-relationship-access.ts`
- `lib/guardian-operational-context.ts`
- `lib/workflows/index.ts` (`selectSeededOrCurrentSeason`, lifecycle and roster validation schemas)

### Components

There is no dedicated `member-ops` component area yet. MemberOps UI is primarily page-local plus generic dashboard/shared components:

- `components/dashboard/back-link.tsx`
- `components/dashboard/empty-state.tsx`
- `components/dashboard/error-message.tsx`
- `components/dashboard/operational-history-panel.tsx`
- `components/dashboard/page-header.tsx`
- `components/dashboard/review-focus-panel.tsx`
- `components/nav-sidebar.tsx`

### Seed data

- `prisma/seed.mjs`
  - demo organization
  - demo program
  - demo season
  - demo team
  - demo admin/director/coach/assistant/athlete/guardian persons
  - demo role assignments
  - demo guardian relationship
  - demo roster membership

### Tests

Direct MemberOps lifecycle coverage is currently missing.

Indirect or adjacent coverage only:

- `tests/gear-ops-integration/guardian.test.ts`

No dedicated tests currently exist for:

- person lifecycle transitions
- roster add/remove
- role assignment add/remove
- move workflow
- guardian create/edit workflow
- season rollover workflow

### Planning and related docs

#### Primary MemberOps lifecycle docs

- `planning/PHASE_17A_ROSTER_MEMBER_LIFECYCLE_ARCHITECTURE_BOUNDARIES.md`
- `planning/PHASE_17B_MEMBER_STATUS_LIFECYCLE_MODEL.md`
- `planning/PHASE_17C_JOIN_ACTIVATE_MEMBER_WORKFLOW.md`
- `planning/PHASE_17D_TEAM_PROGRAM_MOVE_WORKFLOW.md`
- `planning/PHASE_17E_INACTIVE_ARCHIVE_MEMBER_WORKFLOW.md`
- `planning/PHASE_17F_SEASON_ROLLOVER_WORKFLOW.md`
- `planning/PHASE_17G_GUARDIAN_RELATIONSHIP_MAINTENANCE.md`
- `planning/PHASE_17H_ROSTER_LIFECYCLE_READINESS_DASHBOARD.md`
- `planning/PHASE_17I_ROSTER_MEMBER_LIFECYCLE_CLOSEOUT.md`

#### Related reporting and roadmap docs

- `planning/PHASE_18G_ROSTER_LIFECYCLE_GUARDIAN_READINESS_REPORTING.md`
- `planning/ROADMAP_POST_GEAROPS_DECISION.md`
- `planning/README.md`
- `planning/PHASE_7B_TEAM_MEMBER_MANAGEMENT_HARDENING.md`
- `planning/PHASE_7C_TEAM_MEMBER_ROSTER_USABILITY.md`
- `planning/PHASE_7D_TEAM_MEMBER_ASSIGNMENT_WORKFLOW.md`
- `planning/PHASE_7E_GUARDIAN_RELATIONSHIP_VISIBILITY_AND_ROADMAP_REALIGNMENT.md`
- `planning/PHASE_8A_GUARDIAN_WORKFLOW_FOUNDATION.md`
- `planning/PHASE_8B_GUARDIAN_OPERATIONAL_CONTEXT.md`

## Lifecycle States Currently Supported

### Person/member lifecycle

Defined by `MemberLifecycleStatus` on `Person`:

- `PROSPECT`
- `ACTIVE`
- `INACTIVE`
- `ARCHIVED`
- `ALUMNI`

### Current supported transitions

- Activate: `PROSPECT | INACTIVE | ALUMNI -> ACTIVE`
- Mark inactive: `ACTIVE | PROSPECT | ALUMNI -> INACTIVE`
- Archive: `ACTIVE | PROSPECT | INACTIVE | ALUMNI -> ARCHIVED`

### Not explicitly modeled

- no team lifecycle state
- no program lifecycle state
- no season lifecycle state enum
- no guardian relationship lifecycle state
- no roster membership lifecycle state
- no role assignment lifecycle state

## Connection Model

| Area | Current implementation |
| --- | --- |
| Organization | Every core record is organization-scoped. |
| Program | `Program` belongs to org; `Team` and `Season` belong to program. |
| Team | `RosterMembership` and team-scoped `RoleAssignment` connect people to teams. |
| Season | `RosterMembership` always requires a season; season rollover copies memberships forward. |
| Household / guardian relationship | `AthleteGuardianRelationship` links two `Person` rows; no household aggregate model exists. |
| Roles | `RoleAssignment` handles organization/program/team scope; `rosterRole` on `RosterMembership` handles roster role in a season/team context. |
| Permissions | `lib/permissions/index.ts` and `requirePhase1CMutationPermission` enforce staff-scoped actions. |
| User linkage | `UserAccount.personId` is optional; `Person` remains canonical even without linked auth. |

## Capability Matrix

| Capability | Status | Notes |
| --- | --- | --- |
| Create a member/person | Yes | `POST /people/create` with lifecycle status. |
| Assign role(s) | Yes | Person- and team-level role assignment routes exist. |
| Assign to team/program/season | Partial | Team/season roster assignment exists; program context is derived via team/season. |
| Link guardian to athlete | Yes | Create/edit guardian relationship routes exist. |
| Change member status | Yes | Activate, inactive, archive are implemented on `Person`. |
| Archive or offboard | Partial | Person archive exists, but roster/role/guardian end-state semantics are incomplete. |
| Season rollover | Partial | Roster memberships roll forward; role continuity and admin reconciliation remain manual. |
| Readiness/compliance checks | Partial | Lifecycle/guardian readiness is derived; no dedicated compliance model exists. |
| Roster filtering by season/team/status/role | Partial | Team-level filters exist for season/role and guardian signals; organization-wide filtering is limited. |

## What Works Well Today

- canonical `Person` model already exists and is in active use
- lifecycle transitions are implemented without destructive cross-module cascades
- guardian linkage has practical staff workflows and privacy gating
- season rollover preserves source data and skips duplicates
- readiness summaries already surface meaningful operational issues
- organization scoping and authorization patterns are consistent across most flows

## What Is Missing

- dedicated MemberOps automated tests
- explicit roster membership status/end-dating model
- explicit role assignment history/end-dating model
- guardian relationship delete/end-state workflow
- household model
- compliance/consent/readiness records beyond derived cues
- bulk import/export/reconciliation tooling
- organization-wide member roster filter surface
- dedicated offboarding/reinstatement workflow guidance

## What Is Duplicated or Conceptually Overlapping

- `rosterRole` vs `RoleAssignment.roleType`
- `Person` as canonical identity vs “member” as domain label
- guardian readiness logic spread between page queries and helper utilities
- Arc 17 runtime history and Arc 21A planning sequence now overlap conceptually unless the new MemberOps label is used consistently
- planning namespace conflict: existing `PHASE_21A_ATHLETE_JOURNALING_CAPABILITY_ROADMAP.md` vs this Arc 21A work

## What Is Risky

- hard-delete removal of `RosterMembership`
- hard-delete removal of `RoleAssignment`
- renaming runtime routes/models now without a migration plan
- assuming “staff” is a model when it is currently only a role pattern
- treating guardian linkage as a full household model when it is only pairwise relationship data
- expanding compliance scope without clear Release 1 boundaries

## Naming Inconsistencies

| Current term | Where it appears | Arc 21A guidance |
| --- | --- | --- |
| Member | lifecycle docs, UX copy, roadmap copy | keep as business language |
| Person | Prisma model, routes, UI labels | keep as canonical runtime identity model |
| Athlete | roster role and guardian relationship context | keep as role/context, not a separate model |
| Guardian | role and relationship context | keep as role/context, not a separate user type |
| User | `UserAccount` | keep as auth/account layer only |
| Roster | team membership surfaces and routes | keep in runtime path names for now |
| Membership | `RosterMembership` only | treat as current season/team assignment record, not generic membership abstraction |

## Recommended Safe Rename Policy

Rename in docs and roadmap copy now:

- “Roster / Member Lifecycle” -> **“MemberOps / Roster Lifecycle”**

Do not rename in runtime yet:

- `Person`
- `UserAccount`
- `RosterMembership`
- `RoleAssignment`
- `/people`
- `/teams/[teamId]/roster`
- existing permission action strings

## Manual QA Checklist

- [ ] Create a person as Prospect, Active, Inactive, Archived, and Alumni.
- [ ] Verify person detail shows lifecycle status correctly.
- [ ] Activate Prospect, Inactive, and Alumni persons.
- [ ] Mark a person inactive and archive them; verify no historical data disappears.
- [ ] Assign organization, program, and team roles.
- [ ] Add and remove roster membership from a team.
- [ ] Move a member across team/program/season contexts and verify duplicate guards.
- [ ] Create and edit guardian relationships.
- [ ] Run a season rollover preview and execute path.
- [ ] Verify dashboard/people/team/program/report readiness cues update.
- [ ] Verify scoped users cannot perform unauthorized MemberOps mutations.

## Validation Notes Captured in Arc 21A

Passed after dependency install:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `DATABASE_URL=postgresql://user:pass@localhost:5432/cadreos ./node_modules/.bin/prisma validate`

Warnings observed but not changed in this arc:

- Prisma `package.json#prisma` deprecation warning
- Next.js `middleware` deprecation warning

## Recommended Arc 21B–21H Follow-On

- `21B` domain language and inventory alignment
- `21C` member intake and identity hardening
- `21D` roster membership and assignment continuity
- `21E` guardian/household governance
- `21F` lifecycle/offboarding/access review hardening
- `21G` season continuity/readiness/filtering/reporting hardening
- `21H` Release 1 stabilization and validation closeout

## Final Arc 21A Assessment

MemberOps is **partially complete but structurally real**. CadreOS already has the core schema and runtime flows required for a Release 1 roster lifecycle foundation. The remaining work is chiefly stabilization, semantics, admin tooling, and validation coverage rather than a large new schema build.
