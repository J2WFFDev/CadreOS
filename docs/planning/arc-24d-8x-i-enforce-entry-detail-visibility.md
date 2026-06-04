# Arc 24D.8X-I — Enforce Entry Detail Visibility Rules

## Summary

This slice adds direct URL enforcement for Entry detail pages using the EntryOps visibility model established for All Work Items defaults.

The change protects `/entries/[entryId]` from showing records that are outside the actor's allowed EntryOps scope while preserving the distinction between:

- default view filtering
- direct detail visibility
- write/manage permissions

## Enforcement Approach

Entry detail now resolves the actor's EntryOps visibility context before loading the record.

The page uses:

- `resolveEntryOpsVisibilityContext`
- `resolveEntryOpsAllWorkDefaultVisibility`
- `buildEntryOpsEntryDetailVisibilityWhere`

The detail query combines the requested `entryId`, organization scope, non-deleted state, and the EntryOps detail visibility filter. If the entry is outside the actor's allowed scope, the page behaves like the item is not available in the active organization.

Edit controls still use the existing Entry access helper. This means visibility and edit capability remain separate.

## Ownership Rules

An actor can view an Entry detail page when the Entry is visible through any of these existing EntryOps paths:

- the actor created the Entry
- the actor is the direct assignee
- the actor has an active `EntryAssignment`
- the actor is a guardian of a dependent athlete who created or is assigned to the Entry
- the actor has organization-wide admin visibility
- the actor has supported program or team scope visibility

Ownership follows the person record, not the active persona. If a person creates work as an admin and later views CadreOS as an athlete persona, their own Entry remains visible.

## Guardian Behavior

Guardian visibility uses linked dependent athlete ids from the EntryOps visibility context.

Guardians can view dependent athlete Entries when the dependent is the creator, assignee, or active assignment target. Guardians cannot view unrelated athlete Entries through direct URLs.

## Admin Behavior

Organization admins retain organization-wide Entry detail visibility. Existing edit/manage behavior remains controlled by the existing Entry authorization helper.

## Remaining Gaps

- Direct-route enforcement for other Entry actions should be audited separately, especially update, complete, delete, restore, and conversion routes.
- Coach and assistant coach expansion remains conservative unless a supported team/athlete scope helper is added later.
- Program/team visibility is limited to the current relationship data already used by the EntryOps visibility helper.
- This slice does not change All Work Items default filtering.

## Validation

- `npm run typecheck`
- `npm run build`
- Targeted visibility tests:
  - `npx tsx --test tests/entryops/visibility.test.ts`

## Recommended Next Slice

24D.8X-J — Audit Entry action direct-route enforcement.

Goal: inspect update, completion, delete/restore, conversion, relationship, and object-link routes to confirm direct POST access uses the same visibility/edit boundaries.
