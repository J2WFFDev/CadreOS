# Arc 26A — MemberOps RC1 Gap Assessment and Capability Audit

## Scope and Constraints

This audit inventories current MemberOps runtime behavior against RC1 goals for MemberOps, EntryOps, and GearOps alignment.

Guardrails honored:

- No module renaming
- No visual redesign
- No schema rewrite
- Focus on inventory, assessment, documentation, and gap identification
- Low-risk critical consistency fix only

---

## Capability Inventory and RC1 Matrix

### 1) Member Lifecycle

| Lifecycle State | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Prospect | Complete | `prisma/schema.prisma` (`MemberLifecycleStatus.PROSPECT`), `/people/create`, `/people/[personId]/activate` | Fully modeled and actionable. |
| Applicant | Missing | `MemberLifecycleStatus` enum has no `APPLICANT` | Intake begins as Prospect/Active only. |
| Member | Partial | `MemberLifecycleStatus.ACTIVE` | “Member” exists as business language, but no explicit `MEMBER` enum state. |
| Inactive | Complete | `/people/[personId]/inactive/route.ts` | Transition and UI controls implemented. |
| Alumni | Complete | `MemberLifecycleStatus.ALUMNI`, `/people/[personId]/activate` | Reactivation path exists. |
| Former Member | Partial | `MemberLifecycleStatus.ARCHIVED` | Functional equivalent exists but name is not explicit. |

### 2) Family Relationships

| Capability | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Guardian relationships | Complete | `AthleteGuardianRelationship`, guardian create/edit flows | Pairwise guardian-athlete linking is operational. |
| Multiple guardians | Complete | Relationship uniqueness is per guardian-athlete pair, not single guardian cap | One athlete can hold multiple guardian links. |
| Emergency contacts | Missing | Person detail explicitly notes emergency indicators are deferred | No modeled emergency-contact entity or flags. |
| Household relationships | Partial | `MEMBEROPS_NAMING_RULES.household` documents informal-only concept | No household aggregate model; only pairwise links. |

### 3) Team and Program Structure

| Capability | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Programs | Complete | `Program` model, `/programs` create/update pages and routes | Operational. |
| Teams | Complete | `Team` model, `/teams` create/manage routes | Operational. |
| Seasons | Complete | `Season` model, create/update and rollover routes | Operational with rollover flow. |
| Rosters | Complete | `RosterMembership` model, add/remove routes, team roster UI | Operational with filters and readiness indicators. |

### 4) Roles

| RC1 Role | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Athlete | Complete | `RoleType.ATHLETE`, roster + role assignment support | Operational. |
| Guardian | Partial | `RoleType.PARENT_GUARDIAN` | Supported as parent/guardian, naming mismatch with RC1 “Guardian”. |
| Coach | Complete | `RoleType.COACH` (+ assistant coach subtype) | Operational. |
| Volunteer | Missing | No volunteer role enum/action policy | Not modeled. |
| Program Admin | Partial | `RoleType.PROGRAM_DIRECTOR` | Capability exists under different role label. |
| Organization Admin | Complete | `RoleType.ORGANIZATION_ADMIN` with full write scope | Operational. |

### 5) Permissions (Visibility + Edit)

| Area | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Staff edit permissions | Complete | `lib/permissions/index.ts` action matrix, scoped checks | MemberOps mutations enforce role + scope checks. |
| Role-based navigation visibility | Partial | `lib/navigation/cadreos-nav.ts`, `lib/auth/access-control.ts` | MemberOps nav is staff-focused; guardian/athlete member visibility is limited. |
| Guardian detail visibility gating | Complete | `lib/guardian-relationship-access.ts` and guarded page rendering | Sensitive guardian diagnostics hidden for non-staff. |

### 6) Qualifications

| Capability | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Certifications | Missing | No qualification/certification models or routes in MemberOps | Not implemented. |
| Eligibility | Missing | No eligibility policy/data model in MemberOps | Not implemented. |
| Training records | Missing | No training record entity/workflow in MemberOps | Not implemented. |

### 7) Enrollment Workflows

| Workflow | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Joining | Partial | Person create + roster add workflows | No applicant-stage workflow. |
| Transfers | Partial | `/people/[personId]/move/update/route.ts` | Team/program/season transfer exists; process remains admin-driven. |
| Departures | Partial | Roster remove + lifecycle inactive/archive routes | No consolidated departure/offboarding workflow artifact. |
| Reactivation | Complete | `/people/[personId]/activate/route.ts` supports Prospect/Inactive/Alumni to Active | Operational. |

### 8) Dashboards and Navigation

| Capability | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Role-specific MemberOps navigation | Partial | `CADREOS_NAV_GROUPS` MemberOps section | Staff-only MemberOps group, planned routes not implemented. |
| MemberOps lifecycle dashboard route | Missing | `MEMBERSHIP_LIFECYCLE` nav item marked planned | Dedicated route absent. |
| MemberOps reports route | Missing | `MEMBER_REPORTS` nav item marked planned | Dedicated route absent. |

---

## Duplicate and Inconsistent Capability Signals

- `PROGRAM_DIRECTOR` vs RC1 “Program Admin”
- `PARENT_GUARDIAN` vs RC1 “Guardian”
- `ARCHIVED` lifecycle label used where RC1 language expects “Former Member”
- Dual role semantics (`RoleAssignment.roleType` and `RosterMembership.rosterRole`) require stricter operational guidance
- Business “Member” language vs runtime `Person` model requires explicit translation in docs/training

---

## Low-Risk Critical Fix Applied

To reduce lifecycle terminology confusion without schema or module changes:

- Updated lifecycle display label for `ARCHIVED` to **“Former Member (Archived)”** in `lib/member-ops.ts`.

This preserves runtime enum/schema behavior and improves RC1-aligned operator interpretation.

---

## RC1 Gap Report

### Missing

- Applicant lifecycle state
- Volunteer role
- Emergency contacts model/workflow
- Qualifications domain (certifications, eligibility, training records)
- Dedicated MemberOps lifecycle dashboard route
- Dedicated MemberOps reports route

### Partial

- Member and Former Member semantic alignment
- Guardian and Program Admin naming alignment
- Household relationship model
- Joining/transfers/departures workflow completeness
- Cross-role MemberOps navigation and UX completeness

### Complete

- Core program/team/season/roster structure
- Core lifecycle transitions (prospect/active/inactive/alumni/archive semantics)
- Guardian-athlete linkage basics (including multiple guardians)
- Staff-scoped edit permission enforcement

---

## RC1 Readiness Assessment

**Readiness: AMBER (Partially Ready)**  
MemberOps has a stable operational core and can support current staff-led roster operations. RC1 gaps are concentrated in lifecycle taxonomy completeness, family/compliance depth, and dedicated reporting/navigation surfaces.

---

## Recommended RC1 Roadmap (Prioritized)

### P0 — RC1 Blockers

1. Add explicit Applicant-stage operational policy (no schema rewrite required in RC1; can be process + UI guardrails first).
2. Define and implement Volunteer role policy (permissions + visibility matrix).
3. Ship dedicated MemberOps lifecycle and reports routes from existing planned navigation placeholders.

### P1 — RC1 Stabilizers

4. Add emergency-contact support (minimum viable contact semantics and visibility rules).
5. Publish role/lifecycle terminology normalization guide (Guardian/Program Admin/Former Member mapping).
6. Formalize departure/offboarding playbook combining roster removal + lifecycle transitions.

### P2 — Post-RC1 Structured Expansion

7. Introduce qualifications domain (certifications, eligibility, training records) with scoped policy model.
8. Evolve pairwise guardian links toward optional household grouping when explicit requirements are approved.

---

## MEM-AUDIT Test Catalog (MEM-AUDIT-001 through MEM-AUDIT-050)

| ID | Area | Scenario |
| --- | --- | --- |
| MEM-AUDIT-001 | Lifecycle | Create person as Prospect and verify status persistence. |
| MEM-AUDIT-002 | Lifecycle | Create person as Active and verify default visibility behavior. |
| MEM-AUDIT-003 | Lifecycle | Create person as Inactive and verify status badge rendering. |
| MEM-AUDIT-004 | Lifecycle | Create person as Alumni and verify status badge rendering. |
| MEM-AUDIT-005 | Lifecycle | Create person as Former Member (Archived) and verify label display. |
| MEM-AUDIT-006 | Lifecycle | Activate Prospect -> Active transition succeeds. |
| MEM-AUDIT-007 | Lifecycle | Activate Inactive -> Active transition succeeds. |
| MEM-AUDIT-008 | Lifecycle | Activate Alumni -> Active transition succeeds. |
| MEM-AUDIT-009 | Lifecycle | Block invalid activation from Active status. |
| MEM-AUDIT-010 | Lifecycle | Mark Active member as Inactive and verify data retention. |
| MEM-AUDIT-011 | Lifecycle | Archive Prospect and verify record remains queryable. |
| MEM-AUDIT-012 | Lifecycle | Block invalid deactivation from Archived state. |
| MEM-AUDIT-013 | Family | Link one guardian to athlete and verify relationship display. |
| MEM-AUDIT-014 | Family | Link multiple guardians to same athlete and verify all links persist. |
| MEM-AUDIT-015 | Family | Edit guardian relationship type and verify update. |
| MEM-AUDIT-016 | Family | Verify guardian details hidden for non-staff role contexts. |
| MEM-AUDIT-017 | Family | Verify guardian diagnostics visible for authorized staff roles. |
| MEM-AUDIT-018 | Family | Confirm emergency-contact indicators remain deferred/not modeled. |
| MEM-AUDIT-019 | Family | Confirm no household aggregate entity/workflow exists. |
| MEM-AUDIT-020 | Family | Validate duplicate guardian-athlete relationship prevention. |
| MEM-AUDIT-021 | Program/Team | Create program and verify org-scoped uniqueness constraints. |
| MEM-AUDIT-022 | Program/Team | Create team under program and verify assignment. |
| MEM-AUDIT-023 | Program/Team | Create season under program and verify assignment. |
| MEM-AUDIT-024 | Program/Team | Add roster membership (athlete) to team/season. |
| MEM-AUDIT-025 | Program/Team | Add roster membership (coach) to team/season. |
| MEM-AUDIT-026 | Program/Team | Prevent duplicate roster membership for same team/season/person. |
| MEM-AUDIT-027 | Program/Team | Remove roster membership and verify success feedback. |
| MEM-AUDIT-028 | Program/Team | Validate season filter reflects selected season roster only. |
| MEM-AUDIT-029 | Program/Team | Execute season rollover and verify expected membership carry-forward. |
| MEM-AUDIT-030 | Program/Team | Verify roster readiness indicators compute without errors. |
| MEM-AUDIT-031 | Roles | Assign Athlete role and verify scoped assignment record. |
| MEM-AUDIT-032 | Roles | Assign Guardian (Parent/Guardian) role and verify visibility. |
| MEM-AUDIT-033 | Roles | Assign Coach role and verify write permissions by scope. |
| MEM-AUDIT-034 | Roles | Assign Program Director as Program Admin equivalent and verify policy mapping. |
| MEM-AUDIT-035 | Roles | Assign Organization Admin and verify full org mutation access. |
| MEM-AUDIT-036 | Roles | Confirm Volunteer role is unavailable in role assignment flows. |
| MEM-AUDIT-037 | Permissions | Verify unauthorized role cannot create person. |
| MEM-AUDIT-038 | Permissions | Verify unauthorized role cannot edit guardian relationship. |
| MEM-AUDIT-039 | Permissions | Verify scope mismatch blocks team/program mutations. |
| MEM-AUDIT-040 | Permissions | Verify organization admin override works for scoped actions. |
| MEM-AUDIT-041 | Enrollment | Join workflow: create person + add initial roster membership. |
| MEM-AUDIT-042 | Enrollment | Transfer workflow: move member within same program season. |
| MEM-AUDIT-043 | Enrollment | Transfer workflow: move member across valid team/program/season selections. |
| MEM-AUDIT-044 | Enrollment | Block transfer when target membership already exists. |
| MEM-AUDIT-045 | Enrollment | Departure workflow: remove roster membership then mark inactive. |
| MEM-AUDIT-046 | Enrollment | Departure workflow: archive member and retain historical records. |
| MEM-AUDIT-047 | Enrollment | Reactivation workflow after inactive status returns to active. |
| MEM-AUDIT-048 | Navigation | Verify MemberOps nav visibility by ADMIN/PROGRAM_MANAGER/COACH roles. |
| MEM-AUDIT-049 | Navigation | Confirm planned lifecycle/report routes show planned status and are not navigable. |
| MEM-AUDIT-050 | Navigation | Validate role-specific sidebar output remains consistent with access-control policy. |

