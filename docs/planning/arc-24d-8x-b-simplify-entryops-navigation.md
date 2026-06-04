# Arc 24D.8X-B - Simplify EntryOps Navigation

## Summary

Arc 24D.8X-B updates the primary EntryOps navigation to match the simplified product model from the Arc 24D.8X design note. This slice changes navigation visibility only. It does not delete routes, change permissions, change schema, alter relationship behavior, or implement Task-to-Habit conversion.

## Routes Kept Visible

The primary EntryOps sidebar now keeps these destinations visible:

- Inbox: `/entries/inbox`
- Lists: `/lists`
- All Work Items: `/entries`
- Habits: `/habits`
- Journal Library: `/prompts`

`/prompts` remains the route because the current reusable journal library is implemented as the Journal Prompt Library. The navigation label now uses the product-facing "Journal Library" name.

## Routes Hidden From Primary Navigation

These routes are no longer primary EntryOps sidebar destinations:

- My Work: `/assigned`
- Today: `/today`
- Upcoming: `/upcoming`
- Review: `/entries/review`
- Activity Feed: `/feed`
- Journals: `/journals`
- Prompt Assignments: `/prompt-assignments`

The removed items are hidden from primary navigation because they currently represent workflow, review, feed, assignment, or experimental surfaces that should not compete with the simplified EntryOps model.

## Routes Preserved For Direct Access

No route files were deleted or moved. Existing routes should continue to function when opened directly or linked from in-app workflows:

- `/assigned`
- `/today`
- `/upcoming`
- `/entries/review`
- `/entries/schedule`
- `/feed`
- `/journals`
- `/prompt-assignments`
- `/entry-runtime/[entryRuntimeRefId]`
- Relationship and object-link action routes
- Existing task, note, decision, journal, prompt, and habit subroutes

This keeps the implementation reversible and avoids disrupting deep links or existing operational flows.

## Future Destinations That May Return Later

The following destinations may return after their product semantics are intentionally stabilized:

- Today, if it becomes a clear daily operating view rather than generated runtime/task expansion.
- Review, if it has a focused operational review role distinct from All Work Items.
- Feed, if it becomes a secondary audit/activity surface rather than primary navigation.
- My Work, if assignment and ownership rules are clarified under the new Entry/List model.
- Prompt Assignments, if Journal Library assignment workflows need a dedicated staff surface.
- Journals, if individual journal entries need a separate primary library from reusable journal prompts.
- Runtime-focused views, if EntryRuntimeRef behavior is intentionally reintroduced as a visible product surface.
- Relationship-focused views, if relationship management becomes a standalone workflow instead of contextual detail-page behavior.

## Validation Notes

Navigation tests were updated to lock the simplified EntryOps item list and labels:

- Inbox
- Lists
- All Work Items
- Habits
- Journal Library

The validation scope for this slice is:

- `npm run typecheck`
- `npm run build`

`npm test` is not required by the task, but targeted navigation tests are useful if additional confidence is needed.
