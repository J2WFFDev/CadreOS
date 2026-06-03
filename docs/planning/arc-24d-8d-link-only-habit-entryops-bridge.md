# Arc 24D.8D Link-Only Habit EntryOps Bridge

Date: 2026-06-03

Branch: arc-24d-8d-link-only-habit-entryops-bridge

Scope: Habit activity and EntryOps contextual linking only. No schema, route, auth, role, package, dependency, notification, recurrence engine, or automatic task generation changes.

## Summary

Arc 24D.8D uses the existing `OperationalRelationship` graph as the no-schema bridge between Habit activity and EntryOps context.

`HabitCompletion` remains the canonical habit occurrence and check-in record. The bridge is contextual only: a habit can be linked to an Entry or another Habit through existing relationship flows, and those links can be displayed as "Linked habit activity" in EntryOps context. The bridge does not create `Entry`, `EntryRuntimeRef`, task instances, reminders, notifications, or schedule-expanded work items.

## Existing Link Path Used

The existing safe path is:

- `RelationshipPanel` on Habit and Entry detail pages.
- `/relationships/link` and `/relationships/unlink` route handlers.
- `createFoundationRelationship` and `removeFoundationRelationship` in `lib/entry-relationships.ts`.
- `OperationalRelationship` rows between supported foundation node types: `ENTRY` and `HABIT`.
- Relationship activity writes to `EntryActivity` or `HabitActivity` depending on the linked nodes.

Why this path is safe for 24D.8D:

- It already supports `HABIT` and `ENTRY` node types.
- It uses an upsert keyed by organization, from node, to node, and relationship type, so repeated saves are idempotent for the same relationship.
- It checks source write access and target read access before creating links.
- It requires no schema changes.
- It does not alter Today, Review, operational feed, schedule expansion, recurrence, or runtime generation semantics.

## What Changed

- Added a shared relationship context label for foundation node types.
- Labeled Habit relationship targets and summaries as "Linked habit activity" instead of the more generic "Habit" in relationship context.
- Updated relationship panel helper copy so Habit-origin links explicitly state that `HabitCompletion` remains the canonical check-in record.
- Updated relationship panel helper copy for Entry-origin context that includes Habit targets, clarifying that linked habit activity does not create tasks, runtime refs, or My Work visibility.
- Added a focused helper test for the contextual Habit relationship label.

## Behavior Confirmed

- Habit detail already exposes relationship linking with `HABIT` as source and `ENTRY`/`HABIT` as available targets.
- Entry detail already exposes relationship linking with `ENTRY` as source and `ENTRY`/`HABIT` as available targets.
- `createFoundationRelationship` normalizes supported relationships and uses `db.operationalRelationship.upsert`, preserving idempotency for repeated saves of the same link.
- Relationship creation writes contextual activity to linked Entry or Habit records.
- The bridge is link-only and does not create or mutate `HabitCompletion`.
- The bridge is link-only and does not create `EntryRuntimeRef`.

## Deferred Work

- No automatic runtime objects for habit occurrences.
- No generated recurring task instances.
- No new recurrence or schedule expansion engine.
- No migration or backfill for historical `HabitCompletion` records.
- No Today, Review, Assigned, or operational feed redesign.
- No notification or reminder logic.
- No schema change to add Habit or HabitCompletion as `EntryRuntimeRef` source model types.

## Risks

- The bridge links a Habit as contextual activity, not a specific dated `HabitCompletion`. If product requirements need per-check-in links, a later schema or runtime design decision may be required.
- Users may expect linked habit activity to appear as actionable work in Today or My Work. Current copy clarifies that the link is contextual only.
- Existing relationship activity can record that a link was added or removed, but it does not represent completion status or schedule due state.
- Review and Assigned views remain Entry-centered and do not treat habit occurrences as runtime work objects.

## Test And Validation Notes

Focused testing should cover:

- Relationship helper labels for Habit context.
- Relationship idempotency through existing `OperationalRelationship` upsert behavior.
- Entry-to-Habit and Habit-to-Entry relationship visibility under existing access policies.
- Existing Habit check-in tests to confirm `HabitCompletion` remains canonical.

Validation for this slice:

- `npm run typecheck`: passed.
- `npm run build`: passed with the existing Next.js middleware convention warning.
- Targeted relationship tests passed: `npx tsx --test tests/entry-relationships/helpers.test.ts tests/entry-relationships/service.test.ts`.
- `npm test` was run and failed on unrelated existing Gear bulk CSV coverage in `tests/gear-bulk-ops/csv.test.ts`, where the generated template includes `asset_id` and the test expectation does not.

## Recommended Next Slice: 24D.8E

Goal:

Evaluate whether selected habit workflows need an optional runtime presentation in Today or Review while keeping `HabitCompletion` canonical.

Allowed files/modules:

- Habit Today/feed/query helpers
- EntryOps Today/Review display helpers only if needed
- Existing relationship helpers
- Habit-related or EntryOps display tests
- Planning documentation

Non-goals:

- No schema redesign
- No automatic task generation
- No recurring task engine
- No notification system
- No role, permission, or route structure changes
- No dependency changes

Validation:

- `npm run typecheck`
- `npm run build`
- `npm test` or targeted Habit/EntryOps tests if tests are added or affected

Acceptance criteria:

- Product decision is documented for whether linked habit activity should appear in Today or Review beyond the existing Habit-specific surfaces.
- Any UI change remains explicitly contextual and does not imply generated tasks or runtime refs.
- `HabitCompletion` remains canonical for check-ins.
- No duplicate habit occurrence records are created.
