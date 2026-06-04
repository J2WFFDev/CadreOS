# Arc 24D.8X-C - Normalize Inbox As Default Entry List

## Summary

Arc 24D.8X-C normalizes Inbox as the default `EntryList` for newly created Entries. Inbox remains an `EntryList` with `isInbox = true`; `/entries/inbox` and existing list routes are preserved.

This slice does not change schema, routes, auth, relationships, Task/Habit conversion, dependencies, or package files.

## How Inbox Is Resolved

The existing `resolveOrCreateDefaultList` helper remains the authoritative list creation path. This slice adds a small Entry-specific resolver:

- Team-scoped Entries use the Team Inbox.
- Actor-scoped Entries use the actor's Personal Inbox.
- Entries without team or actor context fall back to the Organization Inbox.

Each Inbox is created lazily if it does not exist, using the existing `EntryList.isInbox = true` model.

## Create Paths Updated

The following Entry creation paths now default to Inbox when no explicit list is selected:

- Quick Capture through `createOperationalEntry`.
- Standard operational Entry creation through `createOperationalEntry`.
- Task wrapper creation through `upsertEntryFromTask`.
- Note wrapper creation through `upsertEntryFromNote`.
- Entry follow-up creation.
- Journal draft creation.
- Operational workflow and follow-up-chain Entry step creation.

Quick Capture already resolved Team or Personal Inbox before this slice. The shared service now also defaults internally for other callers. The existing Quick Capture schema fallback remains available for older setup states where `Entry.listId` is unavailable.

## Entry Detail Behavior

Entry detail still displays the selected list and links to it. For legacy Entries that still have `listId = null`, the detail sidebar labels the state as `Legacy: no list assigned`.

When a legacy null-list Entry is saved from the detail form without selecting a list, the update route resolves the appropriate Inbox and assigns it. The form no longer presents "No list" as a normal target.

## Existing Null-List Entries

Existing Entries with `listId = null` may remain in the database. This slice intentionally does not run a broad migration or cleanup job.

Recommended follow-up:

- Add a later data cleanup slice to identify Entries with `listId = null`.
- Resolve the appropriate Inbox by team, creator, or organization context.
- Backfill `listId` in a controlled migration or admin cleanup task after approval.

## Validation Performed

- Targeted Entry/List defaulting tests.
- `npm run typecheck`
- `npm run build`

## Recommended Next Slice

Proceed to 24D.8X-D: simplify Entry detail context and list presentation. That slice can make the Entry detail page visually clearer now that normal new Entries have List context by default.
