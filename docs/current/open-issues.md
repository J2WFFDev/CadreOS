# Current Open Issues

Only issues explicitly documented in repository docs are listed here. This is
not a claim that every issue is reproducible in current code.

## EntryOps

- Inbox routing cleanup for stale or unavailable routing rows remains deferred.
- Dependent-athlete Quick Capture assignment for guardians remains deferred.
- Relationship semantics can duplicate or drift across `EntryLink`,
  `EntryObjectLink`, `OperationalRelationship`, parent links, and follow-up
  relationships.
- Generic graph read visibility needs stronger test coverage after
  ARC-ENTRY-07 normalized user-facing relationship direction labels.
Sources: [`Arc 24D.8S`](../planning/arc-24d-8s-entryops-lifecycle-validation.md),
[`Arc 24D.8X-N`](../planning/arc-24d-8x-n-owner-assignee-lifecycle-controls.md),
[`Arc 24D.8X-O`](../planning/arc-24d-8x-o-fix-inbox-lists-owner-visibility.md),
and [`Arc 24D.9A`](../planning/arc-24d-9a-entry-relationships-foundation-audit.md).

## EntryOps Policy Boundaries To Preserve

- Creator/Created by is immutable system history in current workflows; Owner
  transfer is not implemented.
- Journal Author is Journal-specific and must not be treated as assignment.
- Program/Team list placement must not grant Entry visibility or assignment.
- Guardian-related Athlete list visibility must not expose unrelated members.
- Habit definitions, recurrence, check-ins, and activity remain separate
  `Habit`, `HabitSchedule`, `HabitCompletion`, and `HabitActivity` records.
  Successful check-ins update `lastCompletedAt`; they do not create Tasks,
  Entries, or separate All Entries rows.
- Habit definitions currently have no Entry Context/List or explicit
  visibility field. The existing team linkage is an assignment field and must
  not be treated as Program/Team Context/List placement.
- Habit Context/List remains desired future work. Program/Team placement must
  not imply visibility, assignment, or fan-out when it is designed.
- Habit Library is a future template catalog; My Habits is the current
  actor-subject Habit management surface. Broader authorized Coach/Admin
  oversight belongs outside My Habits. A future library may offer known
  templates that users can add and authorized staff can assign.
- Guardian Habit visibility derives from the Athlete-Guardian relationship and
  remains summary-only; it must not depend on a fake direct Guardian role
  assignment or expose private completion notes.
- A future lifecycle concept may be needed for routines or goals that are
  achieved or no longer need tracking. This is not implemented; Active,
  Paused, and Archived remain the normal user-facing Habit lifecycle states.
- Tracking units should remain controlled selections rather than unrestricted
  free text. Custom is an explicit selection in the agreed product vocabulary.
- Team recurring Habit assignment/fan-out, Habit compliance dashboards, and
  advanced streak analytics remain deferred.
- Additional Today redesign/integration is future roadmap work, not an implied
  part of current All Entries behavior.

## MemberOps

- ARC-MEMBER-01 resolved the broad Arc 26A / Arc 26E status conflict into the
  current validation matrix. MemberOps foundations are present, while the
  confirmed remaining gaps below still require product-owner selection before
  implementation.
- Member Reports and Membership Lifecycle now have read-only foundations, but
  advanced reports/exports/BI and lifecycle automation remain future work.
- Volunteer remains a staffing role, not a standalone auth persona.
- General Manager and specialty MemberOps role taxonomy remain out of current
  scope.
- Pairwise Guardian relationships remain the household model; no household
  aggregate exists.
- Emergency Contact exists as a Guardian relationship role, not a separate
  emergency-contact entity/workflow.
- Program-to-team outline selection, multi-select assignment, program
  participation mutation UI/service surfaces and backfill execution, and consolidated
  joining/transfer/departure/offboarding workflows remain future work.
  ARC-MEMBER-07 adds the first-class ProgramParticipation foundation, and
  ARC-MEMBER-08 adds a read-only participation review route plus non-writing
  backfill preview helpers. ARC-MEMBER-09 adds backend permission actions for
  ProgramParticipation create/update/status-change. Mutation UI/service
  surfaces, automatic backfill writes, and lifecycle automation remain future
  work.
- ARC-MEMBER-03 consolidated duplicate roster guardrails for current add/move
  paths. Model-wide duplicate guardrail migration to first-class program
  participation remains future work.
- ARC-MEMBER-02 resolved the confirmed app-role helper / backend scoped
  permission mismatch for person qualification/certification assignment and
  update actions.

Sources: [`Arc 24C.1`](../planning/arc-24c-memberops-scoped-assignment-model.md),
[`Arc 26A`](../../planning/ARC_26A_MEMBEROPS_RC1_GAP_ASSESSMENT_AND_CAPABILITY_AUDIT.md),
[`Arc 26E`](../../planning/ARC_26E_MEMBEROPS_ROLE_EXPERIENCE_PERMISSIONS_AND_OPERATIONAL_VALIDATION.md),
[`ARC-MEMBER-01`](./memberops-validation.md), and
[`ARC-MEMBER-06`](./memberops-program-participation-policy.md).

## GearOps And Platform Limits

- Full guardian approval workflow UX/audit capture is bounded or deferred.
- Full native mobile, full offline replication, procurement/accounting,
  predictive maintenance, enterprise rules/schema engines, and advanced BI are
  outside the current GearOps RC scope.
- Offline pending actions remain server-confirmed rather than authoritative
  local state.

Source: [`GearOps Known Limitations`](../product/gear-ops/known-limitations-and-deferred-scope.md).

## Tooling / Build Cleanup

- Prisma `package.json` config deprecation before Prisma 7.
- Two moderate npm audit vulnerabilities.
- npm minor update available.
- Next.js middleware convention deprecated in favor of proxy.

Source: [`Local Agent Validation Baseline`](../dev/local-agent-validation-baseline.md).

## Newly Captured Testing Issues

Add newly reproduced issues here with:

- date and environment
- affected role/workflow
- reproduction steps
- expected and actual behavior
- source issue/PR link
- confirmation status
