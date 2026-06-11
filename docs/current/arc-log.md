# Current Arc Log

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
| Arc 24D.8T Habit management foundation | Completed / merged | [`Arc 24D.8T`](../planning/arc-24d-8t-habit-library-foundation.md) |
| Arc 24D.8T-A Habit terminology, ownership, editability, and status cleanup | Completed / merged | PR #374 |
| Arc 24D.10.4, 24D.11, 24D.12 | Marked complete | [`planning/README.md`](../../planning/README.md) |
| Arc 25F GearOps role/approval validation | Delivered | [`planning/ARC_25F_GEAROPS_ROLE_EXPERIENCE_APPROVALS_OPERATIONAL_VALIDATION.md`](../../planning/ARC_25F_GEAROPS_ROLE_EXPERIENCE_APPROVALS_OPERATIONAL_VALIDATION.md) |
| GearOps CSV `asset_id` baseline | Fixed / merged | PR #366 |
| Arc 26E MemberOps role/permission validation | Delivered | [`planning/ARC_26E_MEMBEROPS_ROLE_EXPERIENCE_PERMISSIONS_AND_OPERATIONAL_VALIDATION.md`](../../planning/ARC_26E_MEMBEROPS_ROLE_EXPERIENCE_PERMISSIONS_AND_OPERATIONAL_VALIDATION.md) |
| UI.1 collapsible sidebar and independent scrolling | Completed / merged | PR #368 |

## Latest Known Work

The latest merged EntryOps work on `main` includes Arc 24D.8Q-C All Entries,
Guardian Lists, and movement validation; Arc 24D.8R Journal workflow/access
UX; Arc 24D.8Q-D Guardian grouping, context labels, destinations, and active
Habits; and Arc 24D.8T-A Habit terminology and lifecycle cleanup. The GearOps
CSV `asset_id` baseline fix and UI.1 collapsible sidebar/independent scrolling
work are also merged.

Implemented current behavior includes:

- App context can derive Guardian access from active Guardian relationships
  without requiring a fake direct Guardian role assignment.
- Quick Capture is actor-scoped and does not assign work to a dependent
  Athlete.
- Inbox is actor-scoped; organization-wide oversight belongs in All Entries or
  Admin views.
- All Work Items is named All Entries and displays list/context placement.
- Guardian-visible linked Athlete personal list context does not broaden Entry
  or Journal visibility.
- Journal Draft/Private/staff-only content remains hidden from Guardians;
  linked Guardians may read Final/Done Guardian-visible dependent Journals.
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
  Library is reserved for a future predefined organized catalog/template list
  where users can add known templates. Athlete self-service creation is
  self-only; authorized Coach/Admin users retain assignment capability.
- Normal user-facing Habit lifecycle is Active, Paused, and Archived.
  Completed is not a normal user-facing lifecycle option. Target met, streak,
  completion count, last check-in, cadence, and end date remain
  progress/schedule signals.
- Guardian Habit access remains summary-only. Habit Context/List does not
  exist in the current model, and `assignedToTeamId` is assignment rather than
  Context/List.

The newest detailed planning audit found is Arc 24D.9A Entry Relationships
Foundation Audit, which recommends 24D.9B. The next priority **needs
product-owner confirmation**.

## Conflicting Or Unclear Status

- `planning/ROADMAP.md` describes Entry, GearOps, and other capabilities as
  unbuilt or deferred, but later arc docs and code show substantial delivery.
- `planning/README.md` names Arc 23F as next, while newer Arc 24D, 25, and 26
  work exists. Arc 23F priority/status **needs product-owner confirmation**.
- Arc numbering is not chronological across all workstreams; higher-numbered
  Arc 25/26 docs predate some recent Arc 24D work.
- Arc 26A lists missing/partial MemberOps capabilities that Arc 26E later
  describes as validated. The remaining gap set **needs product-owner
  confirmation**.
