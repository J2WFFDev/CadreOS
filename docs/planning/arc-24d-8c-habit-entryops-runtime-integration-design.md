# Arc 24D.8C Habit-to-EntryOps Runtime Integration Design

Date: 2026-06-03

Branch: arc-24d-8c-habit-entryops-runtime-integration-design

Scope: documentation/design only. No app code, schema, route, auth, role, package, or dependency changes.

## Executive Summary

CadreOS should keep `HabitCompletion` canonical for habit occurrence/check-in history now. Habit check-ins are already idempotent by `(habitId, completedOn)`, are tied to Habit-specific tracking modes, and are visible through Habit detail, Today, and Activity Feed surfaces. EntryOps should reference or link habit activity only where it improves operational coordination.

The recommended path is a hybrid model: keep `HabitCompletion` canonical, then add optional, idempotent EntryOps links or runtime work objects only for selected habits or selected workflow moments. This avoids automatic task explosion while preserving a future path into Today, Assigned, Review, and runtime metadata surfaces.

## Current State

### Habit Occurrences And Check-Ins

Habit behavior is implemented through the Habit domain:

- `Habit` stores the recurring behavior, assignment, lifecycle status, tracking mode, target fields, and future-ready analytics placeholders.
- `HabitSchedule` stores cadence metadata: `frequency`, `interval`, `daysOfWeek`, `startDate`, and `endDate`.
- `HabitCompletion` stores dated occurrence check-ins.
- `HabitActivity` stores lightweight lifecycle/feed events.

Current check-in flow:

- `POST /habits/[habitId]/check-in` loads the habit, checks `canCheckInHabit`, parses `completedOn`, note, and count value, then writes a `HabitCompletion`.
- `completedOn` is normalized to start-of-day UTC.
- The existing unique constraint on `(habitId, completedOn)` prevents duplicate same-day check-ins.
- Duplicate same-day attempts redirect back to Habit detail with a duplicate indicator.
- Successful check-in updates `Habit.lastCompletedAt` and writes `HabitActivity` with action `habit.checked_in`.

Current lifecycle flow:

- Check-in records an occurrence; it does not complete the Habit lifecycle.
- Complete marks the Habit itself as `COMPLETED` and sets `completedAt`.
- Pause marks the Habit `PAUSED`, keeping history but blocking check-ins.
- Archive marks the Habit `ARCHIVED`, retaining history.
- Restore returns archived or completed habits to `ACTIVE`.

What Habit check-in does not do today:

- It does not create `Entry`.
- It does not create `EntryRuntimeRef`.
- It does not create `EntryAssignment`.
- It does not create `EntryReminder`.
- It does not use `Entry.taskRecurrenceRule`.
- It does not generate task instances or notifications.

### EntryRuntimeRef Runtime Records

`EntryRuntimeRef` is currently a sidecar wrapper for selected legacy source models:

- `EntryRuntimeSourceModelType` values are currently only `OBSERVATION_NOTE` and `FOLLOW_UP_TASK`.
- `EntryRuntimeKind` values are `NOTE` and `TASK`.
- `EntryRuntimeRef` is unique by `(organizationId, sourceModelType, sourceModelId)`.
- Runtime refs carry author, visibility class, athlete/team/event pointers, and timestamps.

`lib/entry-runtime.ts` provides two write paths:

- `writeObservationNoteEntryRuntimeRef`
- `writeFollowUpTaskEntryRuntimeRef`

Both are gated by environment flags:

- `CADREOS_ENTRY_RUNTIME_NOTES_SIDECAR_WRITE`
- `CADREOS_ENTRY_RUNTIME_TASKS_SIDECAR_WRITE`

Both are idempotent upserts. They are also non-authoritative: note/task workflows remain canonical, and runtime refs are metadata sidecars.

The runtime detail route at `/entry-runtime/[entryRuntimeRefId]` is read-only and only understands current source model types. It presents metadata and links back to the underlying ObservationNote or FollowUpTask.

### Tasks, Entries, Schedules, And Review Views

EntryOps has an Entry-centered operational model:

- `Entry` stores work items with type, title, content, status, priority, due date/time, assignment, visibility, list membership, type payloads, and optional task recurrence text.
- `EntryAssignment` supports multi-assignee ownership.
- `EntryReminder` exists as a deferred reminder placeholder.
- `EntryActivity` records entry activity.
- `EntryObjectLink` and `OperationalRelationship` provide linking mechanisms.

Task creation path:

- `POST /tasks/create` creates a legacy `FollowUpTask`.
- It attempts to upsert a corresponding `Entry` through `upsertEntryFromTask`.
- It attempts to write `EntryActivity` rows.
- It attempts to write a `FollowUpTask` runtime ref through `writeFollowUpTaskEntryRuntimeRef`.
- Entry wrapper sync is non-authoritative and does not block task creation.

EntryOps Today, Assigned, Upcoming, and Review:

- Today, Assigned, and Upcoming query active `Entry` rows and apply schedule/date filters.
- Review queries `Entry` rows in `DONE`, `CANCELLED`, or `ARCHIVED`.
- Event schedule view currently focuses on `EntryType.EVENT` payload recurrence, not Habit recurrence.
- Habit activity is included separately in feed aggregation through `queryRecentHabitActivity`.
- Actionable habits are included separately in Today/Feed through `queryActionableHabitsToday`.

Current relationship behavior:

- Habit detail uses `RelationshipPanel` with source node type `HABIT`.
- Habit can be explicitly linked to Entry or Habit nodes through operational relationships.
- These graph links do not create runtime work objects by themselves.

## Integration Options

### Option A - HabitCompletion Remains Canonical; EntryOps References Habit Activity Only

Summary:

Habit remains fully separate from Entry/RuntimeRef. EntryOps only references habit activity where needed, such as feed rows, relationship links, and Today habit sections.

Benefits:

- Lowest implementation risk.
- Preserves the current idempotent `HabitCompletion` model.
- Avoids task/entry explosion for daily or weekly habits.
- Requires no schema changes.
- Keeps check-in UX simple and Habit-specific.
- Keeps Habit tracking modes, counts, notes, streaks, and completion history in one source of truth.

Risks:

- Habits remain partially outside core EntryOps work queues.
- Review and Assigned views do not treat habit occurrences as normal work objects.
- Entry reminders, comments, assignments, and status history are unavailable for habit occurrences.
- Users may expect habits to behave like tasks in all EntryOps surfaces.

Schema impact:

- None.

UX impact:

- Today and Feed can continue showing separate Habit sections.
- Habit detail remains the main place for occurrence history.
- Review remains Entry-only unless separate Habit review UX is added.

Testing impact:

- Maintain Habit policy/create/access/feed tests.
- Add focused tests only when Habit feed or Today behavior changes.

Migration/data impact:

- None.

Release risk:

- Low.

### Option B - Each Scheduled Habit Occurrence Creates EntryRuntimeRef Or Entry-Backed Runtime Object

Summary:

Every scheduled habit occurrence becomes a runtime work object, either through `EntryRuntimeRef`, `Entry`, or both. Today/Assigned/Review would then consume generated occurrence records similarly to tasks.

Benefits:

- Habit occurrences become first-class EntryOps work.
- Today, Assigned, Upcoming, Review, reminders, comments, and status history can share common Entry infrastructure.
- Future recurring task behavior could share mechanics with habit occurrence generation.

Risks:

- High risk of automatic task explosion.
- Requires a schedule expansion policy: when to generate, how far ahead, how to handle missed/skipped days, and how to avoid duplicates.
- Requires clear canonical ownership between `HabitCompletion` and Entry/Runtime status.
- Current `EntryRuntimeSourceModelType` does not support Habit or HabitCompletion.
- Current `EntryRuntimeRef` uniqueness by source model id is insufficient for multiple occurrences unless occurrence records become source models.
- Could duplicate HabitCompletion history and Entry status history.
- Could create privacy/role mismatches between Habit access policy and Entry access policy.
- More likely to require schema changes.

Schema impact:

- Likely significant.
- At minimum, adding `HABIT` or `HABIT_COMPLETION` to `EntryRuntimeSourceModelType` would be required for direct runtime refs.
- If each occurrence gets a runtime ref, the source id must represent an occurrence, not just the Habit id.
- A new occurrence table may be required if occurrences can exist before check-in.
- Direct Entry links may need new fields or object links to make idempotency reliable.

UX impact:

- Habits would appear as task-like work items.
- Users may see many generated rows.
- Habit detail and Entry detail would need clear cross-navigation.
- Completing an Entry occurrence and checking in a Habit occurrence must be reconciled.

Testing impact:

- Requires schedule expansion tests, idempotency tests, role/visibility tests, Today/Assigned/Review tests, and migration/backfill tests.
- Requires route/service integration tests beyond current pure helper tests.

Migration/data impact:

- Existing active habits may need generated occurrence records.
- Historical completions may need backfilled links.
- Existing cadence data may need normalization before occurrence generation.

Release risk:

- High.

### Option C - Hybrid: HabitCompletion Canonical With Optional/Idempotent EntryOps Runtime Links

Summary:

HabitCompletion remains canonical for check-in history. EntryOps links or runtime work objects are generated only when explicitly needed: selected habits, selected cadence windows, staff-assigned habits, or workflow-triggered moments. Generated objects must be idempotent and must point back to Habit/HabitCompletion without replacing them.

Benefits:

- Preserves the stable Habit model.
- Allows EntryOps integration without automatic task explosion.
- Lets CadreOS pilot runtime linkage for a narrow set of habit workflows.
- Keeps Habit check-in as the authoritative source for streaks, counts, and notes.
- Enables future Today/Assigned/Review integration for selected operational habits.
- Allows staged schema decisions instead of broad redesign.

Risks:

- Requires a product rule for which habits generate runtime work.
- Requires a clear link model between Habit/HabitCompletion and Entry/RuntimeRef.
- May create two UX paths for some habits: Habit detail and Entry detail.
- If not named clearly, "check in" and "complete work item" can drift.

Schema impact:

- Short term: can use `OperationalRelationship` or `EntryObjectLink` for explicit links without schema changes.
- Medium term: direct `EntryRuntimeRef` support for habit occurrences likely requires adding source model types and possibly an occurrence source model.
- A future `HabitOccurrence` model may be required if runtime work can exist before check-in.

UX impact:

- Normal habits continue to behave as today.
- Selected operational habits can appear in EntryOps work queues when needed.
- Habit detail remains canonical for history.
- EntryOps runtime objects should label themselves as generated/supporting work, not canonical history.

Testing impact:

- Tests can start with idempotent link creation and visibility boundaries.
- Later tests can cover generated runtime work for selected habits only.
- Lower test blast radius than full occurrence generation.

Migration/data impact:

- No immediate data migration required for link-only work.
- Later pilots can backfill links for selected habits or selected completion windows.

Release risk:

- Medium-low if implemented incrementally.
- Medium if schema-backed occurrence generation is introduced.

## Recommendation

Recommend Option C for CadreOS now:

Keep `HabitCompletion` canonical for Habit occurrence/check-in history. Add optional and idempotent EntryOps links or runtime work objects only where a specific workflow needs EntryOps participation.

Rationale:

- Current code already treats HabitCompletion as the authoritative occurrence record.
- Current EntryRuntimeRef schema does not support Habit or HabitCompletion source types.
- Current EntryRuntimeRef model is a sidecar, not a canonical work item model.
- Habit Today/Feed integration already works without Entry row generation.
- Automatic generation would create risk before CadreOS has a clear occurrence lifecycle for skipped/missed/due/completed states.
- A hybrid path lets the product decide which habit types should become operational work while preserving stable check-in semantics.

Recommended near-term product rule:

- Do not generate Entry rows for all habits.
- Do not generate runtime refs for every scheduled day.
- Allow only explicit, opt-in, idempotent EntryOps linkage for selected habits or selected completions.
- Treat `HabitCompletion` as the source of truth for completion history, count values, notes, streaks, and completion rate.

## Implementation Slices

### 24D.8D - Define Link-Only Habit EntryOps Bridge

Goal:

- Add a narrow, no-schema bridge that lets selected Habit records or HabitCompletion records link to EntryOps context without creating task instances.

Allowed files/modules:

- `lib/habits/*`
- `lib/entry-relationships.ts`
- `lib/operational-graph/*`
- `lib/operational-feed/*`
- Habit detail route/page files only if needed for link display.
- Tests under `tests/habits`, `tests/entry-relationships`, and `tests/operational-feed`.
- Documentation under `docs/planning`.

Non-goals:

- No schema changes.
- No EntryRuntimeRef source type changes.
- No automatic Entry generation.
- No notifications or reminders.
- No role/permission changes.

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted tests for habit relationship/link behavior.

Acceptance criteria:

- Habit-to-EntryOps links are idempotent.
- Linked records remain readable only under existing Habit and Entry visibility checks.
- HabitCompletion remains canonical.
- Today/Feed behavior is unchanged unless explicitly extended.
- Documentation states that links are contextual, not occurrence sources of truth.

### 24D.8E - Pilot Optional Runtime Work For Selected Habits

Goal:

- Implement an opt-in runtime work pilot for selected habits after product approval of source-of-truth rules.

Allowed files/modules:

- `lib/habits/*`
- `lib/operational-feed/*`
- `lib/operational-entry/*`
- `lib/entry-runtime.ts` only if schema support is explicitly approved.
- Habit route handlers only where needed for opt-in/pilot behavior.
- Tests under `tests/habits`, `tests/operational-feed`, and `tests/entries`.
- Prisma schema/migration files only if the prompt explicitly approves the schema change.

Non-goals:

- No automatic generation for every active habit.
- No full recurring task engine.
- No notification delivery.
- No broad EntryOps redesign.
- No role/permission changes unless explicitly approved.

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted runtime-link tests.
- `npm test` if shared EntryOps behavior is changed broadly.

Acceptance criteria:

- Runtime work creation is opt-in and idempotent.
- Generated/supporting work points back to Habit or HabitCompletion.
- Completing generated work does not corrupt HabitCompletion history.
- Habit detail clearly shows linked runtime work when present.
- EntryOps views do not duplicate habit items unexpectedly.

### 24D.8F - Recurring Task And Occurrence Model Decision, If Needed

Goal:

- Decide whether CadreOS needs a first-class occurrence model or recurring task engine after link-only and pilot runtime behavior are validated.

Allowed files/modules:

- Documentation under `docs/planning`.
- If implementation is explicitly approved later: scoped recurrence modules, EntryOps modules, Habit modules, and Prisma schema/migrations.

Non-goals:

- No implementation without an approved schema/runtime prompt.
- No broad schema redesign in the design slice.
- No automatic task explosion.
- No notification system.
- No role/permission changes unless explicitly approved.

Validation:

- Design-only: `npm run typecheck`, `npm run build`.
- Implementation later: targeted recurrence and EntryOps tests.

Acceptance criteria:

- Product decision exists for skipped/missed/due/completed occurrence states.
- Product decision exists for timezone/local-day behavior.
- Product decision exists for whether habits and recurring tasks share an occurrence engine.
- Data migration and rollback plan are documented before schema changes.

## Guardrails

Do not do these yet:

- Do not redesign the Habit schema broadly.
- Do not add automatic task explosion for every scheduled habit occurrence.
- Do not add notification or reminder delivery.
- Do not rewrite the recurring task engine.
- Do not change auth, roles, permissions, or route structure unless explicitly approved.
- Do not change dependencies or package files.
- Do not treat EntryRuntimeRef as canonical for Habit check-in history.
- Do not create Entry rows for historical HabitCompletion records without a migration/backfill plan.
- Do not change HabitCompletion idempotency or uniqueness without a dedicated data model review.

## Open Questions

- Which habit types need EntryOps runtime participation: all staff-assigned habits, only selected operational habits, or only habit exceptions?
- Should runtime work be generated before a check-in is due, at the moment a check-in is recorded, or only when a staff member explicitly links it?
- Should a generated Entry mark the HabitCompletion complete, or should HabitCompletion remain the only completion action?
- How should missed/skipped occurrences be represented?
- Should habit occurrence dates remain UTC-normalized or become athlete/team-local dates?
- Should `Entry.taskRecurrenceRule` become relevant to habits, or stay task-specific?
