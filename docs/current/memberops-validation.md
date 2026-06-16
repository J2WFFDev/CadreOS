# MemberOps Validation

## ARC-MEMBER-01 — MemberOps Gap Reconciliation and Role Testing

Status: completed validation pass; merged in PR #382.

ARC-MEMBER-01 reconciles the older Arc 26A RC1 gap assessment with the later Arc 26E role-experience validation. The current state is that MemberOps foundations are present, but several full workflow surfaces remain future work.

Sources reviewed:

- `docs/current/roadmap.md`
- `docs/current/arc-log.md`
- `docs/current/open-issues.md`
- `docs/product/CURRENT_PRODUCT_DECISIONS.md`
- `planning/ARC_26A_MEMBEROPS_RC1_GAP_ASSESSMENT_AND_CAPABILITY_AUDIT.md`
- `planning/ARC_26E_MEMBEROPS_ROLE_EXPERIENCE_PERMISSIONS_AND_OPERATIONAL_VALIDATION.md`
- `docs/planning/arc-24c-memberops-scoped-assignment-model.md`

## Capability Reconciliation

| Area | Current state | Notes |
| --- | --- | --- |
| Member lifecycle labels | Implemented foundation | Prospect, Applicant, Active Member, Inactive Member, Former Member, Former Member (Archived), and Alumni are represented in current helpers and enum usage. |
| Programs, teams, seasons, rosters | Implemented foundation | Current routes and tests cover core Program, Team, Season, and roster surfaces. |
| Role taxonomy | Partial | Organization Admin, Program Director, Coach, Assistant Coach, Parent/Guardian, and Athlete exist in the model. Volunteer is a staffing role, not a standalone auth persona. Program Manager is the app-role label for program-admin experience. General Manager and specialty roles remain out of current scope. |
| Role assignment guardrails | Implemented foundation | Current role assignment routes enforce role/scope compatibility and block athletes from elevated staff roles. Organization-scope assignments remain outside the person workflow. Program-to-team outline selection and multi-select assignment workflows remain future work. |
| MemberOps navigation | Implemented current surface | MemberOps navigation is staff-only for Admin, Program Manager, and Coach. Active entries are Programs, Members, Teams, Membership Lifecycle, and Member Reports. |
| Guardian and household model | Partial | Guardian relationships are pairwise and can represent emergency contacts. There is no separate household aggregate entity. Guardian access must remain derived from related athlete relationships and active scope. |
| Emergency contacts | Implemented as relationship role | Emergency Contact exists as a Guardian relationship role, not as a separate emergency-contact domain. |
| Qualifications, certifications, eligibility | Implemented foundation with aligned scoped person-record policy | Current routes and tests cover definitions and person-level records. ARC-MEMBER-02 aligned app-role helper and backend scoped permission policy for person qualification/certification assignment and update actions. |
| Staffing and Volunteer | Implemented foundation | Volunteer is represented as a staffing category/default staffing role. It is not a login/auth role. |
| Joining, transfers, departures, offboarding | Partial | Current member creation, lifecycle update, roster, and move routes cover pieces of the workflow. A consolidated operational lifecycle workflow remains future work. |
| Dedicated MemberOps lifecycle route | Implemented read-only foundation | `/member-ops/lifecycle` is active for staff-scoped MemberOps users and shows existing lifecycle status counts, status filtering, role/roster context, timestamps, and links to existing person detail. It does not automate joining, transfer, departure, or offboarding workflows. |
| Dedicated MemberOps reports route | Implemented read-only foundation | `/member-ops/reports` is active for staff-scoped MemberOps users and shows existing member totals, lifecycle counts, role/person-type counts, roster/program/team coverage, and qualification/certification summaries where safely available. Advanced analytics, exports, BI, and automation remain future work. |
| Guardian-derived team visibility | Partial foundation | Guardian-derived scope helpers exist and tests cover active athlete relationship scope. Product-owner confirmation is still needed before broadening MemberOps visibility. |
| Duplicate athlete-in-program control | Implemented route/service guardrail with future model-wide limits | ARC-MEMBER-03 consolidates duplicate roster checks into a shared guardrail. Exact team/season duplicates are blocked, and Athlete same-program/same-season duplicates across teams are blocked in current roster add/move paths. Full first-class program participation remains future work. |
| First-class program participation | Missing/planned | Program participation independent of team membership or role assignment remains future work. |

## Role Validation Matrix

| Role / persona | MemberOps nav | Read MemberOps surfaces | Mutate people/lifecycle/roles | Guardian relationship scope | Qualification/staffing scope | Current conclusion |
| --- | --- | --- | --- | --- | --- | --- |
| Organization Admin | Visible | Organization-wide | Allowed broadly | Organization-wide | Allowed broadly | Current intended admin authority. |
| Program Manager / Program Director | Visible | Program-scoped | Intended program authority | Program-scoped | Person qualification/certification assignment and update allowed in resolved scope | Current product role exists; backend enforcement remains scoped production authority. |
| Coach | Visible | Team/program-scoped | Limited operational actions | Team/program-scoped | Person qualification/certification assignment and update allowed in resolved scope | Navigation visibility is separate from action authority. |
| Guardian | Hidden | Derived related-athlete access only | Blocked from MemberOps mutations | Derived from related athlete relationship | Not allowed | No broad Guardian MemberOps visibility. |
| Athlete | Hidden | Self/athlete-facing access only | Blocked from MemberOps mutations and elevated staff assignment | Not applicable | Not allowed | Athlete elevated-role hard-block is implemented. |
| Limited viewer / unauthenticated | Hidden | Not allowed | Not allowed | Not applicable | Not allowed | No MemberOps authority. |
| Dev Persona | Depends on selected app role | Mirrors selected app role in dev flows | May use app-role helper behavior | Dev-only behavior | Dev-only behavior | Do not use Dev Persona behavior as proof of production backend permission scope. |

## Confirmed Remaining Gaps

- Member Reports and Membership Lifecycle now have active read-only foundations. Advanced reports/exports, BI, and consolidated lifecycle automation remain future work.
- Volunteer remains a staffing role, not a standalone auth persona.
- General Manager and specialty MemberOps role taxonomy remain out of current scope.
- Pairwise Guardian relationships remain the household model; no household aggregate exists.
- Emergency Contact exists as a Guardian relationship role, not a separate emergency-contact entity/workflow.
- Program-to-team outline selection, multi-select assignment, and first-class program participation remain future work.
- Joining, transfer, departure, and offboarding flows are not yet consolidated into a single lifecycle workflow.
- Full model-wide program participation remains future work. Current roster add/move paths enforce duplicate team/season membership protection and Athlete same-program/same-season duplicate protection.

## Validation Notes

Existing focused tests cover the current MemberOps foundations:

- `tests/member-ops/naming.test.ts`
- `tests/member-ops/guardian-derived-scope.test.ts`
- `tests/member-ops/qualification-eligibility.test.ts`
- `tests/member-ops/role-experience-permissions.test.ts`
- `tests/member-ops/staffing-foundation.test.ts`
- `tests/navigation/nav-sidebar.test.ts`

ARC-MEMBER-01 did not add product scope or broaden permissions. Confirmed gaps are documentation outcomes for product-owner decision, not committed implementation work.

ARC-MEMBER-02 aligned the confirmed qualification/certification permission-policy mismatch. Backend scoped permission checks remain production authority, and Dev Persona helper behavior is not proof of production authorization by itself.

ARC-MEMBER-03 consolidated duplicate roster membership guardrails. It did not create first-class program participation, lifecycle routes, reports routes, new permissions, or navigation changes.

ARC-MEMBER-04 activates the dedicated MemberOps lifecycle route as a read-only foundation. It reuses existing lifecycle statuses, scoped staff visibility, person detail links, and role/roster context. It does not create full joining, transfer, departure, offboarding, reports, household, or program participation workflows.

ARC-MEMBER-05 activates the dedicated MemberOps reports route as a read-only foundation. It reuses existing MemberOps data and scoped staff visibility. It does not create advanced analytics, exports, BI, schema, workflow automation, household, or program participation workflows.
