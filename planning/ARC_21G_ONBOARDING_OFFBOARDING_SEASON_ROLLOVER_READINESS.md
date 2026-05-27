# Arc 21G — Onboarding, Offboarding, and Season Rollover Readiness

## Purpose

Arc 21G completes the Release 1 **staff-managed** readiness layer for MemberOps transitions:

- onboarding completion
- offboarding action tracking
- season rollover readiness

This arc is additive and migration-safe. It does not introduce destructive schema rewrites, self-service portals, or broad automation.

## Arc 21A–21F Baseline Reviewed

Arc 21G starts from the already delivered baseline:

- Arc 21A inventory/stabilization and risk boundaries
- Arc 21B Person/Member/Role/Roster naming boundaries
- Arc 21C guardian readiness and relationship model
- Arc 21D season/team assignment readiness
- Arc 21E lifecycle status semantics and Active + Pending default roster behavior
- Arc 21F roster filters and readiness dashboard improvements

## Release 1 Staff-Managed Workflows (Canonical)

### Onboarding (staff-managed)

1. Create a person/member profile (`/people/new`).
2. Assign role/profile context (`RoleAssignment`) and/or roster role (`RosterMembership`).
3. Link guardian when athlete/member is a minor (`AthleteGuardianRelationship`).
4. Assign program/team/season context.
5. Confirm onboarding readiness status in MemberOps roster views.
6. Member appears in default active roster behavior when setup is complete and lifecycle is Active/Pending.

### Offboarding (staff-managed, non-destructive)

1. Move lifecycle from Active/Pending/Graduated to Inactive or Archived as needed.
2. Keep historical roster, guardian relationship, and operational references intact.
3. Keep guardian-athlete relationship continuity for historical review.
4. Remove from default active roster behavior through lifecycle filtering.
5. Avoid destructive delete as offboarding strategy.

### Season rollover (staff-managed, safe)

1. Identify active/default season context and selected rollover source/target season.
2. Review members eligible for carry-forward.
3. Identify members needing exclusion/review (inactive/archived/graduated or incomplete readiness).
4. Execute controlled rollover create-many for eligible memberships only.
5. Preserve source season history and all non-roster records.
6. Surface members requiring rollover readiness review in roster/member readiness indicators.

## Arc 21G Implementation Summary

### 1) Transition readiness indicators in shared MemberOps readiness logic

`lib/member-ops-roster-readiness.ts` now derives explicit transition signals:

- `onboardingIncomplete`
- `offboardingActionRecommended`
- `rolloverReady`
- `rolloverNeedsReview`

These signals are additive over existing guardian/assignment/profile/lifecycle readiness logic and remain non-destructive.

### 2) People roster view transition visibility

`/people` now includes clear staff-facing transition readiness context:

- onboarding incomplete count
- offboarding review needed count
- rollover readiness review count
- per-row transition readiness summary (Onboarding / Offboarding / Rollover)

Active season context and default Active + Pending roster behavior remain explicit in the readiness panel.

### 3) Person detail lifecycle summary improvements

`/people/[personId]` lifecycle panel now includes a compact transition summary:

- onboarding state
- offboarding review state
- rollover readiness state
- Release 1 transfer representation note (non-destructive status/assignment update approach)

### 4) Regression tests updated

`tests/member-ops/roster-readiness.test.ts` now covers the new transition readiness signals (including offboarding-review detection).

## Safe Support Verification (Release 1)

Arc 21G verifies or represents the required behavior:

- staff can identify members needing onboarding completion (`onboardingIncomplete`)
- staff can identify members needing offboarding review (`offboardingActionRecommended`)
- inactive/graduated/archived states are represented without destructive deletes
- prior season participation remains preserved
- default roster behavior remains clean (Active + Pending by default)
- rollover readiness can be represented through readiness indicators even when full automation is deferred

## Manual QA Checklist (Arc 21G)

- [ ] Create a new athlete/member from `/people/new`.
- [ ] Assign role/profile context and verify role appears in person detail.
- [ ] Link guardian to athlete and verify guardian relationship appears.
- [ ] Assign team/program/season roster membership.
- [ ] Verify complete setup member appears in default active roster view.
- [ ] Verify onboarding incomplete member is flagged in readiness indicators.
- [ ] Mark a member Inactive from person detail.
- [ ] Verify inactive member no longer appears in default active roster filters.
- [ ] Verify historical person/relationship/operational records remain visible where intended.
- [ ] Identify a Graduated/Inactive member with retained assignment history and verify offboarding review signal.
- [ ] Verify guardian links remain preserved through lifecycle changes.
- [ ] Run season rollover preview and verify source records remain unchanged.
- [ ] Execute rollover and verify target-season memberships are created without deleting source-season data.
- [ ] Verify active-season roster behavior does not mix old-season history into default current operational filters.

## Deferred Scope (Intentionally Not in Arc 21G)

- self-service guardian onboarding portal
- bulk roster import workflows
- automated season rollover wizard
- consent workflows
- invitation email/SMS workflows
- parent broadcast workflows
- advanced audit trail implementation
- reporting/export enhancements beyond current readiness surfaces

## Arc 21G Changed vs Deferred Summary

### Changed in Arc 21G

- Added explicit onboarding/offboarding/rollover readiness indicators in MemberOps readiness derivation.
- Added people-list transition readiness counts and per-member labels.
- Added person-detail transition readiness summary and transfer representation note.
- Updated readiness tests for transition scenarios.
- Added Arc 21G staff workflow and QA documentation.

### Intentionally deferred

- guardian self-service and invitation automation
- broad rollover automation and reconciliation wizarding
- destructive membership/history mutation strategies
- expanded audit/compliance and advanced reporting tracks

## Recommended Next Scope — Arc 21H (MemberOps Closeout, Auth Audit, QA, Documentation)

1. Run full MemberOps regression pass across people/team/program/season/guardian workflows.
2. Complete staff-role authorization audit for all transition routes and readiness surfaces.
3. Add focused integration tests for onboarding/offboarding/rollover transition paths.
4. Validate no regressions in default active roster behavior and historical continuity.
5. Consolidate MemberOps Release 1 operational SOP documentation for staff.
6. Capture release-ready known limitations and deferred Release 2 items in a single closeout record.
