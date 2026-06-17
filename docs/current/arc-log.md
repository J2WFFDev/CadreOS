# Current Arc Log

## Arc Naming Convention Going Forward

New work uses the simplified naming pattern:

`ARC-[DOMAIN]-[NN] — Title`

Examples include `ARC-ENTRY-07`, `ARC-HABIT-03`, `ARC-UI-01`, and
`ARC-DOCS-01`. Domain identifiers describe the primary work area, and the
two-digit number provides a readable sequence within that domain.
Current domain vocabulary includes CORE, MEMBER, ENTRY, JOURNAL, HABIT, GEAR,
FIELD, RESOURCE, ADMIN, LIVE, UI, DOCS, and TEST.

Older labels such as Arc 24D, Arc 25, Arc 26, UI.0-A, and UI.1 remain valid
historical implementation references for prior PRs and planning documents.
They are not the forward naming scheme. New prompts should include both labels
only when an old-to-new mapping is useful for traceability.

### Recent Old-To-New Crosswalk

| Simplified arc | Historical reference | Current status |
| --- | --- | --- |
| ARC-HABIT-01 — Habit Management Foundation | Arc 24D.8T | Completed / merged |
| ARC-HABIT-02 — Habit Terminology, Ownership, and Lifecycle Cleanup | Arc 24D.8T-A | Completed / merged |
| ARC-HABIT-03 — My Habits Scope and Guardian Summary | Arc 24D.8T-B | Completed / merged |
| ARC-UI-01 — Header Account Name Display | UI.0-A | Completed / merged |
| ARC-UI-02 — Collapsible Sidebar and Independent Scrolling | UI.1 | Completed / merged |
| ARC-ENTRY-07 — Relationship Labels and Direction Semantics | Recommended follow-up to Arc 24D.9A; formerly proposed as Arc 24D.9B | Completed / merged |
| ARC-DOCS-01 — Roadmap and Arc Naming Reconciliation | No historical label | Completed / merged |
| ARC-MEMBER-01 — MemberOps Gap Reconciliation and Role Testing | Reconciles Arc 26A and Arc 26E MemberOps status | Completed / merged |
| ARC-MEMBER-02 — Align MemberOps Role Permission Policy | Follow-up to ARC-MEMBER-01 confirmed permission mismatch | Completed / merged |
| ARC-MEMBER-03 — MemberOps Duplicate Athlete/Program Guardrails | Follow-up to ARC-MEMBER-01 duplicate athlete/program gap | Completed / merged |
| ARC-MEMBER-04 — MemberOps Lifecycle Route Foundation | Follow-up to ARC-MEMBER-01 dedicated lifecycle route gap | Completed / merged |
| ARC-MEMBER-05 — MemberOps Reports Foundation | Follow-up to ARC-MEMBER-01 dedicated reports route gap | Completed / merged |
| ARC-MEMBER-06 — First-Class Program Participation Policy Decision | Follow-up to MemberOps first-class program participation gap | Completed / merged |
| ARC-MEMBER-07 — Program Participation Model Foundation | Follow-up to ARC-MEMBER-06 selected recommendation | Completed / merged |
| ARC-MEMBER-08 — Program Participation Management and Backfill Policy | Follow-up to ARC-MEMBER-07 foundation gaps | Completed / pending merge |

Recent historical arcs without an assigned simplified identifier keep their
old labels until a future documentation reconciliation assigns one.

## Concise Completed Arc Summary

| Arc area | Current documented status | Detail |
| --- | --- | --- |
| Operational Foundation / Core MVP | Closed / implemented | [`planning/README.md`](../../planning/README.md) |
| FieldOps MVP | Closed | [`planning/PHASE_6K_FIELDOPS_MVP_CLOSEOUT.md`](../../planning/PHASE_6K_FIELDOPS_MVP_CLOSEOUT.md) |
| GearOps MVP and later validation | Closed / later hardening delivered | [`planning/PHASE_16I_GEAROPS_MVP_CLOSEOUT.md`](../../planning/PHASE_16I_GEAROPS_MVP_CLOSEOUT.md), [`planning/ARC_25F_GEAROPS_ROLE_EXPERIENCE_APPROVALS_OPERATIONAL_VALIDATION.md`](../../planning/ARC_25F_GEAROPS_ROLE_EXPERIENCE_APPROVALS_OPERATIONAL_VALIDATION.md) |
| Arc 21 MemberOps / roster lifecycle | Marked complete | [`planning/README.md`](../../planning/README.md) |
| Arc 22A-22G Entry Completion | Marked complete | [`planning/README.md`](../../planning/README.md) |
| Arc 23A-23E, 23I Journals/Habits/Entry consolidation | Marked complete | [`planning/README.md`](../../planning/README.md) |
| Arc 24D.8Q-C All Entries, Guardian Lists, and movement validation | Completed / merged | [`Arc 24D.8Q-C`](../planning/arc-24d-8q-c-all-entries-guardian-lists-validation.md) |
| Arc 24D.8Q-D Guardian grouping, context labels, destinations, and active Habits | Completed / merged | PR #365 |
| Arc 24D.8R Journal workflow/access UX | Completed / merged | Journal workflow, visibility, and reopen behavior |
| Arc 24D.8U Creator/Owner/Author/Assignee terminology cleanup | Completed / merged | User-facing label, helper-text, test, and documentation normalization without policy changes |
| Arc 24D.8S EntryOps archive, restore, active state, and lifecycle cleanup | Completed / merged | [`Arc 24D.8S`](../planning/arc-24d-8s-entryops-lifecycle-validation.md) |
| Arc 24D.8S-A discoverable Entry archive and restore actions | Completed / merged | [`Arc 24D.8S-A`](../planning/arc-24d-8s-a-discoverable-lifecycle-actions.md) |
| Arc 24D.8S-B owner/creator Entry archive and restore | Completed / pending merge | [`Arc 24D.8S-B`](../planning/arc-24d-8s-b-owner-lifecycle-actions.md) |
| ARC-HABIT-01 — Habit Management Foundation (historical: Arc 24D.8T) | Completed / merged | [`Arc 24D.8T`](../planning/arc-24d-8t-habit-library-foundation.md) |
| ARC-HABIT-02 — Habit Terminology, Ownership, and Lifecycle Cleanup (historical: Arc 24D.8T-A) | Completed / merged | [PR #374](https://github.com/J2WFFDev/CadreOS/pull/374) |
| ARC-HABIT-03 — My Habits Scope and Guardian Summary (historical: Arc 24D.8T-B) | Completed / merged | My Habits actor-subject scoping, Coach/Admin self-creation, and relationship-derived Guardian Habit summary visibility |
| Arc 24D.10.4, 24D.11, 24D.12 | Marked complete | [`planning/README.md`](../../planning/README.md) |
| Arc 25F GearOps role/approval validation | Delivered | [`planning/ARC_25F_GEAROPS_ROLE_EXPERIENCE_APPROVALS_OPERATIONAL_VALIDATION.md`](../../planning/ARC_25F_GEAROPS_ROLE_EXPERIENCE_APPROVALS_OPERATIONAL_VALIDATION.md) |
| GearOps CSV `asset_id` baseline | Fixed / merged | PR #366 |
| Arc 26E MemberOps role/permission validation | Delivered | [`planning/ARC_26E_MEMBEROPS_ROLE_EXPERIENCE_PERMISSIONS_AND_OPERATIONAL_VALIDATION.md`](../../planning/ARC_26E_MEMBEROPS_ROLE_EXPERIENCE_PERMISSIONS_AND_OPERATIONAL_VALIDATION.md) |
| ARC-MEMBER-01 — MemberOps Gap Reconciliation and Role Testing | Completed / merged | [PR #382](https://github.com/J2WFFDev/CadreOS/pull/382), merge `dbf3f35babeb3790bcc8072a5b2b729515b40e0d` |
| ARC-MEMBER-02 — Align MemberOps Role Permission Policy | Completed / merged | [PR #383](https://github.com/J2WFFDev/CadreOS/pull/383), merge `7bcc89e64703c6f2b90060e5b21659b82647c41d` |
| ARC-MEMBER-03 — MemberOps Duplicate Athlete/Program Guardrails | Completed / merged | [PR #384](https://github.com/J2WFFDev/CadreOS/pull/384), merge `ba09a69ff5d94d30055f7948aed639f782df8d3e` |
| ARC-MEMBER-04 — MemberOps Lifecycle Route Foundation | Completed / merged | [PR #385](https://github.com/J2WFFDev/CadreOS/pull/385), merge `43f5f41d272f73e5049135c837921a4ca19705b7` |
| ARC-MEMBER-05 — MemberOps Reports Foundation | Completed / merged | [PR #386](https://github.com/J2WFFDev/CadreOS/pull/386), merge `f62d36df0f9090741734ab465cb508ae4ef72d15` |
| ARC-MEMBER-06 — First-Class Program Participation Policy Decision | Completed / merged | [PR #387](https://github.com/J2WFFDev/CadreOS/pull/387), merge `e1b148f9f4263302ec7ffd479a77e101c1153ff4` |
| ARC-MEMBER-07 — Program Participation Model Foundation | Completed / merged | [PR #388](https://github.com/J2WFFDev/CadreOS/pull/388), merge `74c3f6f4060817e57bbf9eeffed4d92115b71991` |
| ARC-MEMBER-08 — Program Participation Management and Backfill Policy | Completed / pending merge | Adds staff-scoped read-only participation review and non-writing backfill preview helpers |
| ARC-UI-01 — Header Account Name Display (historical: UI.0-A) | Completed / merged | [PR #378](https://github.com/J2WFFDev/CadreOS/pull/378) |
| ARC-UI-02 — Collapsible Sidebar and Independent Scrolling (historical: UI.1) | Completed / merged | PR #368 |
| ARC-ENTRY-07 — Relationship Labels and Direction Semantics | Completed / merged | [PR #380](https://github.com/J2WFFDev/CadreOS/pull/380), merge `d831fe09e31ec6f5168b5ef8144eb498100c82c6` |

## Latest Known Work

The latest merged EntryOps work on `main` includes Arc 24D.8Q-C All Entries,
Guardian Lists, and movement validation; Arc 24D.8R Journal workflow/access
UX; Arc 24D.8Q-D Guardian grouping, context labels, destinations, and active
Habits; ARC-HABIT-02 — Habit Terminology, Ownership, and Lifecycle Cleanup
(historical: Arc 24D.8T-A); and ARC-HABIT-03 — My Habits Scope and Guardian
Summary (historical: Arc 24D.8T-B). The GearOps CSV `asset_id` baseline fix,
ARC-UI-01 — Header Account Name Display (historical: UI.0-A), and
ARC-UI-02 — Collapsible Sidebar and Independent Scrolling (historical: UI.1)
are also merged.

ARC-DOCS-01 — Roadmap and Arc Naming Reconciliation is merged.

ARC-ENTRY-07 — Relationship Labels and Direction Semantics is merged in PR
#380 at merge `d831fe09e31ec6f5168b5ef8144eb498100c82c6`. It standardized
relationship-derived Guardian language around related athletes, Guardians,
Created by, Journal author, Assigned to, Context/List, and Visibility. It
clarified Journal Guardian visibility copy without broadening Journal privacy
and aligned Guardian Summary, Notes, People, prompt assignment comments,
readiness labels, and focused tests with relationship direction semantics.
Permissions, roles, auth, schema, routes, lifecycle, archive/restore, Journal
privacy, Habit behavior, and Dev Persona behavior were preserved.

ARC-ENTRY-07 validation reported by the PR:

- Targeted tests passed, 220 tests.
- `npm run typecheck` passed.
- `git diff --check` passed.

ARC-MEMBER-01 — MemberOps Gap Reconciliation and Role Testing is merged in PR
#382 at merge `dbf3f35babeb3790bcc8072a5b2b729515b40e0d`. It reconciles Arc
26A and Arc 26E by confirming implemented MemberOps foundations and documenting
the remaining gaps in
[`memberops-validation.md`](./memberops-validation.md). It preserves the
current navigation/action-permission separation, does not broaden Guardian
visibility, and does not add permissions, routes, role taxonomy, or product
scope.

ARC-MEMBER-01 validation reported by the PR:

- Focused MemberOps and navigation tests passed.
- `git diff --check` passed.
- No build required for documentation-only changes.

ARC-MEMBER-02 — Align MemberOps Role Permission Policy is merged in PR #383 at
merge `7bcc89e64703c6f2b90060e5b21659b82647c41d`. It makes backend scoped
permission checks the aligned production authority for person
qualification/certification assignment and update actions, while keeping
app-role helper behavior consistent for Program Manager, Coach, Guardian,
Athlete, and limited viewer cases. Guardian and Athlete mutation authority
remains denied, and MemberOps navigation visibility is unchanged.

ARC-MEMBER-03 — MemberOps Duplicate Athlete/Program Guardrails is merged in PR
#384 at merge `ba09a69ff5d94d30055f7948aed639f782df8d3e`. It consolidates
duplicate roster guardrails into shared MemberOps policy code, blocks exact
team/season roster duplicates, blocks Athlete same-program/same-season
duplicates across team roster add/move paths, and preserves valid same-season
source membership transitions.

ARC-MEMBER-04 — MemberOps Lifecycle Route Foundation is merged in PR #385 at
merge `43f5f41d272f73e5049135c837921a4ca19705b7`. It activates
`/member-ops/lifecycle` as a staff-scoped, read-only lifecycle overview using
existing person lifecycle statuses, role assignments, roster memberships, and
scoped staff visibility. It adds summary counts, status filtering, useful
lifecycle table columns, and links to existing person detail. It does not add
lifecycle statuses, full workflow automation, Guardian/Athlete/limited access,
permission broadening, role taxonomy changes, first-class program
participation, household aggregation, or reports scope.

ARC-MEMBER-05 — MemberOps Reports Foundation is merged in PR #386 at merge
`f62d36df0f9090741734ab465cb508ae4ef72d15`. It
activates `/member-ops/reports` as a staff-scoped, read-only reporting overview
using existing people, lifecycle, role, roster, program, team, qualification,
and certification data. It adds summary cards, compact count tables, source
links to existing MemberOps pages, and optional qualification/certification
summaries where schema is available. It does not add exports, advanced
analytics, BI, schema, workflow automation, lifecycle behavior changes,
permission broadening, Guardian/Athlete/limited access, household aggregation,
or first-class program participation.

ARC-MEMBER-06 — First-Class Program Participation Policy Decision is merged in
PR #387 at merge `e1b148f9f4263302ec7ffd479a77e101c1153ff4`. It documents that
current program participation is derived from
role assignment program/team scope and roster membership team program context,
not a first-class participation model. It compares continuing the derived
policy, adding first-class participation later, and adding it now. The
recommendation is to add first-class program participation later through a
product-owner-confirmed Program Participation Model Foundation arc, while the
current build continues to preserve existing reports, lifecycle route,
duplicate guardrails, Guardian visibility, role permissions, schema, and
workflow behavior.

ARC-MEMBER-07 — Program Participation Model Foundation is merged in PR #388 at
merge `74c3f6f4060817e57bbf9eeffed4d92115b71991`. It adds the minimal
`ProgramParticipation` schema foundation with optional season support, partial
unique indexes for evergreen and season-bound exact duplicate protection,
shared helper coverage, and low-risk read-only reports/lifecycle inclusion. It
preserves existing role, roster, Guardian, lifecycle, reports, duplicate
guardrail, and permission behavior. It does not add management UI, automatic
backfill, lifecycle automation, joining/transfer/departure/offboarding
workflows, exports, BI, broad reports, Guardian approval workflows, household
aggregates, or bulk mutation tooling.

ARC-MEMBER-08 — Program Participation Management and Backfill Policy is
complete pending merge. It adds `/member-ops/program-participation` as a
staff-scoped read-only review route for explicit participation records and
adds pure non-writing backfill preview helpers for roster, program-role, and
team-role derived candidates. It documents mutation as policy-blocked because
the backend permission registry does not yet define
`programParticipation.create` or `programParticipation.update`. It does not
broaden Guardian/Athlete access, change role permissions, run automatic
backfill, change roster duplicate guardrails, or add lifecycle automation.

Implemented current behavior includes:

- App context can derive Guardian access from active Guardian relationships
  without requiring a fake direct Guardian role assignment.
- Quick Capture is actor-scoped and does not assign work to a related Athlete.
- Inbox is actor-scoped; organization-wide oversight belongs in All Entries or
  Admin views.
- All Work Items is named All Entries and displays list/context placement.
- Guardian-visible related Athlete personal list context does not broaden
  Entry or Journal visibility.
- Journal Draft/Private/staff-only content remains hidden from Guardians;
  Guardians may read Final/Done Guardian-visible Journals for related athletes.
- Creator/Created by, Journal Author, task Assignee, Context/List, and
  Visibility now use distinct user-facing terminology; Owner transfer remains
  unsupported.
- Default working views exclude archived records; explicit archived views
  preserve actor visibility, and generic Entry restore returns to the recorded
  pre-archive workflow status without changing metadata.
- Habit definitions use separate `Habit` records, recurrence uses
  `HabitSchedule`, and check-ins use `HabitCompletion`. Successful check-ins
  write `HabitActivity` and update `lastCompletedAt`; they do not create Tasks,
  Entries, or separate All Entries rows.
- My Habits is the current created/assigned Habit management surface. Habit
  Library is a future template catalog where users can add known templates.
  My Habits shows Habits whose subject is the current actor, not every Habit
  the actor is authorized to manage. Athlete self-service creation is
  self-only; authorized Coach/Admin users can create for themselves and retain
  assignment capability.
- Normal user-facing Habit lifecycle is Active, Paused, and Archived.
  Completed is not a normal user-facing lifecycle option. Target met, streak,
  completion count, last check-in, cadence, and end date remain
  progress/schedule signals.
- Guardian Habit access derives from the Athlete-Guardian relationship and
  remains summary-only; it does not require a fake direct Guardian role
  assignment. Habit Context/List does not exist in the current model, and
  `assignedToTeamId` is assignment rather than Context/List.

The newest completed product follow-up to Arc 24D.9A Entry Relationships
Foundation Audit is **ARC-ENTRY-07 — Relationship Labels and Direction
Semantics**. The next product arc requires product-owner confirmation.

## Conflicting Or Unclear Status

- `planning/ROADMAP.md` describes Entry, GearOps, and other capabilities as
  unbuilt or deferred, but later arc docs and code show substantial delivery.
- `planning/README.md` names Arc 23F as next, while newer Arc 24D, 25, and 26
  work exists. Arc 23F priority/status **needs product-owner confirmation**.
- Historical arc numbering is not chronological across all workstreams;
  higher-numbered Arc 25/26 docs predate some recent Arc 24D work. These
  labels remain historical references rather than the forward naming scheme.
- Arc 26A listed missing/partial MemberOps capabilities that Arc 26E later
  described as validated. ARC-MEMBER-01 reconciled this into confirmed current
  state and remaining gaps in [`memberops-validation.md`](./memberops-validation.md).
