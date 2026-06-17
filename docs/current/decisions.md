# Current Decisions

This file consolidates active decisions and points back to their source docs.
When it conflicts with a newer explicit decision, update this file.

## Arc Naming

- New work uses `ARC-[DOMAIN]-[NN] — Title` identifiers.
- Older Arc 24D/25/26, UI, and other legacy labels remain valid historical
  references for prior PRs and planning documents.
- New prompts should include both the simplified and historical labels only
  when an old-to-new mapping is useful for traceability.
- `docs/current/arc-log.md` maintains the current recent-arc crosswalk.

## Product And Module Naming

- CadreOS is an Athlete Program Operating System.
- Sidebar/module taxonomy uses Home, MemberOps, EntryOps,
  FieldOps/ResourceOps, GearOps, and AdminOps/Admin.
- MemberOps is the selected name, not TeamOps or PeopleOps.
- EntryOps remains the active name and is feed/filter/context-first; SignalOps
  is only a possible future name.
- FieldOps and ResourceOps are conceptually separate, although current
  `/field-ops` routes still contain ResourceOps infrastructure.
- GearOps remains its own module.
- Programs and Seasons belong under MemberOps, not AdminOps.
- Volunteer is a MemberOps staffing category/default staffing role, not a
  standalone auth persona.
- The current household model is pairwise Guardian relationships. Do not infer
  a separate household aggregate entity from Guardian or emergency-contact
  language.

Source: [`CURRENT_PRODUCT_DECISIONS.md`](../product/CURRENT_PRODUCT_DECISIONS.md).

## Navigation And Experience

- The approved sidebar taxonomy and order must not be changed incidentally.
- Navigation visibility is separate from action permission.
- Account/Profile should move toward top-right header ownership.
- Build/release identity must be visible in screenshots.
- Admin/operator visibility is a permanent first-class mode; guided/field
  experiences are additive.
- Product experience should be Today-first and role-filtered while remaining
  module-backed.
- All Work Items is named **All Entries**. All Entries is the authorized
  oversight/browse surface and displays each Entry's list/context placement.
- Inbox is always actor-scoped, including for organization admins.
- Quick Capture is actor-scoped and does not provide related-athlete
  assignment. Low-context captures route to the actor's Inbox under current
  routing policy.

Sources: [`Sidebar Taxonomy`](../navigation/sidebar-taxonomy.md),
[`CURRENT_PRODUCT_DECISIONS.md`](../product/CURRENT_PRODUCT_DECISIONS.md), and
[`UI/UX Decision Log`](../product/design-system/ui-ux-decision-log.md).

## Roles, Visibility, And Archive Behavior

- Guardian app visibility is derived from active Guardian relationships;
  unrelated athlete/member data must remain denied.
- Backend scoped permission checks are the production authority for MemberOps
  mutations. App-role helpers and Dev Persona behavior must align with that
  policy but do not replace backend authorization.
- Guardians may see linked Athlete personal list context, but list visibility
  does not grant visibility to every Entry in that list.
- Guardians may read Final/Done Guardian-visible Journals for related athletes.
  Draft, Private, and staff-only Journals remain hidden. Reopen behavior must
  preserve these visibility boundaries.
- Navigation exposure does not grant mutation rights.
- Entry owners can self-edit within bounded policy, while conversion,
  reassignment, ownership changes, cross-person assignment, and scope changes
  remain elevated actions.
- Archive is a preserved lifecycle state, not deletion and not completion.
  Default working views exclude archived records; explicit archived filters
  show archived records within the actor's existing visibility.
- Generic Entry archive and restore use the existing elevated `entry.delete`
  permission or creator self-service lifecycle access. Assignee-only access
  does not grant archive/restore rights.
- Restoring a generic Entry returns it to its recorded pre-archive workflow
  status when available, otherwise Open. Archive and restore preserve Creator,
  Author, Assignee, Context/List, Visibility, and relationships.
- Journal Final/Done and Habit completion activity remain distinct from
  archive. Journal and Habit lifecycle actions keep their existing policies.

Sources: [`Arc 24D.8X-N`](../planning/arc-24d-8x-n-owner-assignee-lifecycle-controls.md)
[`Arc 24D.8S`](../planning/arc-24d-8s-entryops-lifecycle-validation.md), and
[`Arc 26E`](../../planning/ARC_26E_MEMBEROPS_ROLE_EXPERIENCE_PERMISSIONS_AND_OPERATIONAL_VALIDATION.md).

## MemberOps Program Participation

- Program participation now has a minimal first-class foundation through
  `ProgramParticipation`. Current operational behavior still preserves and
  continues to derive program context from role assignments and team roster
  memberships where those records are the source of existing workflows.
- Current roster add/move duplicate guardrails protect Athlete
  same-program/same-season duplicates in implemented roster paths by comparing
  roster team program and season context.
- Reports and lifecycle views may include explicit program participation as
  read-only context alongside role/roster-derived context.
- Explicit program participation is additive. It does not replace
  `RoleAssignment`, `RosterMembership`, person lifecycle status, Guardian
  relationships, or scoped backend permission checks.
- Guardian visibility must not be broadened by program participation. Guardian
  app access remains derived from active Guardian relationships.
- Program participation management UI, automatic backfill, duplicate guardrail
  migration, lifecycle automation, joining/transfer/departure/offboarding
  workflows, and any Guardian visibility use remain future product decisions.

Source:
[`memberops-program-participation-policy.md`](./memberops-program-participation-policy.md).

## Entry Organization, Visibility, And Responsibility

- **Creator** is system history and is shown as **Created by**. Reassignment,
  movement, completion, archive, restore, and reopen do not change Creator.
- **Owner** is the mostly internal record/work-object ownership concept.
  Owner transfer is not implemented, and Owner must not be presented as an
  editable substitute for Creator or Assignee.
- **Author** is Journal-specific writer/subject context. It is not assignment
  or ownership transfer.
- **Assignee** is the person responsible for completing task-like work.
- List/context placement is **organization**.
- Visibility is **sharing**.
- Assignment is **responsibility**.
- Moving an Entry among Personal, Admin, Program, or Team contexts must not
  change its visibility, assignment, creator/owner, or team responsibility.
- Program/Team placement does not grant Entry visibility or assignment.
- Organization-admin cross-user oversight belongs in All Entries/Admin views,
  not in another person's Inbox.
- Program/Team context placement does not share or assign work.
- Guardian-derived access should use **Related athlete** for the athlete
  connected to a Guardian by an active Guardian relationship. The Guardian is
  not assigned to, owner of, or direct role-assigned to the athlete by this
  relationship.
- Guardian-visible Journal language must preserve privacy boundaries: Guardians
  may see only Final/Done Guardian-visible Journals for related athletes under
  valid relationship scope.

## Habits In EntryOps

- Habit definitions are stored as separate `Habit` records and appear in **My
  Habits**, the current actor-subject Habit management surface. My Habits shows
  Habits whose subject/assignee is the current actor, not every Habit the actor
  is authorized to manage. Direct Habit creation does not require a Task or
  Entry first.
- **Habit Library** is a future template catalog. It may eventually allow
  users to add known templates to My Habits and authorized staff to assign
  templates, but that catalog is not implemented.
- Habit recurrence is stored in `HabitSchedule`. Habit check-ins are stored as
  `HabitCompletion` records; successful check-ins write `HabitActivity` and
  update `lastCompletedAt`. Check-ins do not create Tasks, Entries, or separate
  All Entries rows.
- Active Habit definitions appear in All Entries by default. Archived Habit
  definitions are hidden by default and appear through explicit archived
  filters; restore returns them to active/default views with history intact.
- Habit definitions do not currently have Entry Context/List or explicit
  visibility fields. The existing `assignedToTeamId` field is an assignment
  field, not Program/Team Context/List placement, and must not be described as
  fan-out.
- Guardian Habit access derives from the Athlete-Guardian relationship and
  remains linked-athlete summary access under the existing Habit policy. It
  does not require a separate Guardian RoleAssignment or grant
  check-in/edit/archive permission.
- Athletes can create or add Habits only for themselves and cannot set a team
  assignment. Authorized Coach/Admin users may create Habits for themselves
  and assign Habits to others under existing policy; assignment does not imply
  team fan-out.
- Normal user-facing Habit lifecycle is Active, Paused, and Archived.
  `COMPLETED` remains a legacy/internal enum state, not a normal lifecycle
  option. Target met, streak, completion count, last check-in, cadence, and end
  date are progress/schedule signals, not lifecycle statuses.
- Tracking units use controlled selections rather than unrestricted free text.
  The agreed selection set is Done, Reps, Sets, Minutes, Hours, Sessions,
  Rounds, Miles, Yards, Meters, Ounces, Glasses, Pages, Entries, and Custom.
  Existing legacy free-text values are preserved until an authorized editor
  selects a controlled replacement.
- Cadence frequency and weekly-day inputs use controlled selections.
- Habit Context/List support is desired future work and does not exist in the
  current Habit model. The existing `assignedToTeamId` field is assignment, not
  Context/List.
- Team recurring Habit assignment/fan-out, compliance dashboards, and advanced
  streak analytics remain future roadmap work.
- Current All Entries/Habit work does not create generated Habit occurrence
  Entries. Additional Today redesign/integration remains future roadmap work.

## Platform Direction

- Desktop web precedes mobile web, optional PWA, and future offline-capable
  mobile app.
- Offline capability is bounded to suitable field capture, not full offline
  administration.
- Append-only operational events are preferred for future sync-safe workflows.
- Shared status language should be reused across modules.

Source: [`UI/UX Decision Log`](../product/design-system/ui-ux-decision-log.md).
