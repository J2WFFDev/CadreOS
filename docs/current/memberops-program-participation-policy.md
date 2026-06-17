# MemberOps Program Participation Policy

## ARC-MEMBER-06 — First-Class Program Participation Policy Decision

Status: completed recommendation; merged in PR #387.

ARC-MEMBER-06 reviewed the current MemberOps implementation and documents the
policy recommendation for first-class program participation before any schema,
workflow, permission, Guardian visibility, duplicate guardrail, report, or
lifecycle-route behavior changes.

## Current Program Participation Behavior

Program participation is not first-class in the current build. There is no
dedicated program-participation model, status, lifecycle date, source, audit
trail, or uniqueness rule independent of roles and roster memberships.

Current program participation is derived from these existing records:

- `RoleAssignment.programId`
- `RoleAssignment.team.programId`
- `RosterMembership.team.programId`
- staff scope resolved from allowed program and team context

Current MemberOps surfaces use that derived context as follows:

| Domain | Current behavior |
| --- | --- |
| People and member context | Program context is inferred from scoped role assignments and roster memberships. |
| Lifecycle route | `/member-ops/lifecycle` reads lifecycle status plus role and roster context; it does not maintain a separate program-participation lifecycle. |
| Reports route | `/member-ops/reports` derives program/team coverage from role assignments and team roster memberships. |
| Duplicate guardrails | Athlete same-program/same-season duplicate protection is enforced for current roster add/move paths by comparing roster team program and season context. |
| Guardian-derived access | Guardian app access remains relationship-derived from active athlete-guardian relationships. Staff-facing Guardian diagnostics still use staff scope from roles/rosters where relevant. |
| Permissions | Backend scoped permission checks remain the production authority. Navigation visibility and Dev Persona helper behavior are not permission sources. |

This approach is acceptable for the current foundation because existing
workflows are still anchored to roles, rosters, teams, seasons, and person
lifecycle status. It becomes strained when CadreOS needs program-level
membership independent of a team roster slot or staff/athlete role assignment.

## What Depends On This Boundary

The program-participation boundary affects:

- member lifecycle workflows
- joining, transfer, departure, and offboarding flows
- reports and coverage summaries
- duplicate athlete/program guardrails
- Guardian-derived visibility policy
- program-level membership outside a team roster
- future eligibility and readiness reporting
- future bulk import, export, analytics, and operational audit needs

## Policy Options

### Option A: Continue Deriving Program Participation From Roles And Rosters

Benefits:

- No schema, migration, route, permission, or workflow risk.
- Preserves all current MemberOps behavior.
- Keeps current duplicate guardrails and reports aligned with implemented data.
- Lowest short-term implementation cost.

Risks:

- Program-level membership remains implicit and can drift across features.
- Lifecycle workflows cannot express program joining, transfer, departure, or
  offboarding independently from team roster and role records.
- Reports can only summarize inferred coverage, not authoritative program
  participation.
- Duplicate guardrails remain tied to roster paths rather than a model-wide
  participation policy.
- Guardian visibility policy cannot safely rely on program membership until a
  first-class policy exists.

Affected files/domains:

- `prisma/schema.prisma`
- `lib/member-ops.ts`
- `lib/member-ops-duplicate-guardrails.ts`
- `lib/member-ops-reports.ts`
- `lib/permissions`
- `app/(dashboard)/people`
- `app/(dashboard)/member-ops/lifecycle`
- `app/(dashboard)/member-ops/reports`
- Guardian relationship and staff-scope helpers

Testing implications:

- Continue focused tests around current role, roster, report, lifecycle,
  duplicate guardrail, and Guardian relationship behavior.
- No new model-wide program participation tests are possible because the model
  does not exist.

Domain impacts:

| Domain | Impact |
| --- | --- |
| Lifecycle workflows | Continue showing person lifecycle plus role/roster context; no program-membership lifecycle. |
| Reports | Continue inferred program/team coverage from roles and rosters. |
| Duplicate guardrails | Continue current roster add/move path guardrails only. |
| Guardian visibility | No change; keep relationship-derived access. |
| Schema | No schema or migration changes. |

### Option B: Add First-Class Program Participation Later

Benefits:

- Allows a focused implementation arc with explicit product-owner approval.
- Gives CadreOS a place to define authoritative program membership, lifecycle
  status, start/end dates, source, and audit semantics.
- Lets reports, lifecycle workflows, and duplicate guardrails migrate
  deliberately rather than all at once.
- Preserves current Guardian visibility and permission boundaries until the new
  participation policy is explicitly integrated.
- Avoids adding schema inside a documentation/policy arc.

Risks:

- The current role/roster proxy remains in use until the implementation arc is
  complete.
- The implementation arc must resolve migration, backfill, uniqueness, status,
  and read-path compatibility questions.
- Product must decide whether program participation is season-bound,
  evergreen, or both.

Affected files/domains:

- Schema and migrations in a future implementation arc.
- MemberOps people, lifecycle, reports, duplicate guardrails, and permission
  helpers.
- Guardian relationship policy only after a separate visibility decision.
- Future lifecycle workflow, transfer, departure, and offboarding surfaces.

Testing implications:

- Add model/service tests for participation creation, status transitions,
  uniqueness, and backfill behavior.
- Add focused read-path tests proving current role/roster behavior remains
  compatible during migration.
- Add negative tests proving Guardian visibility and role permissions do not
  broaden automatically.

Domain impacts:

| Domain | Impact |
| --- | --- |
| Lifecycle workflows | Future arc can add authoritative program membership status before automation. |
| Reports | Future arc can add read integration after compatibility/backfill policy is defined. |
| Duplicate guardrails | Future arc can define model-wide uniqueness before migrating current roster guardrails. |
| Guardian visibility | No automatic change; any visibility use needs a separate explicit decision. |
| Schema | Future schema and migration work required, gated by product-owner confirmation. |

### Option C: Add First-Class Program Participation Now

Benefits:

- Resolves the proxy model immediately.
- Creates an authoritative record for program membership and lifecycle
  workflows.
- Gives future reports and duplicate guardrails a cleaner source of truth.

Risks:

- Too broad for ARC-MEMBER-06 and likely to cross schema, migrations, reports,
  lifecycle workflows, permissions, duplicate guardrails, and Guardian
  visibility.
- High risk of accidentally changing production behavior without product-owner
  decisions on status vocabulary, season semantics, migration/backfill, and
  visibility policy.
- Could imply lifecycle automation or Guardian visibility changes that are
  explicitly out of scope.

Affected files/domains:

- Most MemberOps model, route, helper, report, lifecycle, duplicate-guardrail,
  and permission surfaces.
- Potentially Guardian relationship and access helpers.

Testing implications:

- Requires a broad implementation test plan and likely full build/typecheck
  validation, not documentation-only validation.

Domain impacts:

| Domain | Impact |
| --- | --- |
| Lifecycle workflows | Would force immediate lifecycle policy decisions and risk implying automation. |
| Reports | Would require immediate report source-of-truth decisions and compatibility work. |
| Duplicate guardrails | Would require immediate model-wide guardrail migration decisions. |
| Guardian visibility | Could accidentally broaden access unless separately constrained. |
| Schema | Requires schema, migration, backfill, and compatibility decisions now. |

## Recommendation

Recommend **Option B: Add first-class program participation later**.

Current build state should continue deriving program participation from roles
and roster memberships. The next implementation arc should be product-owner
confirmed and limited to a Program Participation Model Foundation before
workflow automation or visibility broadening.

Recommended next arc:

`ARC-MEMBER-07 — Program Participation Model Foundation`

Suggested initial boundaries for that arc:

- define the minimal first-class participation model and status policy
- decide whether participation is season-bound, evergreen, or both
- define uniqueness and backfill behavior from current role/roster data
- preserve current reports, lifecycle route, duplicate guardrails, Guardian
  visibility, and role permissions until explicitly migrated
- add focused tests for model/service behavior and no-broadening guarantees

Future roadmap work after the foundation should cover lifecycle automation,
joining, transfer, departure, offboarding, report expansion, import/export, and
any Guardian visibility use of program participation. Release 2 work should
continue to hold bulk import, advanced analytics, BI, and automation-heavy
orchestration unless explicitly reprioritized.

## ARC-MEMBER-07 — Program Participation Model Foundation

Status: implemented foundation; pending merge.

ARC-MEMBER-07 implements the selected Option B foundation. First-class program
participation now has a minimal schema foundation that coexists with existing
role and roster behavior.

Implemented:

- `ProgramParticipationStatus` with Active and Inactive foundation states.
- `ProgramParticipation` linking organization, person, program, and optional
  season.
- Partial unique database indexes that distinguish evergreen participation
  from season-bound participation so nullable `seasonId` does not allow exact
  duplicate rows.
- Pure helper coverage for deriving program participation candidates from
  roles/rosters, merging explicit and derived context, detecting exact
  duplicate participation, and checking program scope overlap.
- Read-only reports/lifecycle inclusion for explicit program participation
  where it is already visible through staff program scope.

Not implemented:

- Program participation management UI.
- Automatic backfill from existing roles or rosters.
- Lifecycle workflow automation.
- Joining, transfer, departure, or offboarding workflows.
- Duplicate guardrail migration from roster paths to participation paths.
- Guardian visibility broadening.
- Athlete permission broadening.
- Reports/export/BI expansion beyond existing read-only report coverage.

Current read behavior:

- Existing role and roster-derived context remains valid.
- Explicit program participation is additive and does not replace roles or
  rosters.
- Reports count distinct people per represented program across explicit,
  role-derived, and roster-derived context without double-counting one person
  in the same program.
- Lifecycle context can display explicit participation alongside existing role
  and roster context.

Backfill/migration handling:

- No destructive backfill is run in ARC-MEMBER-07.
- Existing role and roster records remain the current operational source for
  current workflows until a future migration/backfill arc is explicitly scoped.
- Future backfill should derive candidate participation rows from
  `RoleAssignment.programId`, `RoleAssignment.team.programId`, and
  `RosterMembership.team.programId`, then review season semantics before
  writing rows.

Recommended next arc:

`ARC-MEMBER-08 — Program Participation Management and Backfill Policy`

Suggested boundaries for the next arc:

- define authorized create/update/archive behavior for explicit participation
- decide and implement safe backfill rules from current role/roster data
- add a narrow management surface only if product-owner approved
- keep Guardian visibility relationship-derived unless separately decided
- keep lifecycle automation and full joining/transfer/departure/offboarding
  workflows future roadmap work
