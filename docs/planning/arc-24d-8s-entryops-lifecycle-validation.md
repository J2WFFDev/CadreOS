# Arc 24D.8S EntryOps Lifecycle Validation

## Audit Summary

- Generic Entry archive previously combined `ARCHIVED` with `deletedAt`, which
  removed records from detail and left no generic restore path.
- All Entries defaulted to only Open/In Progress instead of every non-archived
  Entry. Inbox and List detail did not explicitly exclude archived Entries.
- Journals and Habits already had distinct archive/restore workflows and
  policies. Journal Final/Done and Habit completion activity are not archive.

## Implemented Contract

- Default All Entries, Inbox, and List working views exclude archived Entries.
- Explicit All Entries archived filtering includes authorized historical
  archives, including records that also have legacy `deletedAt`.
- Generic Entry archive and restore use the existing elevated `entry.delete`
  permission and exclude Journals.
- Archive records status history and activity without deleting the Entry.
- Restore returns to the latest recorded pre-archive status, falling back to
  Open, and clears legacy `deletedAt`.
- Archive and restore preserve Creator, Author, Assignee, Context/List,
  Visibility, and relationships.
- Normal Entry editing cannot set or clear Archived; lifecycle actions are
  explicit.

## Manual Validation Checklist

- Verify a permitted manager can archive a generic Entry and it disappears
  from All Entries default, Inbox, and its List.
- Verify the archived filter shows that Entry and its detail remains readable.
- Verify restore returns the Entry to its prior workflow status and original
  metadata/context.
- Verify an actor without the existing archive permission cannot archive or
  restore.
- Verify Journal Draft/Final/Archived privacy and Guardian visibility remain
  unchanged.
- Verify Habit active/paused/archived filters and completion history remain
  unchanged.

Manual role validation was not run locally because it requires seeded,
role-specific application sessions. Automated wiring, lifecycle, permission,
typecheck, test, and build validation cover the implementation contract.
