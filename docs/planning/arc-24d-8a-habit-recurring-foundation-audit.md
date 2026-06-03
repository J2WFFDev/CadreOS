# Arc 24D.8A Habit and Recurring Task Foundation Audit

Date: 2026-06-03

Repository: J2WFFDev/CadreOS

Branch: arc-24d-8a-habit-recurring-foundation-audit

Scope: documentation-only discovery before Arc 24D.8 implementation work.

## Summary

CadreOS already has a meaningful Habit foundation. The current implementation includes Habit routes, role-aware access helpers, Habit/HabitSchedule/HabitCompletion/HabitActivity Prisma models, Today view integration, Activity Feed integration, and operational graph relationship support for linking habits to other operational records.

The current foundation is habit-first, not recurring-task-first. Habit check-ins create `HabitCompletion` records and `HabitActivity` feed events. They do not currently create `Entry`, task, `EntryRuntimeRef`, assignment, reminder, or schedule-instance records. Recurring task behavior appears to exist only as lightweight Entry fields such as `taskRecurrenceRule`, not as a full recurrence runtime or task instance generator.

## Existing Habit-Related Routes

The app has these habit routes under `app/(dashboard)/habits`:

- `/habits`
  - File: `app/(dashboard)/habits/page.tsx`
  - Lists habits by status filter: active, paused, archived, or all.
  - Applies `canReadHabit` filtering after querying.
  - Shows Create habit action when `canCreateHabit` allows it.
  - Displays habit title, athlete, cadence, check-in count, status, and updated timestamp.

- `/habits/create`
  - File: `app/(dashboard)/habits/create/page.tsx`
  - Renders create form for title, description, athlete, optional team/program assignment, tracking mode, target count/unit, frequency, days of week, start date, and end date.
  - Create access is guarded by `canCreateHabit`.

- `POST /habits/create/save`
  - File: `app/(dashboard)/habits/create/save/route.ts`
  - Normalizes form input through `lib/habits/create.ts`.
  - Validates title, athlete, and optional team membership inside organization scope.
  - Creates `Habit` and optional nested `HabitSchedule`.
  - Writes a non-blocking `HabitActivity` record with action `habit.created`.
  - Redirects to the new habit detail page.

- `/habits/[habitId]`
  - File: `app/(dashboard)/habits/[habitId]/page.tsx`
  - Detail view for a habit.
  - Shows Edit, Pause/Resume, Mark complete, Restore, Archive, and All habits actions when policy allows.
  - Shows description, assignment/context metadata, status, tracking mode, cadence, target, completion count, current streak, creator, lifecycle activity, completion history, and relationship panel.
  - Includes check-in form when `canCheckInHabit` allows it.
  - Shows completion notes only when `canReadCompletionDetail` allows it.

- `/habits/[habitId]/edit`
  - File: `app/(dashboard)/habits/[habitId]/edit/page.tsx`
  - Renders edit form for title, description, athlete, team/program assignment, tracking mode, target count/unit, and schedule.
  - Guarded by `canEditHabit`.

- `POST /habits/[habitId]/edit/update`
  - File: `app/(dashboard)/habits/[habitId]/edit/update/route.ts`
  - Updates Habit core fields and creates, updates, or deletes the first schedule record.
  - Writes `HabitActivity` with action `habit.updated`.
  - Does not currently update derived schedule fields such as `nextOccurrenceDate`.

- `POST /habits/[habitId]/check-in`
  - File: `app/(dashboard)/habits/[habitId]/check-in/route.ts`
  - Creates a dated `HabitCompletion` record for the habit athlete.
  - Supports optional note and optional count value.
  - Deduplicates by relying on the unique `(habitId, completedOn)` constraint and redirects gracefully on duplicate same-day completion.
  - Updates `Habit.lastCompletedAt`.
  - Writes `HabitActivity` with action `habit.checked_in`.
  - Does not create an Entry, Task, RuntimeRef, assignment, reminder, or task instance.

- `POST /habits/[habitId]/complete`
  - File: `app/(dashboard)/habits/[habitId]/complete/route.ts`
  - Marks the habit lifecycle as `COMPLETED` and sets `completedAt`.
  - Writes `HabitActivity` with action `habit.completed`.
  - This is distinct from recording a daily/weekly occurrence check-in.

- `POST /habits/[habitId]/pause`
  - File: `app/(dashboard)/habits/[habitId]/pause/route.ts`
  - Pauses an active habit or resumes a paused habit.
  - Writes `habit.paused` or `habit.resumed` activity.

- `POST /habits/[habitId]/restore`
  - File: `app/(dashboard)/habits/[habitId]/restore/route.ts`
  - Restores archived or completed habits to `ACTIVE`.
  - Clears `archivedAt` and `completedAt`.
  - Writes `HabitActivity` with action `habit.restored`.

- `POST /habits/[habitId]/archive`
  - File: `app/(dashboard)/habits/[habitId]/archive/route.ts`
  - Marks a habit as `ARCHIVED` and sets `archivedAt`.
  - Writes `HabitActivity` with action `habit.archived`.

Related surfaces:

- `/today`
  - File: `app/(dashboard)/today/page.tsx`
  - Shows active habits scheduled/actionable today in a separate Habits list.
  - Allows quick check-in when the current actor can check in and the habit is not already completed today.

- `/feed`
  - Built from `lib/operational-feed/queries.ts`.
  - Includes recent `HabitActivity` records as feed items with `entryType: "HABIT_ACTIVITY"`.

- Sidebar navigation
  - File: `lib/navigation/cadreos-nav.ts`
  - Adds Habits under EntryOps with href `/habits`.
  - Navigation tests confirm Habits is visible to athletes.

## Existing Data Model

Prisma schema files already include Habit foundation models.

Habit models and enums:

- `HabitFrequency`
  - Values: `DAILY`, `WEEKLY`, `CUSTOM`.

- `HabitStatus`
  - Values: `ACTIVE`, `PAUSED`, `COMPLETED`, `ARCHIVED`.
  - `COMPLETED` is a lifecycle terminal/finished state, not an occurrence completion.

- `HabitTrackingMode`
  - Values: `CHECKOFF`, `COUNT`, `NOTES`.

- `Habit`
  - Core fields: organization, title, description, athlete, optional assigned team, status, creator, archived/paused/completed timestamps.
  - Tracking fields: `trackingMode`, `targetCount`, `targetUnit`, `allowCompletionNote`.
  - Future-ready derived placeholders: `nextOccurrenceDate`, `lastCompletedAt`, `lastOccurrenceDate`, `longestStreak`, `completionRate`.
  - Relations: organization, athlete, assigned team, creator, schedules, completions, activities.

- `HabitSchedule`
  - Recurrence/cadence definition for a habit.
  - Fields: `frequency`, `interval`, `daysOfWeek`, `startDate`, `endDate`.
  - `interval` is present but appears mostly future-ready; UI create normalizes it, but the create page does not render an interval field.
  - `daysOfWeek` schema comment says JSON array, while the UI and policy helper use comma/space-separated values such as `MON,WED,FRI`.

- `HabitCompletion`
  - Dated check-in record.
  - Unique by `(habitId, completedOn)`.
  - Stores note, completedBy person id, count value, and normalized completion date.

- `HabitActivity`
  - Lightweight habit lifecycle/feed event table.
  - Stores organization, habit, action, optional actor, optional metadata, and created timestamp.

Related EntryOps models:

- `Entry`
  - Has fields for task behavior: `status`, `priority`, `dueDate`, `dueTime`, `taskCompleted`, `completedAt`, `taskChecklistJson`, `taskRemindersJson`, and `taskRecurrenceRule`.
  - Has links to notes, follow-up tasks, journal prompts/assignments, lists, assignments, reminders, comments, activities, object links, and type payloads.
  - No direct relation from `Entry` to `Habit` currently exists.

- `EntryRuntimeRef`
  - Provides unique runtime reference records by source model type/id and entry kind.
  - Existing note/task code uses entry runtime refs, but habit check-ins do not currently write them.

- `OperationalRelationship`
  - Polymorphic relationship graph between operational node types.
  - Habit detail page uses this for relationship linking.

- `EntryObjectLink`
  - Polymorphic links from entries to domain objects.
  - Habit detail uses `OperationalRelationship`, not EntryObjectLink, for habit relationships.

- `EntryReminder`
  - Deferred placeholder for reminders.
  - Habit schedules do not currently create reminder records.

- `EntryAssignment`
  - Multi-assignee tracking for entries.
  - Habit assignment is direct through `athletePersonId` and optional `assignedToTeamId`, not through EntryAssignment.

Migration history:

- `prisma/migrations/20260528000000_arc23d_habit_model/migration.sql`
  - Establishes Habit, HabitSchedule, and HabitCompletion.

- `prisma/migrations/20260531000000_arc24d8_habit_foundation/migration.sql`
  - Extends Habit foundation with `COMPLETED`, tracking mode, derived placeholders, interval, completedBy/count fields, and HabitActivity.

Current conclusion:

- Habit behavior exists and is functional at a foundation level.
- Recurring task behavior is not established as a runtime instance-generation system.
- The Entry model has a `taskRecurrenceRule` field, but the audited habit flows do not use it and do not create recurring task instances.

## Existing EntryOps Relationships

Habits relate to EntryOps in these ways:

- Navigation
  - Habits are included under the EntryOps sidebar group.

- Today view
  - `queryActionableHabitsToday` reads active habits and filters them through `isHabitActionableToday`.
  - The Today page renders habits in a separate Habits section, not in the Work Items table.
  - Quick check-in posts to `/habits/[habitId]/check-in`.

- Activity feed
  - `queryRecentHabitActivity` reads `HabitActivity` and adapts those events into feed items.
  - Feed item ids point at habit activity ids, while the mapped `entryId` field contains the habit id and `entryType` is `HABIT_ACTIVITY`.
  - Habit activity is intentionally separate from `EntryActivity`.

- Relationship graph
  - Habit detail has a `RelationshipPanel`.
  - Source node type is `OperationalGraphNodeType.HABIT`.
  - Current search target options are Entry and Habit.
  - This enables explicit graph relationships between habits and entries/habits, but not automatic Entry creation.

- Guardian visibility
  - `lib/journals/guardian-visibility.ts` includes habit summary helpers.
  - Guardians can see linked-athlete habit summary data but not completion notes.

Habits do not currently appear to:

- Create task instances.
- Create `EntryRuntimeRef` records.
- Create `Entry` records.
- Create `EntryAssignment` records.
- Create `EntryReminder` records.
- Populate `Entry.taskRecurrenceRule`.
- Convert check-ins into journal/notes/review entries.
- Auto-create scheduled occurrence rows beyond `HabitSchedule`.

This means the current model supports recurring habit check-ins, but not recurring task execution as a first-class EntryOps runtime.

## Current UX Behavior

Likely navigation/page flow:

1. User opens EntryOps navigation and selects Habits.
2. User sees `/habits` list filtered to active by default, with tabs for paused, archived, and all.
3. Users with create permission can open `/habits/create`.
4. Creating a habit redirects to `/habits/[habitId]`.
5. Detail page exposes lifecycle controls and check-in controls based on role/access policy.
6. Today view also surfaces actionable active habits and can submit a same-day check-in.

Role behavior visible from policy:

- Organization admin and program director
  - Full habit admin access.
  - Can create, read, edit, archive, pause/resume, complete, restore, check in on behalf of athlete, and read completion notes.

- Coach and assistant coach
  - Can create habits.
  - Can read habits scoped to assigned team/program.
  - Current edit/archive/pause/complete/restore permissions are creator-focused unless admin access applies.
  - Cannot check in on behalf of athletes unless also admin/director.
  - Cannot read completion notes; summary only.

- Athlete
  - Can create habits.
  - Can read own habits.
  - Can check in to own active habits.
  - Can edit/archive/pause/complete/restore habits they created.
  - Can read own completion details.

- Parent/guardian
  - Can read habit summaries for linked athletes.
  - Cannot create habits.
  - Cannot check in.
  - Cannot read completion notes.

Gaps or unclear behavior:

- The create/edit UI offers `NOTES` tracking mode, but check-in note is optional. If Notes mode is intended to require note entry, that rule is not enforced.
- `allowCompletionNote` exists but is not visibly used to show/hide or require notes.
- `interval` exists in schema/create helper, but the create/edit pages do not expose a visible interval control.
- `daysOfWeek` has mismatched representation expectations: schema comment says JSON array, while UI/policy use comma/space-separated strings.
- Only the first schedule is used in list/detail/actionable logic, even though `HabitSchedule[]` allows multiple schedule records.
- Status list filters do not include completed as a separate tab; completed habits only appear in All unless treated differently elsewhere.
- Today quick check-in uses browser date generation from the rendered page, while server dedupe normalizes UTC start-of-day. Timezone behavior may need a product decision.
- Coach UX may be surprising: coaches can create scoped habits and read scoped habits, but lifecycle changes depend on creator/admin checks rather than scoped coach checks.
- Habit detail labels "List" as "Not assigned in habit workflow"; this reinforces that habits are not yet integrated with EntryList.

## Risks and Implementation Questions

Risks before changing code:

- Schema risk: Habit schema already contains future-ready fields, but some are placeholders. Adding runtime recurrence behavior may require either using these fields consistently or adding new occurrence/instance models.
- Product semantics risk: "complete habit" and "check in habit occurrence" are distinct but may be confused in UX and analytics.
- Role policy risk: scoped coach rights are narrower for edits/lifecycle than reads/creates. Changing this could affect privacy and responsibility boundaries.
- Schedule risk: multiple schedules are allowed but only the first schedule is read in several places.
- Representation risk: `daysOfWeek` storage needs to be normalized before adding more schedule behavior.
- Timezone risk: check-in dedupe and Today visibility use UTC-normalized dates; athlete/team local day behavior is not clearly modeled.
- Runtime coupling risk: integrating habits with Entry/Task/RuntimeRef could duplicate source-of-truth unless the product decides whether HabitCompletion or Entry is canonical for occurrence completion.
- Feed risk: HabitActivity is separate from EntryActivity but adapted into feed types; richer feed interactions may need stronger typing or route targets.
- Test risk: current tests focus on pure helpers and feed mapping. Route-level and database-integration behavior is not deeply covered.

Schema changes may be required later if Arc 24D.8 needs:

- First-class recurring task instances.
- Occurrence records distinct from completions.
- Per-occurrence due dates, skipped/missed states, assignees, reminders, comments, or review states.
- Timezone-aware schedule expansion.
- Multiple active schedule versions with effective dates.
- A direct Habit-to-Entry or Habit-to-EntryRuntimeRef relationship.

Migration/data setup may be needed later for:

- Backfilling `nextOccurrenceDate`, `lastOccurrenceDate`, `longestStreak`, or `completionRate`.
- Normalizing existing `daysOfWeek` strings.
- Creating initial RuntimeRef or Entry records for existing active habits if the product chooses EntryOps integration.
- Converting any existing `Entry.taskRecurrenceRule` usage into a unified recurrence model, if such usage exists in production data.

Test coverage gaps:

- Route handler tests for create, edit/update, check-in, pause/resume, complete, restore, and archive.
- Database integration tests for unique same-day completion behavior.
- Tests for Notes tracking mode requiring or not requiring notes.
- Tests for `allowCompletionNote`.
- Tests for interval and weekly day parsing edge cases.
- Tests for multiple schedules and schedule effective dates.
- Tests for Today quick check-in behavior and completed-today state.
- Tests for timezone/local-day behavior.
- Tests for relationship panel behavior with Habit as source.
- Tests for completed-habit listing and restore/archive behavior.

## Recommended Next Implementation Slices

### 24D.8B - Stabilize Habit Schedule and Check-In Semantics

Goal:

- Make existing Habit behavior internally consistent before introducing recurring tasks.
- Clarify and enforce schedule/check-in semantics for tracking modes, weekly days, interval, notes, and Today visibility.

Allowed files/modules:

- `lib/habits/policy.ts`
- `lib/habits/create.ts`
- `app/(dashboard)/habits/create/page.tsx`
- `app/(dashboard)/habits/create/save/route.ts`
- `app/(dashboard)/habits/[habitId]/edit/page.tsx`
- `app/(dashboard)/habits/[habitId]/edit/update/route.ts`
- `app/(dashboard)/habits/[habitId]/check-in/route.ts`
- `app/(dashboard)/habits/[habitId]/page.tsx`
- `lib/operational-feed/queries.ts`
- `tests/habits/*`
- `tests/operational-feed/*`
- Documentation files under `docs/planning` if needed.

Non-goals:

- No Prisma schema changes unless explicitly approved.
- No recurring task instance creation.
- No EntryRuntimeRef integration.
- No auth/role expansion.
- No dependency changes.

Validation:

- `npm run typecheck`
- `npm run build`
- `npm test -- tests/habits/*.test.ts tests/operational-feed/habit-visibility.test.ts` or equivalent targeted test command if supported.

Acceptance criteria:

- `daysOfWeek` representation is normalized and documented in code/tests.
- Notes tracking mode behavior is explicit and tested.
- Count tracking behavior is explicit and tested.
- Interval behavior is either exposed and used or clearly deferred.
- Today/actionable logic has tests for daily, weekly, custom, start/end boundaries, completed today, and inactive statuses.
- No app-wide route/schema/auth/dependency changes outside the allowed scope.

### 24D.8C - Define Habit to EntryOps Runtime Integration

Goal:

- Decide and implement the minimum safe bridge between Habit and EntryOps runtime surfaces.
- Establish whether habits remain separate feed/today items or create Entry/RuntimeRef-backed work objects.

Allowed files/modules:

- `lib/entry-runtime.ts`
- `lib/operational-feed/queries.ts`
- `lib/operational-feed/types.ts`
- `lib/operational-feed/render.ts`
- `lib/operational-entry/*`
- `lib/habits/*`
- Habit route handlers only where needed for the chosen bridge.
- EntryOps tests under `tests/operational-feed`, `tests/entries`, and `tests/habits`.
- Documentation files under `docs/planning` or `docs/dev`.

Non-goals:

- No broad EntryOps redesign.
- No unrelated task, note, journal, or list UI changes.
- No role-policy change unless explicitly approved.
- No schema changes unless the 24D.8B findings prove they are required and the prompt explicitly allows them.

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted tests for habit/feed/runtime integration.

Acceptance criteria:

- A product decision is encoded in docs and code: HabitCompletion remains canonical, or Entry/RuntimeRef becomes canonical for occurrences.
- If RuntimeRef integration is added, it is idempotent and does not duplicate existing runtime refs.
- Today and Feed behavior remains role-safe.
- Existing habit routes continue to work.
- Tests cover the bridge behavior and privacy boundaries.

### 24D.8D - Recurring Task Foundation, If Needed

Goal:

- Add or stabilize first-class recurring task behavior after Habit semantics and runtime integration are settled.

Allowed files/modules:

- Entry/task modules directly responsible for recurrence.
- `lib/operational-entry/*`
- `lib/operational-feed/*`
- `app/(dashboard)/tasks/*`
- Carefully scoped Prisma schema/migration files only if explicitly approved in the implementation prompt.
- Tests under `tests/entries`, `tests/operational-feed`, and any new recurrence-specific test folder.

Non-goals:

- No habit UX rewrite.
- No unrelated EntryOps navigation changes.
- No dependency changes.
- No broad auth/role redesign.
- No package file changes unless explicitly approved.

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted recurring task tests.
- `npm test` if recurrence touches shared EntryOps behavior broadly.

Acceptance criteria:

- Recurring tasks have a clear source of truth for recurrence rules, generated instances, completion, skipped/missed state, and due dates.
- Recurring task behavior does not conflict with HabitCompletion semantics.
- Existing one-off tasks continue to work.
- Migration/backfill steps are documented if schema/data changes are required.
- Tests cover recurrence expansion, idempotency, completion, visibility, and Today/Upcoming inclusion.
