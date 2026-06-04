# Arc 24D.8X-E - Task-to-Habit Real Habit Conversion

## Current Behavior Discovered

Habit screens already use real Habit records:

- `/habits` queries `db.habit.findMany`.
- `/habits/[habitId]` queries `db.habit.findFirst`.
- `/habits/create/save` creates `db.habit` and optional `HabitSchedule` rows.
- Habit check-in, pause, restore, archive, complete, activity, and relationship views operate from the Habit/HabitSchedule/HabitCompletion/HabitActivity model family.

Task conversion previously had only a Note-to-Task action at `/entries/[entryId]/convert-note-to-task`. There was no Task-to-Habit conversion route. Standard Entry edit/create type controls still allowed `EntryType.HABIT`, which could produce legacy habit-like entries that do not appear in Habit views.

## Entry.type = HABIT Usage Audit

`EntryType.HABIT` remains in the Prisma enum and historical migrations. No schema change was made.

Current non-schema usage falls into compatibility and display categories:

- Entry detail label/config support still recognizes `EntryType.HABIT`.
- Entry detail includes a defensive Habit guidance warning for legacy Habit entries.
- Operational feed rendering labels `HABIT` as a work item type and continues to route legacy `EntryType.HABIT` feed items to `/entries/[entryId]`.
- Entry filter/type tests and generic Entry type helpers still treat `HABIT` as a valid enum value.
- Journal payload tests assert `EntryType.HABIT` is not treated as journal payload.
- OperationalRelationship node types support real `HABIT` nodes separately from `ENTRY` nodes.

This slice removed `EntryType.HABIT` from user-selectable Entry types so normal Entry creation/editing no longer offers the legacy Habit entry path. Existing legacy `EntryType.HABIT` entries remain display-compatible, and Entry detail preserves the current type option for legacy records that are already Habit entries.

## Conversion Flow Implemented

Task-to-Habit conversion is now available from Entry detail for task entries.

When posted to `/entries/[entryId]/convert-task-to-habit`, the route:

- Requires Entry update permission and Habit create access.
- Refuses non-task, deleted, or archived source entries.
- Checks for an existing active `CREATED_FROM` Habit-to-Entry OperationalRelationship to avoid duplicate conversions.
- Creates a real `Habit` record.
- Creates a `HabitSchedule` only when the task recurrence rule safely maps to Habit cadence:
  - `FREQ=DAILY` -> daily HabitSchedule
  - `FREQ=WEEKLY` -> weekly HabitSchedule
  - unsupported task recurrence rules such as `FREQ=MONTHLY` are not translated yet
- Transfers task title, content/description, assignee as athlete, team, and source creator where available.
- Records source tags in relationship metadata because Habit has no tag field.
- Creates a `CREATED_FROM` OperationalRelationship from the resulting Habit to the source Entry.
- Writes Habit and Entry activity records for conversion/relationship history.
- Redirects to the resulting Habit detail page.

## Source Entry Behavior

The source Entry remains available for audit/history but no longer remains active task work:

- The source Entry status is set to `ARCHIVED`.
- `taskCompleted` is set to `false` and `completedAt` is cleared so conversion is distinct from task completion.
- If the Entry has a backing `FollowUpTask`, that task is set to `CANCELLED`.
- The source Entry remains addressable directly and retains its activity/history.

## Compatibility Notes

Habit views did not depend on `Entry.type = HABIT`, so no Habit screen compatibility shim was required.

Transitional compatibility remains:

- Existing `EntryType.HABIT` records can still render through Entry detail/feed display paths.
- `EntryType.HABIT` remains in the enum and generic type helpers for existing data.
- Future cleanup can decide whether to migrate legacy Habit entries into real Habit records or retain them as historical work items.

## Risks

- Unsupported task recurrence rules are intentionally not translated into HabitSchedule rows. This avoids inventing a recurrence engine in this slice.
- Habit has no tag field, so tags are preserved only in OperationalRelationship metadata for now.
- Creating Habit from an already-completed task is allowed if the Entry is not archived. Product may later decide to limit conversion to open/in-progress tasks only.
- Relationship labels depend on existing `CREATED_FROM` direction semantics.

## Validation

Performed validation:

- `npm run typecheck`
- `npm run build`
- Targeted tests:
  - `tests/habits/task-conversion.test.ts`
  - `tests/entries/user-selectable-types.test.ts`
  - `tests/entries/activity-actions.test.ts`
  - `tests/operational-feed/render-helpers.test.ts`

## Recommended Next Slice

24D.8X-F - Habit Library / Legacy Habit Entry Cleanup Design

Goal:

- Decide how existing legacy `EntryType.HABIT` records should be migrated, hidden, retained, or linked to real Habit records.

Allowed files/modules:

- Planning docs
- Habit/Entry query audit only
- Optional read-only reporting helpers if needed

Non-goals:

- No schema changes
- No automatic migration without approval
- No Habit form redesign
- No recurring runtime/task generation
- No navigation changes

Validation:

- `npm run typecheck`
- `npm run build`

Acceptance criteria:

- Legacy Habit Entry inventory and cleanup options are documented.
- Recommended migration/no-migration path is selected.
- Implementation slices are scoped before any data changes.
