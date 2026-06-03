# Arc 24D.8E Habit Today and Review Visibility Design

Date: 2026-06-03

Branch: arc-24d-8e-habit-today-review-visibility-design

Scope: documentation/design only. No app code, schema, route, auth, role, package, dependency, generated runtime, or generated task changes.

## Executive Summary

CadreOS should not generate Entry, EntryRuntimeRef, or task records for Habit visibility. `HabitCompletion` remains the canonical habit occurrence and check-in record.

The current code already gives Habit activity useful operational visibility in Habit detail, Today, and Feed. Review is the main gap: it is Entry-only, so completed habit work and linked Habit context are not available for retrospective operational review except by navigating into Habit pages or Feed activity.

Recommended path for now: keep Today as-is, keep Feed as-is, and add a narrow future Review-oriented visibility slice that shows lightweight Habit activity references only where they help operational review. These references should remain non-actionable, clearly labeled, and should link back to Habit detail or the related Entry/Habit relationship context. They should not appear as generated tasks or runtime work objects.

## Current State

### Habit-Specific Surfaces

Habit pages are the canonical place for Habit details and check-in history.

- `/habits` lists readable habits with status, cadence, athlete/team context, last check-in, and total completion count.
- `/habits/[habitId]` shows Habit status, assignment, cadence, tracking mode, total check-ins, current streak, linked operational relationship count, lifecycle activity, and check-in history.
- `/habits/[habitId]` records check-ins through the Habit check-in route when `canCheckInHabit` allows it.
- `HabitCompletion` stores dated check-ins and remains canonical for occurrence history.
- `HabitActivity` stores lifecycle and relationship activity such as created, updated, checked in, completed, paused, restored, archived, relationship added, and relationship removed.
- Completion notes are protected by `canReadCompletionDetail`; broader users may see count/streak style summaries without per-completion detail.

### Today

Today already includes Habit visibility, but it is separate from Entry work items.

- `/today` loads `queryActionableHabitsToday`.
- Active habits are filtered through `isHabitActionableToday`.
- Today marks whether the current UTC day already has a `HabitCompletion`.
- Today shows a separate `Habits` list below Entry work items.
- A habit can be checked in directly from Today when the actor can check in and the habit is not already complete today.
- Today does not merge habits into the Work Items table.
- Today does not create Entry, EntryRuntimeRef, task, reminder, or runtime records for habit occurrences.

This is already the right shape for day-of action: Habits are visible and actionable without becoming tasks.

### Review

Review is currently Entry-only.

- `/entries/review` calls `queryReviewEntries`.
- `queryReviewEntries` queries `Entry` rows with status `DONE`, `CANCELLED`, or `ARCHIVED`.
- The Review page supports filtering by Entry type.
- Habit completions, HabitActivity, and OperationalRelationship Habit links are not queried for Review.
- There is no Habit review section, no linked Habit activity panel, and no per-HabitCompletion review row.

Review therefore cannot currently answer questions like:

- Which habits were checked in recently?
- Which completed Habit lifecycle events relate to a reviewed Entry?
- Which Entry decisions or tasks were supported by linked Habit activity?

### Feed

Feed already includes Habit activity in a lightweight way.

- `/feed` uses `aggregateOperationalFeed`.
- `aggregateOperationalFeed` merges recent `EntryActivity` and recent `HabitActivity`, sorts by timestamp, and returns the top activity rows.
- Habit activity uses `entryType: "HABIT_ACTIVITY"` in the feed adapter.
- `hrefForActivityItem` routes Habit activity rows back to `/habits/[habitId]`.
- Habit activity titles are derived through Habit-safe rendering helpers.
- Feed also includes a separate `Habits Today` section using `queryActionableHabitsToday`.

Feed gives useful recent-event visibility without turning Habit activity into Entry work.

### OperationalRelationship Links

Arc 24D.8D established the safe no-schema bridge through existing relationship patterns.

- `RelationshipPanel` appears on Entry detail and Habit detail.
- Supported foundation relationship node types are `ENTRY` and `HABIT`.
- Habit relationship targets are labeled as `Linked habit activity`.
- Habit-origin relationship panels state that `HabitCompletion` remains canonical.
- Entry-origin relationship panels clarify that linked Habit activity does not create tasks, runtime refs, or My Work visibility.
- `createFoundationRelationship` uses an idempotent `OperationalRelationship` upsert.
- Relationship link/unlink activity is written to Entry or Habit activity tables depending on the linked nodes.

The bridge is contextual and detail-page oriented. It is not currently surfaced in Today or Review list queries.

## Visibility Options

### Option A - Keep Habit Activity Only In Habit-Specific Surfaces For Now

Summary:

Do not add any new Today or Review Habit visibility. Keep Habit detail, Habit list, Today Habits, and Feed activity as the only Habit surfaces.

Benefits:

- Lowest release risk.
- No code, schema, data, or migration changes.
- Avoids clutter in Today and Review.
- Keeps Habit and Entry mental models distinct.
- Preserves `HabitCompletion` as the only occurrence record.

Risks:

- Review remains incomplete for operators who want retrospective Habit context.
- Linked Habit activity remains hidden unless users open detail pages or Feed.
- OperationalRelationship links are less valuable if they do not help Review.

UX impact:

- No visible UX change.
- Users continue to review habits through Habit pages and recent Feed rows.

Data/model impact:

- None.

Test impact:

- None beyond existing tests.

Release risk:

- Very low.

Risk of cluttering Today/Review:

- None.

Risk of users confusing habits with tasks:

- Very low.

### Option B - Show Lightweight Habit Activity References In Today Only

Summary:

Expand Today to show linked Habit activity references beyond the existing Habits section, such as linked Habit context near related Entry work items.

Benefits:

- Gives operators more day-of context when an Entry is related to a Habit.
- Uses existing `OperationalRelationship` links.
- Keeps references lightweight and non-task-like if clearly labeled.

Risks:

- Today already has a Habits section; adding more Habit references may duplicate information.
- Day-of action could become visually noisy.
- Users may mistake linked Habit context for additional required work.
- Relationship queries could add page complexity.

UX impact:

- Today could show related Habit context near Entry rows or in a separate linked context section.
- Clear labels would be required: `Linked habit activity`, `Context only`, and `No task generated`.

Data/model impact:

- No schema change if using `OperationalRelationship`.
- Would require query/display logic to read Entry-to-Habit links.

Test impact:

- Today query/display tests for linked Habit visibility.
- Access-policy tests to ensure out-of-scope Habit links do not leak.
- Tests confirming linked Habit references do not create Entry or runtime rows.

Release risk:

- Medium.

Risk of cluttering Today/Review:

- Today clutter risk is high because Today already contains actionable Habit rows.

Risk of users confusing habits with tasks:

- Medium to high unless references are visually separate from Work Items.

### Option C - Show Lightweight Habit Activity References In Review Only

Summary:

Keep Today unchanged. Add a narrow Review-only Habit context section or row group for recent or linked Habit activity that supports retrospective review.

Benefits:

- Addresses the main current visibility gap.
- Avoids duplicating Today Habit visibility.
- Fits Review's retrospective purpose better than Today.
- Can be non-actionable and clearly labeled as review context.
- Can use `HabitActivity`, `HabitCompletion`, and `OperationalRelationship` without generating runtime records.

Risks:

- Review could become less Entry-focused.
- Review currently filters by Entry type; adding Habit context may require a separate section or filter decision.
- If based on linked Entry relationships only, unlinked but important Habit completions may remain invisible.
- If based on all recent completions, Review may become noisy for high-frequency habits.

UX impact:

- Best first implementation would be a separate section, such as `Habit Review Context`, not mixed into the Entry table.
- Rows should link to Habit detail and label the source as `Habit check-in`, `Habit completion`, or `Linked habit activity`.
- No completion/check-in actions should appear in Review.

Data/model impact:

- No schema change if using existing `HabitCompletion`, `HabitActivity`, and `OperationalRelationship`.
- Query design must decide whether to show recent completions, linked Habit relationships, or both.

Test impact:

- Review query tests for access scoping and ordering.
- Rendering tests to ensure Habit references are non-actionable and clearly labeled.
- Regression tests that no EntryRuntimeRef or Entry records are created.

Release risk:

- Medium-low if implemented as a separate lightweight section.

Risk of cluttering Today/Review:

- Today clutter risk is none.
- Review clutter risk is medium and should be controlled by limits, filters, and linked-only defaults.

Risk of users confusing habits with tasks:

- Low to medium if Habit references stay outside the Entry table.

### Option D - Show Lightweight Habit Activity References In Both Today And Review

Summary:

Add linked Habit context to both Today and Review.

Benefits:

- Maximum visibility across day-of and retrospective surfaces.
- Reinforces EntryOps/Habit relationship links in multiple places.
- Could help coaches see Habit context beside related work across the workflow.

Risks:

- Highest clutter risk among lightweight options.
- Today already has Habit rows; additional linked references could feel duplicative.
- More testing and access-scope complexity.
- Greater chance users interpret Habit references as generated tasks.

UX impact:

- Requires careful separation of `Work Items`, `Habits`, and `Linked habit activity`.
- Review likely still needs a distinct Habit context section.

Data/model impact:

- No schema change if using existing links and Habit records.
- Multiple query surfaces would need consistent access and label behavior.

Test impact:

- Today tests, Review tests, relationship access tests, and regression tests.
- More fixtures needed to cover linked and unlinked Habit context.

Release risk:

- Medium-high.

Risk of cluttering Today/Review:

- High.

Risk of users confusing habits with tasks:

- High unless presentation is extremely restrained.

### Option E - Show Habit Activity Only When Explicitly Linked To An EntryOps Object

Summary:

Only surface Habit context in Today or Review when a Habit is explicitly linked to an Entry through `OperationalRelationship`.

Benefits:

- Uses the 24D.8D bridge directly.
- Avoids showing every HabitCompletion globally.
- Makes visibility operator-driven and intentional.
- Reduces clutter compared with all recent Habit completions.
- Keeps data model unchanged.

Risks:

- Important unlinked Habit activity will not appear.
- Requires users or operators to create links consistently.
- Relationship links point to a Habit, not a specific dated `HabitCompletion`.
- If surfaced in Today, it can still duplicate existing Today Habit rows.

UX impact:

- Best used in Review: show linked Habit context for reviewed Entry rows or in a linked context section.
- Labels must make it clear that linked Habit activity is contextual, not a task instance.

Data/model impact:

- No schema change.
- Uses existing `OperationalRelationship` rows and readable Habit summaries.
- Per-check-in linkage remains unavailable without a later model decision.

Test impact:

- Relationship query tests for Entry-to-Habit and Habit-to-Entry links.
- Review display tests for linked context.
- Access-policy tests for linked Habit visibility.

Release risk:

- Medium-low.

Risk of cluttering Today/Review:

- Low to medium, depending on limits and whether Today is included.

Risk of users confusing habits with tasks:

- Low if shown in Review as contextual rows, medium if shown inside Today Work Items.

## Recommendation

Recommend Option C with an Option E constraint for the first implementation:

Add lightweight Habit activity references to Review only, and prefer explicitly linked Habit context first. Keep Today unchanged because Today already has a dedicated Habits section and check-in flow.

The first implementation should not add Habit rows to the Entry Review table. Instead, it should introduce a small, separate Review section that can show linked Habit context for reviewed Entries or recent linked Habit activity. It should use labels such as:

- `Linked habit activity`
- `Habit check-in`
- `Habit completion`
- `Context only`

This preserves the existing source-of-truth decision:

- `HabitCompletion` remains canonical for check-ins.
- `HabitActivity` remains the lightweight feed/lifecycle event source.
- `OperationalRelationship` remains the link-only EntryOps bridge.
- No generated runtime or task records are created.

Why not Today now:

- Today already includes actionable habits through `queryActionableHabitsToday`.
- Adding linked Habit references to Today would likely duplicate or clutter day-of work.
- Today should stay action-focused: Entry work items plus a separate Habits check-in list.

Why Review now:

- Review is the visible gap.
- Retrospective workflows benefit from seeing linked Habit context.
- Review can present Habit references as context without action buttons.
- Review is a safer place to pilot relationship-based Habit visibility before considering broader EntryOps surfaces.

## Follow-Up Implementation Slices

### 24D.8F - Add Review-Only Linked Habit Context

Goal:

Show a small, non-actionable Habit context section on the Review page using existing `OperationalRelationship` and Habit access patterns.

Allowed files/modules:

- `app/(dashboard)/entries/review/page.tsx`
- `lib/entry-relationships.ts`
- `lib/operational-feed/queries.ts` only if a Review-specific helper is needed
- `lib/habits/access.ts` only for existing access helper usage, not policy changes
- Habit/EntryOps Review tests
- Planning documentation

Non-goals:

- No generated Entry records.
- No generated EntryRuntimeRef records.
- No generated recurring task records.
- No Today changes.
- No Feed redesign.
- No schema changes.
- No auth, role, permission, or route structure changes.
- No dependency changes.

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted Review and relationship tests if added or changed
- `npm test` if practical; document unrelated failures separately

Acceptance criteria:

- Review shows linked Habit context separately from the Entry table.
- Habit context is clearly labeled as `Linked habit activity` or equivalent.
- Habit context links back to Habit detail.
- Access scoping prevents unreadable Habit context from appearing.
- No Entry, EntryRuntimeRef, task, reminder, notification, or runtime objects are created.
- Today remains unchanged.

### 24D.8G - Evaluate Habit Review Filters And Completion Summaries

Goal:

Decide whether Review should include filtered Habit completion summaries beyond explicitly linked context.

Allowed files/modules:

- Review query/display helpers
- Habit completion summary helpers
- Habit access helpers only for existing policy reuse
- Review tests
- Planning documentation

Non-goals:

- No automatic task generation.
- No per-occurrence runtime records.
- No schema redesign.
- No broad Review redesign.
- No notification system.
- No role/permission changes unless explicitly approved.
- No dependency changes.

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted Habit/Review tests if added or changed
- `npm test` if practical; document unrelated failures separately

Acceptance criteria:

- Product decision is documented for whether Review should show recent HabitCompletion summaries.
- If implemented, completion summaries are limited, clearly labeled, and non-actionable.
- Completion notes remain protected by existing completion-detail access policy.
- `HabitCompletion` remains canonical.
- No generated runtime/task records are created.

## Guardrails

- Do not generate recurring task records.
- Do not generate `EntryRuntimeRef` records.
- Do not add Habit occurrences to the Entry work table as tasks.
- Do not broadly redesign Today.
- Do not broadly redesign Review.
- Do not add notification or reminder behavior.
- Do not redesign schema.
- Do not change auth, roles, permissions, or route structure unless explicitly approved.
- Do not weaken Habit access or completion-detail privacy.
- Do not treat `OperationalRelationship` as a per-check-in occurrence link; it currently links nodes such as Habit and Entry, not individual `HabitCompletion` rows.
