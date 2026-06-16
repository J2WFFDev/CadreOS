# MemberOps Validation

## ARC-MEMBER-01 — MemberOps Gap Reconciliation and Role Testing

Status: completed validation pass; pending merge.

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
| MemberOps navigation | Implemented current surface; planned routes remain | MemberOps navigation is staff-only for Admin, Program Manager, and Coach. Active entries are Programs, Members, and Teams. Dedicated Lifecycle and Member Reports entries remain planned/disabled. |
| Guardian and household model | Partial | Guardian relationships are pairwise and can represent emergency contacts. There is no separate household aggregate entity. Guardian access must remain derived from related athlete relationships and active scope. |
| Emergency contacts | Implemented as relationship role | Emergency Contact exists as a Guardian relationship role, not as a separate emergency-contact domain. |
| Qualifications, certifications, eligibility | Implemented foundation with permission follow-up | Current routes and tests cover definitions and person-level records. The app-role helper and backend scoped permission matrix currently disagree on selected Program Manager and Coach qualification actions; this is tracked as a confirmed follow-up. |
| Staffing and Volunteer | Implemented foundation | Volunteer is represented as a staffing category/default staffing role. It is not a login/auth role. |
| Joining, transfers, departures, offboarding | Partial | Current member creation, lifecycle update, roster, and move routes cover pieces of the workflow. A consolidated operational lifecycle workflow remains future work. |
| Dedicated MemberOps lifecycle route | Missing/planned | `/member-ops/lifecycle` is represented as a planned navigation target, not an active route. |
| Dedicated MemberOps reports route | Missing/planned | `/member-ops/reports` is represented as a planned navigation target. The generic reporting surface remains separate. |
| Guardian-derived team visibility | Partial foundation | Guardian-derived scope helpers exist and tests cover active athlete relationship scope. Product-owner confirmation is still needed before broadening MemberOps visibility. |
| Duplicate athlete-in-program control | Partial | Current routes prevent several duplicate assignment cases, but a full model-wide duplicate athlete/program policy remains future work. |
| First-class program participation | Missing/planned | Program participation independent of team membership or role assignment remains future work. |

## Role Validation Matrix

| Role / persona | MemberOps nav | Read MemberOps surfaces | Mutate people/lifecycle/roles | Guardian relationship scope | Qualification/staffing scope | Current conclusion |
| --- | --- | --- | --- | --- | --- | --- |
| Organization Admin | Visible | Organization-wide | Allowed broadly | Organization-wide | Allowed broadly | Current intended admin authority. |
| Program Manager / Program Director | Visible | Program-scoped | Intended program authority | Program-scoped | Permission matrix follow-up needed for selected actions | Current product role exists, but app-role and backend scoped policies need alignment. |
| Coach | Visible | Team/program-scoped | Limited operational actions | Team/program-scoped | Permission matrix follow-up needed for qualification actions | Navigation visibility is separate from action authority. |
| Guardian | Hidden | Derived related-athlete access only | Blocked from MemberOps mutations | Derived from related athlete relationship | Not allowed | No broad Guardian MemberOps visibility. |
| Athlete | Hidden | Self/athlete-facing access only | Blocked from MemberOps mutations and elevated staff assignment | Not applicable | Not allowed | Athlete elevated-role hard-block is implemented. |
| Limited viewer / unauthenticated | Hidden | Not allowed | Not allowed | Not applicable | Not allowed | No MemberOps authority. |
| Dev Persona | Depends on selected app role | Mirrors selected app role in dev flows | May use app-role helper behavior | Dev-only behavior | Dev-only behavior | Do not use Dev Persona behavior as proof of production backend permission scope. |

## Confirmed Remaining Gaps

- Dedicated MemberOps lifecycle and Member Reports routes remain planned, not active.
- Volunteer remains a staffing role, not a standalone auth persona.
- General Manager and specialty MemberOps role taxonomy remain out of current scope.
- Pairwise Guardian relationships remain the household model; no household aggregate exists.
- Emergency Contact exists as a Guardian relationship role, not a separate emergency-contact entity/workflow.
- Program-to-team outline selection, multi-select assignment, and first-class program participation remain future work.
- Joining, transfer, departure, and offboarding flows are not yet consolidated into a single lifecycle workflow.
- Duplicate athlete/program protections are partial and route-level, not a complete model-wide policy.
- The app-role access helper and backend scoped permission matrix disagree for selected Program Manager and Coach MemberOps actions, especially qualification/certification workflows. This should be resolved before treating those actions as validated production role behavior.

## Validation Notes

Existing focused tests cover the current MemberOps foundations:

- `tests/member-ops/naming.test.ts`
- `tests/member-ops/guardian-derived-scope.test.ts`
- `tests/member-ops/qualification-eligibility.test.ts`
- `tests/member-ops/role-experience-permissions.test.ts`
- `tests/member-ops/staffing-foundation.test.ts`
- `tests/navigation/nav-sidebar.test.ts`

ARC-MEMBER-01 did not add product scope or broaden permissions. Confirmed gaps are documentation outcomes for product-owner decision, not committed implementation work.
