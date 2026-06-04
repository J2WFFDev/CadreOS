# Arc 24D.8X-M — Allow Entry Owners To Self-Edit

## Summary

This slice fixes Entry detail editing for owner-created work items. A user who creates or directly owns an Entry can now edit that Entry even when their active persona is Athlete, Guardian, or another limited/self-service role.

## Root Cause

Recent visibility work correctly allowed Entry owners to open their own Entry detail pages, but the edit form and update route still used `canWriteEntries`. That helper is staff-role oriented, so self-service roles could read their own Entries but still saw:

`Work item editing is unavailable for your role.`

The update and complete routes had the same role-only write gate before the Entry-specific ownership check could matter.

## Edit Authorization Model

Entry access remains layered:

- EntryOps visibility controls whether the Entry can be loaded by direct URL or action route.
- Staff/elevated roles keep their existing write behavior through `canWriteEntries`.
- Self-edit permission now allows the current person to edit when they are:
  - `createdByPersonId`
  - `assignedToPersonId`
  - an active `EntryAssignment` participant

Guardian dependent visibility remains read-oriented. A guardian can edit their own Entries, but a guardian relationship alone does not grant edit permission over a dependent athlete Entry.

## Changed Files and Routes

Changed helper:

- `lib/entryops/visibility.ts`

Changed routes/pages:

- `/entries/[entryId]`
- `/entries/[entryId]/update`
- `/entries/[entryId]/complete`

Changed tests:

- `tests/entryops/visibility.test.ts`

The Entry detail page now shows the edit form for role-authorized users or self-edit users. Owner/self-edit users can save ordinary Entry fields and complete their own task Entries.

## What Remains Restricted

- Soft delete remains behind existing role/action-route protections.
- Note-to-task and task-to-habit conversion controls remain behind the existing role write gate.
- Direct event program/team/calendar scope changes remain blocked for self-edit users without staff write permission.
- Reassignment, organization ownership changes, and broad scope changes remain out of scope.

## Validation

- `npx tsx --test tests/entryops/visibility.test.ts`
- `npm run typecheck`
- `npm run build`

## Recommended Next Slice

24D.8X-N — Audit assignee completion and owner lifecycle controls.

Goal: decide whether assignees and creators should receive additional non-administrative lifecycle actions, such as archive/restore for their own Entries, without exposing conversion, reassignment, or scope-management behavior.
