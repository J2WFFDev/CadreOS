# Arc 24D.8X-J — Enforce Entry Action Route Visibility

## Summary

This slice audits Entry action routes for direct POST bypass risk and applies the EntryOps visibility filter from Arc 24D.8X-I to high-risk mutation routes.

The enforcement does not grant new mutation rights. Existing write/manage permission checks remain in place. The new guard ensures that even an actor with mutation permission cannot act on an Entry that is outside the EntryOps direct-detail visibility model.

## Routes Audited

- `/entries/[entryId]/update`
- `/entries/[entryId]/complete`
- `/entries/[entryId]/delete`
- `/entries/[entryId]/convert-note-to-task`
- `/entries/[entryId]/convert-task-to-habit`
- `/entries/[entryId]/create-follow-up`
- `/entries/link`
- `/entries/unlink`
- `/entries/object-links/link`
- `/entries/object-links/unlink`
- `/entries/relationships/link`
- `/entries/relationships/unlink`
- `/entries/quick-add`
- `/entries/[entryId]` detail page context from 24D.8X-I

No active Entry comments or reminder mutation routes were found under the Entry route tree in this audit.

## Routes Changed

The following routes now apply the EntryOps action visibility filter before mutating an Entry-scoped record:

- `/entries/[entryId]/update`
- `/entries/[entryId]/complete`
- `/entries/[entryId]/delete`
- `/entries/[entryId]/convert-note-to-task`
- `/entries/[entryId]/convert-task-to-habit`
- `/entries/[entryId]/create-follow-up`
- `/entries/link`
- `/entries/unlink`
- `/entries/object-links/link`
- `/entries/object-links/unlink`
- `/entries/relationships/link`
- `/entries/relationships/unlink`

The shared helper added in this slice is:

- `resolveEntryOpsEntryActionVisibilityWhere`
- `countVisibleEntryOpsActionEntries`

Both reuse the same EntryOps visibility context and detail visibility where-clause established in Arc 24D.8X-I.

## Routes Already Protected

Several changed routes already had broad write/manage permission checks such as `canWriteEntries`, `requirePermission("entry.update")`, or `requirePermission("entry.delete")`.

This PR preserves those checks and adds record-level visibility filtering. The result is:

- write/manage permission still decides whether the actor may mutate EntryOps records at all
- EntryOps visibility decides whether the specific Entry id is in scope for that actor

## Routes Deferred

- `/entries/quick-add` creates new records rather than mutating an existing Entry id, so direct Entry visibility is not applicable.
- Entry detail read enforcement was already handled by Arc 24D.8X-I.
- Non-Entry route trees such as `/journals/[entryId]`, `/tasks/[taskId]`, and `/entry-runtime/[entryRuntimeRefId]` should be audited separately if product scope expands.
- Relationship target visibility for non-Entry graph nodes remains governed by existing operational graph and domain-specific helpers.

## Read Visibility vs Write Authorization

This slice keeps read visibility and write authorization separate.

Entry visibility permits access when the actor is the creator, direct assignee, active `EntryAssignment` participant, guardian of a dependent athlete owner/assignee, org admin, or supported program/team scoped actor.

Mutation still requires the existing write/manage checks. For example, an athlete may be able to see their own Entry detail, but this slice does not add new athlete mutation privileges to update, complete, delete, conversion, relationship, or object-link routes.

## Validation

- `npm run typecheck`
- `npm run build`
- Targeted visibility tests:
  - `npx tsx --test tests/entryops/visibility.test.ts`

## Recommended Next Slice

24D.8X-K — Audit non-Entry detail and action route visibility.

Goal: review journal, task, runtime, habit, and relationship-adjacent detail/action routes for the same direct-route bypass class while preserving their existing domain-specific permission models.
