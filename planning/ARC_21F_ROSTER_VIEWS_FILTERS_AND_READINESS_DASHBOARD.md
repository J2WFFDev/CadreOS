# Arc 21F — Roster Views, Filters, and Readiness Dashboard

## Purpose

Arc 21F hardens MemberOps roster visibility so staff can quickly identify active/current members, assignment gaps, and readiness issues without reviewing raw records.

This arc stays additive and compatibility-first:

- no destructive schema rewrites
- no route/model renames
- no onboarding/offboarding automation rollout

## Arc 21A–21E Baseline Confirmed

- Arc 21A inventory established the MemberOps runtime surfaces and stabilization gaps.
- Arc 21B locked Person/Member/Roster vocabulary and compatibility boundaries.
- Arc 21C clarified guardian readiness signals and staff-gated diagnostics.
- Arc 21D added program/team assignment completeness filtering.
- Arc 21E aligned lifecycle terminology and default Active + Pending roster visibility.

## Arc 21F Roster View Model

- Roster remains an operational filtered view over `RosterMembership` participation context.
- Default roster behavior prioritizes active/current operations:
  - Active + Pending lifecycle statuses
  - assigned members in active/current season context
- Staff can filter roster/member views by:
  - season
  - program
  - team
  - role
  - lifecycle status
  - assignment status
  - guardian readiness
  - readiness state (ready / needs attention)
- Readiness indicators surface:
  - missing guardian
  - missing team assignment
  - missing program assignment
  - missing season assignment
  - incomplete profile signal
  - inactive/archived lifecycle signal

## Arc 21F Delivered Changes

### 1) Member list roster filtering and readiness hardening (`/people`)

`app/(dashboard)/people/page.tsx` now supports operational filters and default roster-focused behavior:

- season (active-season default)
- program
- team
- role
- lifecycle status (default Active + Pending, with all-status override)
- assignment status (selected-season assigned / unassigned / all)
- guardian readiness
- readiness state

The people table now includes readiness status + labels per row and preserves links to person detail.

### 2) Shared readiness derivation helper

`lib/member-ops-roster-readiness.ts` centralizes member roster readiness derivation for staff-facing roster views:

- missing guardian
- missing team/program/season assignment
- incomplete profile
- inactive/archived lifecycle
- overall ready vs needs-attention state

### 3) Focused regression tests

`tests/member-ops/roster-readiness.test.ts` adds unit coverage for:

- ready member path
- missing-guardian/missing-assignment path
- inactive/archived lifecycle attention path
- incomplete profile path

## Manual QA Checklist (Arc 21F)

- [ ] Verify `/people` default roster view loads Active + Pending members for active season context.
- [ ] Filter people roster by season and confirm row set updates.
- [ ] Filter by team and confirm only team-related rows remain.
- [ ] Filter by program and confirm only program-related rows remain.
- [ ] Filter by role and confirm role-scoped rows remain.
- [ ] Filter by lifecycle status and confirm status-scoped rows remain.
- [ ] Filter by assignment status and identify unassigned members.
- [ ] Filter guardian readiness to identify members missing guardian coverage.
- [ ] Filter readiness state to identify incomplete/needs-attention members.
- [ ] Verify inactive/archived members are hidden by default and visible when explicitly filtered.
- [ ] Verify person detail/guardian relationship links continue to work from roster rows.
- [ ] Verify team roster and program roster views continue to render and filter as expected.

## Deferred Scope (Intentional)

- full onboarding workflow automation
- offboarding workflow automation
- season rollover automation expansion
- bulk roster import workflows
- communication triggers from readiness issues
- export/reporting enhancements beyond current roster diagnostics
- advanced lifecycle analytics and trend dashboards

## Recommended Arc 21G — Onboarding, Offboarding, and Season Rollover Readiness

Arc 21G should build on Arc 21F by:

1. defining explicit onboarding completion checkpoints tied to readiness indicators
2. defining non-destructive offboarding semantics and historical continuity
3. adding season rollover reconciliation workflows for unresolved readiness gaps
4. adding controlled bulk readiness remediation actions (not broad destructive mutations)
5. adding targeted regression coverage for onboarding/offboarding/rollover readiness paths
