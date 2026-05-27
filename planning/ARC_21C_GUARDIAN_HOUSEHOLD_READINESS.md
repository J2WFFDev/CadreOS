# Arc 21C — Guardian / Household Readiness

## Purpose

Complete and harden guardian, household, and minor-athlete readiness workflows so
CadreOS can safely support parent/guardian visibility, athlete relationships,
role-aware access, and Release 1 testing.

This arc continues the MemberOps / Roster Lifecycle stabilization sequence from
Arc 21A (inventory baseline) and Arc 21B (domain language alignment). It does not
introduce broad schema rewrites, route renames, or destructive migrations.

---

## Constraints Preserved

- No destructive schema migrations.
- No guardian-facing portal or self-service UI (explicitly deferred).
- No messaging, notifications, or communications.
- No consent workflow implementation.
- No household entity model introduced.
- All existing roster, member, user, person, team, season, and auth flows
  unchanged.
- Additive changes only.

---

## Canonical Guardian / Household Model

### Guardian

- Guardian is a **role/relationship function**, not a separate identity model.
- A guardian is a `Person` record linked to one or more athletes via
  `AthleteGuardianRelationship`.
- Guardian role context is represented by `RoleAssignment.roleType = PARENT_GUARDIAN`.
- `PARENT_GUARDIAN` is a team-scoped role type (not a staff role).
- Guardian identity and auth account linkage remain optional (`UserAccount.personId`
  may be absent).

### Athlete

- Athlete is a **context-specific member function**, not a separate identity model.
- An athlete is a `Person` with guardian-linked or roster-role context.
- A person can be both an athlete (linked to guardians) and a guardian (linked to
  other athletes) if the organization's data supports that.

### Guardian–Athlete Relationship Rules

| Rule | Description |
| --- | --- |
| Pairwise relationship | Each `AthleteGuardianRelationship` row links exactly one athlete `Person` to one guardian `Person`. |
| One-to-many | An athlete may have one or more guardians. |
| Many-to-one | A guardian may be linked to one or more athletes. |
| Organization-scoped | All relationships are scoped to `organizationId`. Cross-organization links are rejected. |
| Relationship-based access | Guardian access to athlete data is based on explicit linkage, not on global role. |
| Safe-by-default | A guardian without an explicit relationship link has no access to any athlete record. |
| Staff access unchanged | Staff roles (ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, COACH, ASSISTANT_COACH) are not affected by guardian relationship checks. |

### Household

- Household is an **informal grouping concept** in Release 1.
- No separate household entity model exists.
- `AthleteGuardianRelationship` pairwise rows are the canonical household-adjacent
  representation.
- Future arcs may introduce a lightweight household aggregate if operational needs
  require it, but this is deferred.

---

## What Arc 21C Delivered

### 1. Guardian–Athlete Access Control Foundation — `lib/guardian-athlete-access.ts`

A new dedicated library providing guardian-perspective access control primitives:

**Pure predicate functions (no DB, fully testable):**

- `canGuardianSeeAthleteFromLinks(guardianPersonId, athletePersonId, links)` —
  returns `true` if the guardian is explicitly linked to the athlete in the
  pre-loaded relationship list. This is the canonical guard for future
  guardian-facing routes.
- `hasAthleteGuardianCoverage(athleteLinks)` — returns `true` if the athlete
  has at least one guardian on file.
- `isMissingActiveGuardianCoverage(athleteLinks)` — returns `true` if no
  fully active (account-linked + role-assigned) guardian exists for the athlete.
- `deriveAthleteGuardianReadinessState(athleteLinks)` — derives one of four
  readiness states: `no_guardian_on_file`, `guardian_account_link_missing`,
  `guardian_account_inactive_signal`, `guardian_ready`.
- `formatAthleteGuardianReadinessLabel(state)` — human-readable label for each
  readiness state.
- `isGuardianReadinessActionRequired(state)` — returns `true` for all states
  except `guardian_ready`.

**DB-backed helpers (for future guardian-facing routes):**

- `resolveGuardianAthleteAccess(guardianPersonId, athletePersonId, organizationId)` —
  canonical relationship-based access check. Returns `{ canAccess: boolean, reason }`.
- `listAthletesForGuardian(guardianPersonId, organizationId)` — lists all athlete
  `Person` IDs a guardian is linked to in the org.
- `listGuardiansForAthlete(athletePersonId, organizationId)` — lists all guardian
  `Person` IDs linked to an athlete in the org.
- `athleteHasGuardianCoverage(athletePersonId, organizationId)` — fast count-based
  guardian coverage check for list queries.

### 2. MemberOps Naming Rules Extended — `lib/member-ops.ts`

`MEMBEROPS_NAMING_RULES` now includes:

- `athlete` — context-specific member function, not a separate identity model.
- `guardian` — context-specific role/relationship function via `AthleteGuardianRelationship`,
  not a separate user type.
- `household` — informal grouping concept; pairwise `AthleteGuardianRelationship`
  is the data model; no separate household entity in Release 1.

New role predicates added:

- `isGuardianRoleType(roleType)` — returns `true` for `PARENT_GUARDIAN`.
- `isAthleteRoleType(roleType)` — returns `true` for `ATHLETE`.

### 3. Guardian Readiness Tests — `tests/member-ops/guardian-readiness.test.ts`

32 new unit tests covering:

- `canGuardianSeeAthleteFromLinks` — linked/unlinked/cross-guardian scenarios.
- `hasAthleteGuardianCoverage` — present/absent coverage.
- `isMissingActiveGuardianCoverage` — account gap and inactive signal cases.
- `deriveAthleteGuardianReadinessState` — all four states including partial coverage.
- `formatAthleteGuardianReadinessLabel` — non-empty label for each state.
- `isGuardianReadinessActionRequired` — only `guardian_ready` returns false.
- `deriveGuardianOperationalContext` (from existing `guardian-operational-context.ts`).
- `formatGuardianOperationalIndicator` and `formatGuardianFollowUpDependency`.
- MemberOps naming rules for guardian, athlete, and household.
- `isGuardianRoleType` and `isAthleteRoleType` predicates.

### 4. UI Label Cleanup

Three inconsistent labels corrected to use **Guardian** consistently:

| File | Before | After |
| --- | --- | --- |
| `app/(dashboard)/people/[personId]/page.tsx` | `Guardian/parent portal visibility` | `Guardian portal visibility` |
| `app/(dashboard)/people/[personId]/page.tsx` | `parent/guardian role assignment missing` | `guardian role assignment missing` |
| `app/(dashboard)/teams/[teamId]/page.tsx` | `missing parent/guardian role assignments` | `missing guardian role assignments` |

---

## Access Control Design

### Staff access (unchanged)

Staff roles continue to use:

- `lib/guardian-relationship-access.ts` — `resolveGuardianRelationshipAccess`
- `lib/authorization/index.ts` — `evaluateStaffOnlyContentAccess`

Staff can view all guardian relationship diagnostics across the organization
(subject to their scope).

### Guardian access (future portal foundation)

Guardian-facing routes MUST use `lib/guardian-athlete-access.ts`:

1. Verify the actor's `personId` has a `PARENT_GUARDIAN` role in the organization.
2. Call `listAthletesForGuardian` to get the set of athlete IDs the guardian may
   access.
3. Enforce `canGuardianSeeAthleteFromLinks` (or `resolveGuardianAthleteAccess`) on
   any direct athlete ID request.
4. Never expose athletes outside the guardian's linked set.

This pattern ensures a guardian cannot access any athlete they are not explicitly
linked to, even if they hold a `PARENT_GUARDIAN` role in the same organization.

---

## Guardian Readiness Indicators

The following readiness states are now formally defined and testable:

| State | Meaning | Action required |
| --- | --- | --- |
| `no_guardian_on_file` | Athlete has zero `AthleteGuardianRelationship` rows. | Yes — staff should link a guardian. |
| `guardian_account_link_missing` | At least one guardian has no linked `UserAccount`. | Yes — guardian needs account setup. |
| `guardian_account_inactive_signal` | Guardian has a linked account but no active role assignments. | Yes — guardian account/role needs review. |
| `guardian_ready` | At least one guardian with active account and role assignment exists. | No. |

These states are derived from pre-loaded relationship data (no additional query
required when relationships are already fetched).

---

## Manual QA Checklist

### Guardian relationship creation

- [ ] Create a new Person (athlete/member).
- [ ] Create a second Person (guardian).
- [ ] Navigate to People → Athlete → Guardian relationships → Add guardian relationship.
- [ ] Select the guardian Person and relationship type (Parent or Guardian).
- [ ] Verify the relationship is created and shown in the guardian list.
- [ ] Verify a self-relationship is rejected (cannot link person to themselves).
- [ ] Verify a duplicate pair is rejected.

### Guardian relationship edit

- [ ] Navigate to People → Athlete → Guardian relationships.
- [ ] Edit an existing relationship; change the relationship type.
- [ ] Verify the updated relationship type is shown correctly.

### Guardian visibility (staff-scoped)

- [ ] Log in as Organization Admin or Program Director.
- [ ] Navigate to People → Athlete detail page.
- [ ] Verify "As athlete/member: linked guardians" section shows linked guardian(s).
- [ ] Verify "As guardian: linked athletes" section shows linked athlete(s) on the guardian's person detail page.
- [ ] Verify guardian diagnostic indicators on team roster (linked, missing, account gap, inactive signal).

### Guardian readiness indicators

- [ ] Create an athlete with no guardian relationship.
- [ ] Verify roster readiness section shows "No guardian on file" for that athlete.
- [ ] Link a guardian with no UserAccount.
- [ ] Verify indicator shows "Guardian account link missing" (or equivalent).
- [ ] Link a guardian with a UserAccount but no role assignment.
- [ ] Verify indicator shows "Guardian account inactive signal" (or equivalent).
- [ ] Link a guardian with an active UserAccount and role assignment.
- [ ] Verify indicator shows "Guardian-linked and ready" (or equivalent).

### Guardian access protection

- [ ] Verify a PARENT_GUARDIAN role user cannot access the guardian relationship
      maintenance routes (staff-only routes return access denied for guardian role).
- [ ] Confirm that staff workflows (notes, tasks, attendance, team roster) are
      unaffected by Arc 21C changes.

### Regression checks

- [ ] Verify person create/edit/lifecycle workflows unchanged.
- [ ] Verify team roster add/remove workflows unchanged.
- [ ] Verify season rollover still copies roster memberships correctly.
- [ ] Verify dashboard/reports readiness summaries render correctly.
- [ ] Verify existing guardian relationship maintenance (create/edit) still works.
- [ ] Run `npm run lint && npm run typecheck && npm run test && npm run build`.

---

## Deferred Scope

The following items are intentionally out of scope for Arc 21C:

| Item | Deferred to |
| --- | --- |
| Guardian-facing portal / self-service UI | Later arc (guardian portal track) |
| Guardian invitation and onboarding flow | Later arc (onboarding track) |
| Consent workflow (capture, revocation, audit) | Later arc (compliance track) |
| Guardian relationship end-dating / history | Later arc (lifecycle hardening) |
| Household aggregate model | Later arc if operational need confirmed |
| Parent broadcast / group messaging | Arc after Communications |
| Journal visibility policy for guardians | Deferred with journaling track |
| Communications delivery to guardians | Arc after Communications |
| Multi-household / split custody handling | Later arc |
| Primary guardian / emergency contact fields | Later arc |
| Contact permission modeling on relationships | Later arc |
| Guardian self-service roster viewing | Later arc (guardian portal) |
| Bulk guardian import | Later arc |

---

## Validation Summary

Arc 21C ran all validation commands with no failures:

- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm run test` — 512 tests pass (480 pre-existing + 32 new guardian readiness tests)
- `DATABASE_URL=... ./node_modules/.bin/prisma validate` — pass (no schema changes)

No Prisma schema changes were introduced. All changes are additive TypeScript
helpers, tests, and documentation.

---

## Arc 21C Output Summary

Arc 21C establishes the guardian–athlete access control foundation for Release 1:

- `lib/guardian-athlete-access.ts` provides pure predicate functions and DB-backed
  helpers that future guardian-facing routes must use for relationship-based access
  checks.
- `MEMBEROPS_NAMING_RULES` now formally defines athlete, guardian, and household
  within the MemberOps vocabulary.
- Role predicates `isGuardianRoleType` and `isAthleteRoleType` are now available
  for clean role-type discrimination.
- 32 new unit tests lock the guardian readiness logic against regression.
- UI label inconsistency (guardian/parent mixing) has been cleaned up in three
  surfaces.
- The guardian–athlete relationship model is documented with access rules,
  readiness states, and a manual QA checklist ready for Release 1 testing.

---

## Recommended Arc 21D — Season / Team Assignment Readiness

Arc 21D should focus on roster membership and season assignment continuity:

1. Define safe semantics for roster membership removal (soft-delete or end-dating
   instead of hard-delete).
2. Clarify role assignment continuity across season rollover (are coach/guardian
   roles copied or reviewed?).
3. Add mismatch detection for active persons with no current roster membership.
4. Improve organization-wide roster filter surface (filter by season, team, status,
   and role).
5. Add season assignment readiness indicators to dashboard and program views.
6. Define what "ready for next season" means for roster/role/guardian state
   combinations.
7. Document safe bulk/admin patterns for roster reconciliation without large schema
   redesign.
