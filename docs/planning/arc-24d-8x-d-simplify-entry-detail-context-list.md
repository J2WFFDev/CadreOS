# Arc 24D.8X-D - Simplify Entry Detail Context And List Presentation

## Summary

Arc 24D.8X-D simplifies Entry detail presentation after the EntryOps product model was corrected and new Entries were normalized to default Inbox lists.

This slice changes UI wording and display only. It does not change schema, route structure, auth, permissions, relationship behavior, Task/Habit conversion, dependencies, or production data.

## UI Sections Removed Or Renamed

Removed from Entry detail:

- `Legacy context (read-only)`
- Source/follow-up legacy context links in the main detail UI
- The extra main section heading `Context` above relationship links

Renamed or simplified:

- `Related Items / Context` is now `Related Items`
- Relationship helper text now says relationships are informational instead of `Context only`
- The right-side `Context` block is now `Details`
- `Relationships` is now `Related items`
- `Linked operational records` is now `Related records`
- `Related operational records` is now `Related records`

`Metadata` remains limited to audit/system facts:

- Created by
- Last updated by
- Created date
- Updated date

Activity / history remains unchanged.

## List Display

Entry detail now formats list display as user-facing list information:

- If the Entry is assigned to an Inbox list, the list label includes `(Inbox)`.
- If the Entry is assigned to a non-Inbox list, the selected list name is shown.
- If the Entry has a list that is not in the actor's visible list set, the detail page still provides a `View list` link.
- If a legacy Entry still has `listId = null`, the page displays `Unlisted legacy item`.

The edit form no longer presents `No list` as the normal list state. Legacy null-list Entries still show `Assign Inbox on save`, and saving the form continues to use the Arc 24D.8X-C default Inbox behavior.

## Deferred Work

Deferred to later slices:

- Full Entry detail type-specific layout redesign.
- Any migration or cleanup for existing null-list Entries.
- Consolidating Metadata and Details into a reusable component.
- Renaming relationship action internals or changing relationship behavior.
- Task-to-Habit conversion.
- Removing legacy source fields from data models or backend projections.

## Validation Performed

Validation scope:

- `npm run typecheck`
- `npm run build`

Targeted tests were not added because this slice is mostly server-rendered copy and section composition. TypeScript/build validation covers the changed server component and relationship panel.

## Recommended Next Slice

Recommended next slice: 24D.8X-E - implement Task-to-Habit conversion using real Habit records, while keeping `HabitCompletion` canonical and preserving Entry-to-Habit relationships as informational links.
