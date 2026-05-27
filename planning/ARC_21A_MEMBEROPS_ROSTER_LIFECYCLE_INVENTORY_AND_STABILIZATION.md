# Arc 21A — MemberOps / Roster Lifecycle Inventory and Stabilization

## Purpose

Establish the Release 1 inventory and stabilization baseline for the CadreOS **MemberOps / Roster Lifecycle** domain.

This arc is documentation-first. It does **not** introduce major schema redesign, route renames, or runtime rewrites. The goal is to document what currently exists, what is already working, what remains incomplete, and the exact follow-on implementation sequence needed to make MemberOps Release 1 ready.

## Naming Direction

- Preferred roadmap/domain label going forward: **MemberOps / Roster Lifecycle**
- Existing runtime model and route names such as `Person`, `RosterMembership`, and `/teams/[teamId]/roster` remain in place for now.
- Existing Arc 17 documents are still valid implementation history; this arc reframes them under a clearer domain label rather than forcing risky runtime renames.
- This document uses an `ARC_21A_...` filename to avoid colliding with the existing planning-only `PHASE_21A_ATHLETE_JOURNALING_CAPABILITY_ROADMAP.md`.

## Current Release 1 Baseline

Arc 17 already delivered a substantial roster/member lifecycle chain:

- explicit `Person.lifecycleStatus`
- person create/edit lifecycle surfaces
- activate / inactive / archive flows
- move workflow across program/team/season context
- guardian relationship create/edit flows
- team roster add/remove flows
- season rollover for `RosterMembership`
- staff-scoped readiness visibility across dashboard, people, team, program, and reports

Arc 21A therefore starts from **inventory and stabilization**, not from a blank MemberOps implementation.

## Current Domain Inventory Summary

### Core models in active use

- `Organization`
- `Program`
- `Season`
- `Team`
- `Person`
- `UserAccount`
- `RoleAssignment`
- `RosterMembership`
- `AthleteGuardianRelationship`

### Primary runtime surfaces

- People: `/people`, person detail, create/edit, lifecycle actions, move, guardian maintenance, role assignment
- Teams: `/teams`, team detail, roster add/remove, team role assignments
- Programs: `/programs`, program detail, season create/edit, season rollover
- Dashboard/reporting: staff-scoped lifecycle and readiness summaries
- Account linking: `/account/link-person`

### Primary supporting libraries

- `lib/workflows/index.ts`
- `lib/permissions/index.ts`
- `lib/authorization/index.ts`
- `lib/organization-context.ts`
- `lib/user-account.ts`
- `lib/guardian-relationship-access.ts`
- `lib/guardian-operational-context.ts`

## What Exists and Appears Stable

### Identity and lifecycle

- `Person` is the canonical human record.
- Lifecycle states supported in schema/runtime: `PROSPECT`, `ACTIVE`, `INACTIVE`, `ARCHIVED`, `ALUMNI`.
- Join/create flow supports explicit lifecycle selection.
- Activate, inactive, and archive routes enforce transition guards.
- Archived/inactive changes are non-destructive and preserve historical references.

### Organization / program / team / season connections

- `Program` belongs to `Organization`.
- `Team` belongs to `Organization` and `Program`.
- `Season` belongs to `Organization` and `Program`.
- `RosterMembership` links `Person` to `Team` and `Season`.
- `RoleAssignment` links `Person` to organization/program/team scope.

### Guardian and household-adjacent linkage

- `AthleteGuardianRelationship` links athlete/member `Person` rows to guardian `Person` rows.
- Guardian visibility is staff-scoped.
- Guardian create/edit workflows exist.
- There is no standalone household model yet; guardian linkage is the current household-adjacent representation.

### Readiness and reporting

- Dashboard, people, team, program, and reports surfaces expose roster/lifecycle readiness cues.
- Readiness currently centers on lifecycle mix, active-without-roster gaps, and guardian linkage gaps.

## Exact Release 1 Gaps

### 1. Domain language and naming clarity gaps

- Runtime uses a mix of `Person`, `Member`, `Roster`, `RosterMembership`, and role labels.
- No single canonical document explains how `Person`, `UserAccount`, `RoleAssignment`, `RosterMembership`, and guardian links work together.
- Existing roadmap wording still says **Roster / Member Lifecycle** in several places.

### 2. Role and roster continuity gaps

- `RoleAssignment` deletion is hard-delete only.
- `RosterMembership` removal is hard-delete only.
- There is no historical role assignment timeline.
- Season rollover copies roster membership only; role continuity and mismatch remediation remain manual.

### 3. Lifecycle and offboarding gaps

- Lifecycle state exists only on `Person`; program/team/season/relationship lifecycle is still mostly derived.
- No guided offboarding checklist for removing or ending roster participation, roles, guardian expectations, access review, and related operational cleanup.
- No reinstate-from-archive workflow.

### 4. Guardian / household gaps

- Guardian create/edit exists, but no dedicated delete/end-dating lifecycle, household grouping, or relationship history exists.
- No member-facing or guardian-facing self-service.
- No consent/compliance/approval record model exists in MemberOps.

### 5. Filtering, QA, and test coverage gaps

- Team detail supports season/role/guardian filters, but there is no comprehensive organization-wide MemberOps filtering surface by season/team/status/role.
- No dedicated member/roster lifecycle test suite exists under `/tests`.
- Current validation is mostly indirect through application build and adjacent workflows.

### 6. Import/export and administrative tooling gaps

- No bulk person/member import.
- No roster export workflow dedicated to MemberOps.
- No role/roster reconciliation workflow for staff to resolve mismatches in bulk.

## Risk Areas

- Hard-delete behavior for roster membership and role assignment can remove current-state context without historical end-state semantics.
- Broad renaming of runtime routes/models from roster/member language to MemberOps would be high-risk right now.
- Lifecycle readiness is present, but compliance/readiness remains derived rather than explicitly modeled.
- Existing `PHASE_21A_ATHLETE_JOURNALING_CAPABILITY_ROADMAP.md` creates a planning namespace collision with this new Arc 21A work.

## Safe Rename Guidance

Document/domain language should shift toward **MemberOps / Roster Lifecycle** now.

Do **not** yet rename:

- Prisma models (`Person`, `RosterMembership`, `RoleAssignment`, `AthleteGuardianRelationship`)
- working App Router paths such as `/people`, `/teams/[teamId]/roster`, or `/programs/[programId]/seasons/[seasonId]/rollover`
- permission action names already embedded in runtime behavior

Reason:

- these names are already wired through schema, route handlers, authorization, dashboard/reporting surfaces, and seeded/demo flows
- Arc 21A is inventory/stabilization, not migration
- a safe rename would require a later dedicated migration arc with compatibility and regression coverage

## Recommended Arc 21B–21H Sequence

### Arc 21B — Domain Language, Inventory Alignment, and Acceptance Lock

- finalize canonical MemberOps terminology
- align roadmap/planning/docs wording
- define authoritative relationships between `Person`, `UserAccount`, `RoleAssignment`, `RosterMembership`, and guardian linkage
- lock Release 1 acceptance criteria and non-goals

### Arc 21C — Member Intake and Identity Hardening

- harden member/person creation and edit rules
- clarify role assignment expectations at intake
- tighten person/user linking expectations and admin diagnostics
- document safe handling for coach/staff/guardian/athlete role combinations

### Arc 21D — Roster Membership and Assignment Continuity

- add mismatch detection/remediation for roster vs role assignment
- define non-destructive end-state semantics for roster changes
- improve roster filtering and staff review workflows
- prepare safe bulk/admin patterns without large schema redesign

### Arc 21E — Guardian / Household and Relationship Governance

- define delete/end/change semantics for guardian relationships
- decide whether Release 1 needs a lightweight household abstraction or should stay relationship-only
- harden guardian linkage validation and staff workflows
- formalize guardian/privacy boundaries and approval deferrals

### Arc 21F — Status Change, Offboarding, and Access Review

- define Release 1 offboarding path across lifecycle status, roster presence, roles, and linked access
- address reinstate/archive edge cases
- document operational effects for inactive/alumni/archived members across adjacent modules

### Arc 21G — Season Continuity, Readiness, and Reporting Hardening

- close season rollover gaps
- clarify whether role assignments should be reviewed or copied during rollover
- strengthen readiness/compliance signal definitions
- improve program/team/roster filtering and export-friendly operational review

### Arc 21H — Release 1 Stabilization and Validation Closeout

- add focused MemberOps automated coverage
- complete manual QA checklist execution
- confirm no regressions in people/team/program/season/guardian flows
- document deferred post-Release-1 work such as imports, household model, and self-service

## Manual QA / Test Notes for Current State

Run and verify:

1. Create a person with each lifecycle status.
2. Activate `PROSPECT`, `INACTIVE`, and `ALUMNI` persons.
3. Mark an `ACTIVE` person inactive, then archive them.
4. Assign organization/program/team roles and verify scope enforcement.
5. Add/remove roster memberships for a team and season.
6. Move a member to a different team/program/season and verify duplicate guards.
7. Create and edit guardian relationships; verify self-link and duplicate prevention.
8. Execute season rollover with and without inactive inclusion.
9. Confirm dashboard/people/team/program surfaces reflect lifecycle and guardian readiness.
10. Confirm historical notes/tasks/events/attendance references remain intact after lifecycle changes.

## Validation Baseline Recorded During Arc 21A

- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `DATABASE_URL=postgresql://user:pass@localhost:5432/cadreos ./node_modules/.bin/prisma validate`

Status: all passed during this documentation arc. Existing warnings observed:

- Prisma config deprecation warning for `package.json#prisma`
- Next.js warning that `middleware` should move to `proxy`

## Arc 21A Output Summary

Arc 21A confirms that CadreOS already contains a meaningful MemberOps / roster lifecycle foundation from Arc 17, but Release 1 readiness still requires domain-language cleanup, roster/role continuity hardening, guardian/household governance decisions, offboarding clarity, stronger filtering/export/admin tooling, and dedicated validation coverage. The recommended follow-on sequence is Arc 21B through Arc 21H with no large schema migration in this arc.
