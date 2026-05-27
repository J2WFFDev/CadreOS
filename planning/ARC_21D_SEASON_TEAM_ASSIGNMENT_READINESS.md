# Arc 21D — Season / Team Assignment Readiness

## Purpose

Arc 21D hardens the assignment foundation for MemberOps so CadreOS can reliably answer:

- who is assigned to which **program**, **team**, and **season**
- which assignment records are complete vs incomplete
- which active members are currently unassigned for a season/program context

This arc is additive and compatibility-first. It does not introduce destructive schema rewrites.

## Arc 21A–21C Baseline Confirmed

- Arc 21A established that `Person`, `RoleAssignment`, `RosterMembership`, `Program`, `Team`, and `Season` are already production primitives.
- Arc 21B locked naming boundaries: MemberOps domain, Roster as an operational view, and no risky runtime renames.
- Arc 21C confirmed guardian-athlete relationships remain person-to-person links and staff-gated diagnostics.

## Assignment Model (Arc 21D Canonical)

- **Person/Member**: participant identity record (`Person`).
- **Assignment/Membership**: participation record (`RosterMembership`) linking person + team + season.
- **Program context**: derived from team/season program linkage.
- **Roster**: filtered operational view over assignment rows.
- **Historical continuity**: older season assignments remain reviewable.
- **Active season default**: `selectSeededOrCurrentSeason` continues to drive default season selection for roster-facing views.

## Current Runtime Support (Verified)

- Assign member/athlete to team + season: `/teams/[teamId]/roster` create route.
- Assign participation to program context: enforced by team/season belonging to the selected program in move workflows.
- Active season detection: `lib/workflows/index.ts` (`selectSeededOrCurrentSeason`).
- Guardian linkage continuity across assignments: relationship model remains independent of team/season assignment rows.
- Staff visibility gating remains role-aware via existing authorization helpers.

## Arc 21D Additions

### Program roster filtering and assignment completeness

Program detail now supports read-only roster filtering by:

- season
- team
- assignment role
- participation status (member lifecycle status)
- assignment completeness (complete/incomplete)

Program detail now also surfaces:

- incomplete assignment rows (roster role missing matching team role assignment)
- unassigned active members for the selected season (active people with program/team role scope but no selected-season roster row)

### Label alignment (low-risk)

UI labels were clarified to consistently use:

- Season
- Program
- Team
- Roster assignment
- Assignment status
- Active/inactive participation

## Manual QA Checklist (Arc 21D)

- [ ] Create or identify active season in a program.
- [ ] Assign athlete/member to a team roster assignment for the selected season.
- [ ] Assign athlete/member to program context via team + season assignment.
- [ ] View program roster by season.
- [ ] View program roster by team.
- [ ] View program roster by program-scoped assignment view.
- [ ] Filter by assignment role and participation status.
- [ ] Filter to incomplete assignment records.
- [ ] Verify unassigned active members are detected for selected season.
- [ ] Verify guardian relationship visibility still works after assignment changes.
- [ ] Verify staff/coach visibility remains role-appropriate.
- [ ] Verify team roster assignment flow still functions.

## Deferred Scope (Intentional)

- full onboarding workflow
- offboarding workflow
- graduation/transfer handling
- season rollover automation
- bulk roster import
- invitation/self-service portal

## Arc 21E Recommendation — Member Lifecycle Status

Arc 21E should build on Arc 21D by formalizing lifecycle/participation state transitions:

1. define explicit participation status semantics beyond current presence/absence patterns
2. add non-destructive assignment end-dating/history strategy
3. align lifecycle transitions with roster/role continuity checks
4. add targeted lifecycle-state reporting and regression tests
