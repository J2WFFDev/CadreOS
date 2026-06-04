# Arc 24D.8X - EntryOps Simplification and Habit Conversion Design

## Purpose

Arc 24D.8 completed the Habit stabilization path and proved that Habit activity can be linked into EntryOps context without generating runtime work records. Before Arc 24D.9 continues broad relationship work, CadreOS needs a cleaner product model for EntryOps so future implementation does not reinforce confusing surfaces, duplicate context panels, or the older `Entry.type = HABIT` path.

This note is design only. It does not modify app code, schema, routes, auth, roles, dependencies, or package files.

## Current State

### EntryOps Routes and Views

The current EntryOps navigation exposes a broad set of active surfaces:

- Inbox at `/entries/inbox`
- My Work at `/assigned`
- Today at `/today`
- Upcoming at `/upcoming`
- Review at `/entries/review`
- Lists at `/lists`
- Activity Feed at `/feed`
- All at `/entries`
- Habits at `/habits`
- Journals at `/journals`
- Prompt Library at `/prompts`
- Prompt Assignments at `/prompt-assignments`

Additional EntryOps-adjacent routes also exist outside the simplified target model, including standalone task, note, decision, schedule, object-link, relationship, journal, prompt, and quick-add routes.

The current visible model is therefore broader than the product model CadreOS should stabilize now. The core views that should remain prominent for this phase are:

- Inbox
- Lists
- All Work Items
- Habits
- Journal Library

The following surfaces should be treated as hidden, deferred, or staff-only implementation aids until the simplified model is stable:

- My Work
- Today
- Upcoming
- Review
- Activity Feed
- Prompt Assignments
- Entry schedule
- Standalone task, note, and decision workbench routes when they compete with the Entry detail model

This does not require deleting routes. The first implementation slice should focus on navigation and product clarity.

### Inbox Versus Lists

The app already has an `EntryList` foundation:

- `EntryList` supports `PERSONAL`, `ORGANIZATION`, `PROGRAM`, and `TEAM` scopes.
- `EntryList.isInbox` identifies default Inbox lists.
- `lib/entries/lists.ts` has `resolveOrCreateDefaultList`, which lazily creates scoped Inbox lists.
- `/lists` displays visible lists and flags Inbox lists.
- `/lists/[listId]` displays entries assigned to a specific list.

However, `Entry.listId` is currently optional, and `/entries/inbox` is not a view of an `EntryList.isInbox` list. It queries `InboxRoutingItem` rows with `status = OPEN` and `subjectRefType = ENTRY`, then joins back to entries. That makes the current Inbox a routing queue, not the canonical default List.

This is the main product-model mismatch to correct: every Entry should have a List, and the default List should be Inbox.

### Entry Detail Presentation

`/entries/[entryId]` currently does a lot of work in one page:

- Generic Entry fields such as title, type, status, priority, visibility, assignee, due date, body, list, scope, and timestamps.
- Type-specific fields for tasks, events, decisions, and journals.
- A right-side Context card with List, Assignment, Scope, Visibility, Relationships, and linked operational records.
- A separate Metadata card with created/updated data.
- A main `RelationshipPanel` labeled "Related Items / Context".
- Legacy context links from older direct fields, including source task/note and follow-up links.
- Related operational records for non-entry, non-habit operational graph links.
- Activity history.

This creates three overlapping concepts: context, relationships, and metadata. It also makes type-specific behavior feel like a generic field bundle rather than a focused Task, Note, Decision, Journal, Event, or Habit presentation.

### Relationship and Detail Code Paths

The relationship foundation now supports Entry and Habit nodes through `OperationalRelationship` and `OperationalGraphNodeType`. The `RelationshipPanel` can link Entry and Habit records, prevent duplicate operational relationships through service helpers, and remove links. Habit links are intentionally contextual: they do not create tasks, runtime refs, or My Work visibility.

The detail page still carries older "Legacy context" paths alongside the newer relationship panel. That is useful for compatibility, but it should not remain a prominent user-facing model once the simplified relationship surface is implemented.

### Task-to-Habit Conversion

No direct Task-to-Habit conversion route or action was found. The codebase has note-to-task conversion, but no comparable task-to-habit conversion path.

`EntryType.HABIT` remains present in the schema and is user-selectable through `USER_SELECTABLE_ENTRY_TYPES`. Entry detail has defensive messaging for `EntryType.HABIT`, but real habit behavior lives in the separate Habit model and Habit routes.

This means CadreOS currently has two habit concepts:

- Real Habit records, with schedules, status, check-ins, and HabitCompletion.
- Habit-typed Entry records, which are legacy or partially supported work items.

The target model should make real Habit records canonical and stop presenting `Entry.type = HABIT` as a normal creation path.

### Habit Form and Habit Library Direction

Habit create and edit flows already create real Habit rows. The form captures:

- Habit title and description.
- Required athlete.
- Optional team assignment.
- Tracking mode: checkoff, count, or notes.
- Optional count target and unit.
- Cadence: no cadence, daily, weekly, or custom.
- Weekly day text, start date, and optional end date.

`HabitCompletion` remains the canonical occurrence/check-in record from Arc 24D.8. The Habit route is therefore already closer to a Habit Library than Entry details are. The next product step should treat Habits as a library of reusable behavior definitions, with check-ins as occurrences, not as generated tasks.

### Journal Library Pattern

The current app has journals at `/journals` and a Prompt Library at `/prompts`. The prompt library manages reusable `JournalPrompt` records, filters active/archived/all prompts, and supports prompt assignments. Journal creation can respond to a prompt and assignment context.

This is an important precedent for Habit Library:

- The library stores reusable definitions.
- Assignments or responses create downstream activity.
- The reusable object is not the same as an Entry runtime task.

CadreOS should use that pattern for habits: a Habit Library of real Habit definitions with HabitCompletion as occurrence records, rather than Habit entries pretending to be recurring runtime work.

## Target Product Model

### Entry and List Rules

- Every Entry always has a List.
- The default List is Inbox.
- Inbox is a system List represented by `EntryList.isInbox`.
- New Entry creation should assign a default Inbox list when no explicit list is selected.
- `/entries/inbox` may remain a convenience route, but the canonical Inbox should become the relevant Inbox list view.
- `InboxRoutingItem` can remain a processing queue if still needed, but it should not be the product definition of Inbox.

### Core Views for This Phase

The stable EntryOps navigation for this phase should be:

- Inbox
- Lists
- All Work Items
- Habits
- Journal Library

The following should be hidden, deferred, or demoted until their semantics are intentionally reintroduced:

- Today
- My Work
- Upcoming
- Review
- Activity Feed
- Prompt Assignments
- Schedule

Hiding should be navigation-level first. Route deletion is not recommended in this arc.

### Entry Detail Rules

Entry detail should present the Entry according to its type:

- Task: assignee, due date, completion state, priority, and operational links.
- Note: content, author/source context, and operational links.
- Decision: decision state, rationale, owner, and operational links.
- Journal: journal payload, prompt/assignment context when present, privacy/visibility, and operational links.
- Event or activity: event-specific timing and context.

Generic metadata should move into a single concise details panel. Context and Metadata should not compete as separate concepts.

Recommended visible groups:

- Main content: type-specific body and actions.
- Details: List, owner/assignee, status, priority, scope, visibility, created/updated dates.
- Related work: operational links and legacy links when needed, with legacy links labeled as read-only compatibility.
- Activity: history feed.

### Task-to-Habit Conversion Rules

Task-to-Habit conversion should create a real Habit record. It should not create an `Entry.type = HABIT` record and should not create generated task/runtime occurrence records.

The conversion should:

- Use the source task title and description as defaults for the Habit.
- Require or default a Habit owner/athlete before saving.
- Let the user confirm cadence and tracking mode.
- Create a real Habit row and optional HabitSchedule.
- Link the source Entry and new Habit through existing `OperationalRelationship` patterns.
- Keep `HabitCompletion` canonical for future check-ins.

### Source Entry Handling After Conversion

The recommended handling is:

- Mark the source task Entry as converted and remove it from active work lists.
- Preserve the source Entry for history and auditability.
- Link source Entry to the new Habit through `OperationalRelationship`.

Without a schema change, the first practical implementation can archive or complete the source Entry and add a relationship/activity note. If a later implementation needs a first-class converted state or `convertedToHabitId`, that should be a separately approved schema arc.

### Habit Library Concept

Habits should be treated as a library of real Habit definitions:

- Habit Library lists real Habit records.
- Habit detail shows schedule, owner, status, check-ins, and linked context.
- HabitCompletion remains the occurrence/check-in record.
- Habit links into EntryOps context are informational unless a future arc explicitly creates workflow behavior.

This keeps habits distinct from tasks while still allowing operational context.

### Owner and Assignment Rules

Task ownership should follow Entry assignment rules:

- A task can be unassigned only where the product explicitly permits an inbox/draft workflow.
- If no task assignee is chosen during normal creation, default to the creator or the selected target person according to the route context.
- Task owner/assignee is not the same concept as Habit athlete.

Habit ownership should follow Habit rules:

- A Habit has a required athlete/person owner.
- Habit creator is recorded separately as `createdByPersonId`.
- When converting from a task, the default Habit athlete should be the task assignee when present.
- If the task is unassigned, default to the creator only when that actor is a valid athlete/person target; otherwise require a selection.
- Team assignment is optional context, not a substitute for the required Habit athlete.

### Context and Metadata Cleanup

The Entry detail page should not show separate competing "Context", "Metadata", "Related Items / Context", "Legacy context", and "Related operational records" concepts.

Recommended cleanup:

- Rename the relationship surface to "Related work" or "Links".
- Merge Context and Metadata into one "Details" panel.
- Keep legacy context read-only and visually secondary until it can be migrated or hidden.
- Do not expose Habit links as task actions.
- Keep habit-related link copy explicitly informational.

## Decisions, Options, and Recommendations

### Converted Source Entry

Options:

- Archive the source Entry after creating the Habit.
- Hide the source Entry from active lists while preserving detail access.
- Add a converted state or converted-to link in schema.
- Leave the source Entry active and linked.

Recommendation:

Archive or otherwise remove the source Entry from active work lists after conversion, preserve it for audit/detail access, and link it to the new Habit. Do not add schema in the first implementation slice. If stronger converted-state semantics are needed, request schema approval later.

### `Entry.type = HABIT`

Options:

- Keep it user-selectable.
- Hide it from user-selectable types but retain the enum for legacy records.
- Remove it from schema.

Recommendation:

Hide `EntryType.HABIT` from user-selectable entry creation and treat it as legacy/source/draft compatibility only. Do not remove the enum now because that would require schema and migration work.

### `/entries/inbox`

Options:

- Redirect `/entries/inbox` to the system Inbox list route.
- Keep `/entries/inbox` as a convenience route that renders the system Inbox list.
- Keep current `InboxRoutingItem` queue behavior.

Recommendation:

Keep `/entries/inbox` as a convenience route initially, but make it resolve and display the appropriate `EntryList.isInbox` list. If the routing queue is still useful, surface it separately as processing state, not as the definition of Inbox.

### Related Items Model

Options:

- Keep `OperationalRelationship` as the relationship foundation.
- Simplify all relationships to Entry-to-Entry links only.
- Keep `OperationalRelationship` internally but simplify the user-facing labels.

Recommendation:

Keep `OperationalRelationship` because Habit and operational graph links already use it safely. Simplify the UI labels and avoid exposing graph terminology. Do not reduce to Entry-only links because Habit Library, Journal Library, and future operational objects need cross-object context.

### Context and Metadata

Options:

- Keep the current separate cards and sections.
- Merge visually into one detail panel.
- Hide metadata entirely.

Recommendation:

Merge Context and Metadata visually into one Details panel. Keep created/updated metadata available, but do not let it compete with relationship context or type-specific content.

## Recommended Implementation Slices

### 24D.8X-B - Simplify EntryOps Navigation

Goal:

Make the visible EntryOps navigation match the simplified product model: Inbox, Lists, All Work Items, Habits, and Journal Library.

Allowed files/modules:

- Navigation configuration and validation.
- Sidebar active-state helpers if needed.
- Copy-only route headers for renamed Journal Library/Prompt Library surfaces if needed.

Non-goals:

- No route deletion.
- No schema changes.
- No Entry creation behavior changes.
- No relationship model changes.
- No auth, role, or permission changes unless explicitly approved.

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted navigation tests if existing validation tests are affected.

Acceptance criteria:

- EntryOps sidebar presents the simplified core views.
- Deferred routes are not prominent in normal navigation.
- Existing routes still build and remain accessible directly.
- Journal Library naming is consistent or explicitly documented where Prompt Library remains a technical route.

### 24D.8X-C - Make Inbox the Default List

Goal:

Unify Inbox and Lists so new Entries receive a default Inbox `EntryList` when no list is selected.

Allowed files/modules:

- Entry creation and quick capture routes/actions.
- Entry list helpers.
- Inbox page behavior.
- Entry list tests.
- Documentation note for Inbox/List semantics.

Non-goals:

- No schema changes unless stopped and approved.
- No routing queue redesign unless needed to avoid user confusion.
- No generated runtime/task records.
- No broad Entry detail redesign.

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted Entry/List tests if present or added.

Acceptance criteria:

- New Entry records have a list whenever practical.
- The default list is an `EntryList.isInbox` list.
- `/entries/inbox` aligns with the system Inbox list model.
- Existing `InboxRoutingItem` behavior is either preserved as a queue or clearly separated from the List concept.

### 24D.8X-D - Simplify Entry Detail Context

Goal:

Reduce Entry detail confusion by consolidating metadata/context and making type-specific content clearer.

Allowed files/modules:

- Entry detail page/components.
- Relationship panel labels/copy.
- Entry relationship display helpers.
- Entry detail tests if practical.
- Documentation note for detail presentation.

Non-goals:

- No schema changes.
- No relationship engine rewrite.
- No route structure changes.
- No Today/Review/Feed redesign.
- No Habit conversion implementation.

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted relationship/detail tests if present or added.

Acceptance criteria:

- Entry detail has one coherent Details panel.
- Relationship UI is labeled as links or related work, not ambiguous context.
- Legacy context is visually secondary or read-only compatibility.
- Type-specific fields are easier to scan and do not obscure core Entry fields.

### 24D.8X-E - Implement Task-to-Habit Conversion

Goal:

Add a scoped conversion path from a task Entry to a real Habit while preserving HabitCompletion as canonical.

Allowed files/modules:

- Task/Entry detail conversion action and form.
- Habit creation helper reuse.
- OperationalRelationship link helper reuse.
- Activity logging helpers if already present.
- Habit and Entry conversion tests.
- Documentation note for conversion semantics.

Non-goals:

- No schema changes unless stopped and approved.
- No `Entry.type = HABIT` creation path.
- No recurring task/runtime generation.
- No notification logic.
- No broad Habit redesign.

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted task/habit/relationship tests.
- Full `npm test` only if practical; document unrelated failures if they occur.

Acceptance criteria:

- Converting a task creates a real Habit.
- Source Entry is removed from active work view according to the approved source handling rule.
- Source Entry and Habit are linked through existing relationship patterns.
- Duplicate conversion is guarded or clearly prevented.
- No EntryRuntimeRef, generated task, or recurrence engine behavior is introduced.

## Guardrails

- Do not redesign EntryOps broadly while implementing one slice.
- Do not delete routes as part of navigation simplification.
- Do not modify Prisma schema without explicit approval.
- Do not change package files or dependencies.
- Do not change auth, roles, permissions, or route structure without explicit approval.
- Do not create generated task, EntryRuntimeRef, or recurrence records for habits.
- Do not make `Entry.type = HABIT` the normal habit creation path.
- Do not merge HabitCompletion into Entry runtime records.
- Do not treat Habit links as task actions.
- Do not add notifications.
- Do not add `CadreOS.code-workspace`.

## Recommended First Implementation Slice

Start with 24D.8X-B: Simplify EntryOps Navigation.

That slice is low-risk, product-visible, and reversible. It lets CadreOS present the intended operating model before changing creation defaults or conversion behavior. Once the visible model is clean, 24D.8X-C can make Inbox/List semantics concrete, followed by Entry detail cleanup and Task-to-Habit conversion.
