# Arc 24D.8F Review-Only Linked Habit Context

Date: 2026-06-03

Branch: arc-24d-8f-review-only-linked-habit-context

Scope: Review-only linked Habit context using existing `OperationalRelationship` data. No Today, schema, route, auth, role, package, dependency, notification, recurrence, runtime generation, or task generation changes.

## Summary

Arc 24D.8F adds lightweight Habit context to the EntryOps Review page when reviewed Entry records already have an existing relationship to a Habit.

The implementation keeps `HabitCompletion` canonical. It does not create `Entry`, `EntryRuntimeRef`, `Task`, reminder, notification, recurrence, or generated runtime records. The Review page only reads existing `OperationalRelationship` rows and shows linked Habit context as non-actionable review information.

## What Changed

- Added a read-only helper, `listReviewLinkedHabitContextForEntries`, in `lib/entry-relationships.ts`.
- The helper batches reviewed Entry ids and returns readable Entry-to-Habit relationship context grouped by Entry id.
- The helper reuses existing relationship type labels, Habit status labels, and Habit access policy.
- Updated `/entries/review` to show a `Linked habits` column.
- Linked Habit context renders as informational text with a link back to Habit detail.
- Added targeted service coverage for grouping readable linked Habit context by Entry id.

## How Linked Habit Context Appears In Review

When a reviewed Entry has an existing `OperationalRelationship` to a readable Habit, the Review table shows:

- the relationship label, such as `Supports`
- the context label `Habit activity`
- the linked Habit title
- the Habit status
- the optional relationship note

The linked Habit title navigates to `/habits/[habitId]`. There are no check-in, complete, task, runtime, or generated-work actions in the Review table.

## Confirmed Non-Changes

- Today was not changed.
- Feed was not changed.
- Habit pages were not changed.
- `HabitCompletion` remains the canonical check-in/occurrence record.
- No generated `Entry` records were added.
- No generated `EntryRuntimeRef` records were added.
- No generated `Task` records were added.
- No recurring task/runtime generation was added.
- No recurrence engine was introduced.
- No schema, auth, role, permission, route, package, or dependency changes were made.

## Tests And Validation

Validation performed for this slice:

- `npm run typecheck`: passed.
- `npm run build`: passed with the existing Next.js middleware convention warning.
- `npx tsx --test tests/entry-relationships/helpers.test.ts tests/entry-relationships/service.test.ts`: passed, 10/10.
- `npm test`: run; failed on unrelated existing Gear bulk CSV coverage in `tests/gear-bulk-ops/csv.test.ts`, where the generated template includes `asset_id` and the test expectation does not.

## Risks

- Relationship links are Habit-level context, not per-`HabitCompletion` links. Review does not yet show a specific dated check-in unless the user opens Habit detail.
- Review can now contain more visual information per row. The current implementation limits Habit context per Entry to keep the table readable.
- Users may still need product guidance on when to link a Habit to an Entry so Review context is meaningful.
- Completion notes remain governed by Habit detail policy; Review only shows relationship notes, not check-in notes.

## Recommended Next Slice

Arc 24D.8 is functionally complete for the no-schema, link-only Habit EntryOps bridge after this slice if Review-only linked context is accepted.

Optional next slice:

### 24D.8G - Evaluate Habit Review Completion Summaries

Goal:

Decide whether Review should show limited recent `HabitCompletion` summaries beyond explicitly linked Habit context.

Allowed files/modules:

- Review query/display helpers
- Habit completion summary helpers
- Existing Habit access helpers
- Review and Habit tests
- Planning documentation

Non-goals:

- No generated Entry records.
- No generated EntryRuntimeRef records.
- No generated Task records.
- No recurrence engine.
- No notification logic.
- No schema redesign.
- No auth, role, permission, or route changes unless explicitly approved.

Validation:

- `npm run typecheck`
- `npm run build`
- targeted Habit/Review tests if implementation changes are made

Acceptance criteria:

- A product decision is documented for whether linked Habit context is enough.
- If summaries are added, they are limited, non-actionable, and clearly labeled.
- Completion-detail privacy remains intact.
- `HabitCompletion` remains canonical.
