# Arc 21B — MemberOps Data Model and Naming Alignment

## Goal

Lock the MemberOps vocabulary and current-model boundaries so future work can extend guardian, household, lifecycle, and onboarding workflows without renaming stable runtime primitives or introducing unsafe schema churn.

This arc is intentionally compatibility-first:

- no destructive migrations
- no route renames
- no Prisma model renames
- no changes to seed assumptions

## Canonical MemberOps Definitions

| Concept | Meaning in CadreOS | Current runtime representation |
| --- | --- | --- |
| User | Login/auth account used for sign-in and identity linking. | `UserAccount` |
| Person | Canonical human identity/profile record. | `Person` |
| Member | Business-language label for a person participating in the organization. | `Person` plus lifecycle/role/roster context |
| Membership | Relationship between a person and a team/season participation context. | `RosterMembership` |
| Role | What a person can do or see in org/program/team scope. | `RoleAssignment.roleType` + `scopeType` |
| Athlete | Context-specific member function, not a separate identity model. | `RoleAssignment`, `RosterMembership.rosterRole`, guardian-linked person context |
| Guardian | Context-specific member/relationship function, not a separate identity model. | `AthleteGuardianRelationship`, optional `PARENT_GUARDIAN` role |
| Coach | Staff/team function. | `RoleAssignment` or `RosterMembership.rosterRole` when shown in roster context |
| Staff | Authorization-capable operational user group. | `ORGANIZATION_ADMIN`, `PROGRAM_DIRECTOR`, `COACH`, `ASSISTANT_COACH` |
| Team | Program-scoped operating squad. | `Team` |
| Program | Organization-scoped program container for teams and seasons. | `Program` |
| Season | Program-scoped timebox for roster continuity. | `Season` |
| Roster | Filtered operational view of memberships. | Team/program readiness views over `RosterMembership` |

## Actual Schema and Implementation Alignment

### Stable model boundaries

- `Person` remains the canonical human record across Core, MemberOps, FieldOps, GearOps, notes, tasks, events, and attendance.
- `UserAccount.personId` remains optional so login access and person records can be linked incrementally.
- `RoleAssignment` remains the scoped authorization and context model.
- `RosterMembership` remains the team + season membership model.
- `AthleteGuardianRelationship` remains pairwise guardian linkage, not a household aggregate.

### Important clarifications

- Member lifecycle currently belongs to `Person.lifecycleStatus`, not to `RosterMembership`.
- Roster participation is separate from identity. A person can exist without an active membership.
- Roster roles and scoped authorization roles currently share the `RoleType` enum, but they do not mean the same thing in every context.
- Roster pages are views over memberships; they are not the full MemberOps domain.

## Arc 21B Safe Alignment Changes

### Documentation

- Add this Arc 21B document as the canonical naming reference for MemberOps.
- Update planning index references so Arc 21A inventory and Arc 21B alignment are easy to find together.

### TypeScript/domain guardrails

- Add shared MemberOps helper constants for:
  - lifecycle status labels
  - staff-capable role types
  - valid team-scoped role types
  - valid roster role types
- Add helper predicates to distinguish staff, team, and roster role usage.

### Runtime guardrails

- Team roster create/update validation now rejects org-level and program-level admin roles as roster membership roles.
- Team role-assignment UI and route validation now limit team-scoped role creation to athlete/guardian/coach role types.
- Person creation UI copy now explicitly distinguishes person profile creation from later membership assignment.

## Deferred Schema Risks

These remain intentionally deferred because they need dedicated migration design and regression coverage:

1. `RoleAssignment` and `RosterMembership` are still hard-delete oriented.
2. `RoleType` is still shared across authorization and roster contexts.
3. `AthleteGuardianRelationship` still has no end-dating/history model.
4. No household aggregate model exists yet.
5. No explicit membership status model exists beyond `Person.lifecycleStatus` plus current roster presence.
6. Program, team, and season lifecycle states are still mostly derived.

## Manual QA Checklist

- [ ] Create a person and verify the UI explains person profile vs later roster membership.
- [ ] Add a valid roster membership and verify success messaging still works.
- [ ] Attempt to submit a non-roster role in roster membership flow and confirm validation blocks it.
- [ ] Assign a valid team role and verify team detail still renders correctly.
- [ ] Attempt to submit an org/program admin role through team role assignment and confirm validation blocks it.
- [ ] Link a guardian to an athlete and verify guardian visibility remains staff-scoped.
- [ ] Verify team/program roster filters still operate for athlete, guardian, coach, and assistant coach views.
- [ ] Verify season rollover still copies valid roster memberships.

## Recommended Arc 21C — Guardian / Household Readiness

Arc 21C should stay focused on guardian and household readiness rather than broader schema redesign:

1. Define guardian relationship end-state semantics (end, replace, merge, historical visibility).
2. Decide whether Release 1 needs a lightweight household grouping model or should remain relationship-only.
3. Add guardian-link diagnostics and reconciliation flows for duplicate, missing, and stale linkage.
4. Clarify guardian onboarding/account-link expectations relative to `UserAccount.personId`.
5. Define what operational readiness signals belong to guardian readiness versus broader compliance work.

## Arc 21B Outcome Summary

Arc 21B keeps the existing runtime model intact while making the naming boundary explicit: `UserAccount` handles auth, `Person` handles human identity, `RosterMembership` handles participation, `RoleAssignment` handles scoped capability, and roster pages remain operational views inside the larger MemberOps domain. Larger lifecycle-history and household abstractions remain deferred to later arcs.
