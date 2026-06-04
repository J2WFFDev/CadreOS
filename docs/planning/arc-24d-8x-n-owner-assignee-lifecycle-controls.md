# Arc 24D.8X-N — Owner And Assignee Lifecycle Controls

## Summary

This audit reviews Entry lifecycle permissions after the recent EntryOps visibility and self-edit work. Current behavior separates direct URL visibility, self-edit capability, and administrative/staff lifecycle controls.

No code changes were made in this slice. The current behavior is internally defensible, but the product policy now needs a follow-up implementation pass to decide which non-administrative lifecycle actions should be available to creators, assignees, and active `EntryAssignment` participants.

## Current Permission Layers

EntryOps currently uses several permission layers:

- Direct visibility: `resolveEntryOpsAllWorkDefaultVisibility` and `buildEntryOpsEntryDetailVisibilityWhere`
- Self-edit: `canEditEntryOpsEntry`, which allows `canWriteEntries` or creator/direct assignee/active `EntryAssignment` participant
- Staff write: `canWriteEntries` and `requirePermission("entry.update")`
- Staff manage/delete: `requirePermission("entry.delete")`
- Relationship panel write: `canWriteRelationshipSource`

Ownership follows the person. Active persona switching does not remove visibility or self-edit access for Entries where the current person is creator, direct assignee, or active assignment participant.

## Lifecycle Permission Matrix

| Action | Creator / owner | Direct assignee | Active EntryAssignment participant | Guardian dependent | Scoped elevated role | Org Admin |
| --- | --- | --- | --- | --- | --- | --- |
| View detail | Allowed by EntryOps visibility | Allowed by EntryOps visibility | Allowed by EntryOps visibility | Allowed for linked dependent visibility | Allowed where team/program scope matches | Allowed organization-wide |
| Edit title/content/basic fields | Allowed by `canEditEntryOpsEntry` | Allowed by `canEditEntryOpsEntry` | Allowed by `canEditEntryOpsEntry` | Not allowed by relationship alone | Allowed by `canWriteEntries` where scoped | Allowed |
| Complete task/follow-up | Allowed by `canEditEntryOpsEntry` | Allowed by `canEditEntryOpsEntry` | Allowed by `canEditEntryOpsEntry` | Not allowed by relationship alone | Allowed by `canWriteEntries` where scoped | Allowed |
| Archive / soft delete | Not allowed unless role also grants `entry.delete` | Not allowed unless role also grants `entry.delete` | Not allowed unless role also grants `entry.delete` | Not allowed | Allowed only where `requirePermission("entry.delete")` grants it | Allowed |
| Restore | No generic Entry restore route found | No generic Entry restore route found | No generic Entry restore route found | No generic Entry restore route found | No generic Entry restore route found | No generic Entry restore route found |
| Convert task to habit | Hidden and route-gated unless `entry.update` plus Habit create access | Same | Same | Not allowed | Allowed where `entry.update` and Habit create access pass | Allowed |
| Convert note to task | Hidden and route-gated unless `entry.update` plus `task.create` pass | Same | Same | Not allowed | Allowed where both permissions pass | Allowed |
| Create follow-up | Route-gated by `entry.update` plus `task.create`; not self-edit enabled | Same | Same | Not allowed | Allowed where both permissions pass | Allowed |
| Entry-to-entry link / unlink | Route-gated by `entry.update` and both Entries visible | Same | Same | Not allowed | Allowed where `entry.update` passes and Entries are visible | Allowed |
| Object link / unlink | Route-gated by `entry.update` and Entry visibility | Same | Same | Not allowed | Allowed where `entry.update` passes and Entry is visible | Allowed |
| Reassignment | No general detail form reassignment control found | No general detail form reassignment control found | No general detail form reassignment control found | Not allowed | Deferred / route-specific | Deferred / route-specific |
| Ownership changes | No general ownership-change route found | No general ownership-change route found | No general ownership-change route found | Not allowed | Deferred / route-specific | Deferred / route-specific |

## Routes Audited

- `/entries/[entryId]`
- `/entries/[entryId]/update`
- `/entries/[entryId]/complete`
- `/entries/[entryId]/delete`
- `/entries/[entryId]/convert-task-to-habit`
- `/entries/[entryId]/convert-note-to-task`
- `/entries/[entryId]/create-follow-up`
- `/entries/link`
- `/entries/unlink`
- `/entries/object-links/link`
- `/entries/object-links/unlink`
- `/entries/relationships/link`
- `/entries/relationships/unlink`

## Current Behavior Notes

### Complete

`/entries/[entryId]/complete` first applies EntryOps visibility and then uses `canEditEntryOpsEntry`. This means creators, direct assignees, active assignment participants, scoped staff writers, and Org Admin can complete task/follow-up Entries they are allowed to see.

### Update / Edit

`/entries/[entryId]/update` follows the same pattern as complete. Self-edit users can update basic Entry fields, but direct event program/team/calendar scope changes are blocked unless the actor has staff write permission.

The Entry detail page shows the edit form when `canEditEntryOpsEntry` allows it. Administrative controls are still hidden unless `canWriteEntries` grants role-based write access.

### Archive / Delete

The visible control is labeled `Soft delete`, and the route sets `deletedAt` plus `status: ARCHIVED`. It is protected by `requirePermission("entry.delete")`, not self-edit. This means owners and assignees cannot currently archive their own Entries unless they also have a role granting `entry.delete`.

### Restore

No generic Entry restore route was found in the audited EntryOps route tree. Journal-specific restore/reopen routes exist separately and follow journal workflow rules.

### Conversion

Task-to-Habit and Note-to-Task conversions are intentionally staff-gated through `requirePermission("entry.update")`, and Note-to-Task also requires `task.create`. The detail UI hides these controls for self-edit-only actors.

### Follow-Up Creation

Follow-up creation requires both `entry.update` and `task.create`. It also allows the submitted `assigneePersonId` when that person exists in the organization. Because the route is staff-gated, this is currently treated as an elevated workflow rather than an owner self-service action.

### Relationship And Object Links

Legacy Entry link/unlink routes and object-link routes require `entry.update` plus EntryOps visibility. Foundation relationship routes require `entry.update` and visibility for Entry nodes. The panel-level helper `canWriteRelationshipSource` also uses staff write for non-journal Entry sources.

## Desired Behavior Direction

Recommended target model:

- Creator/owner can edit ordinary title/content/status/priority/date/list fields for their own Entry.
- Direct assignee and active assignment participant can complete or update ordinary work-state fields where applicable.
- Guardian dependent visibility remains read-oriented unless a separate guardian-action policy is explicitly approved.
- Org Admin can manage all visible Entries organization-wide.
- Scoped elevated roles can manage Entries only where current scope resolution supports the Entry.
- Conversion, reassignment, ownership changes, cross-person assignment, and scope changes remain administrative/elevated actions.
- Archive/restore should be decided explicitly: owner self-archive may be reasonable, but restore/delete should probably remain elevated until a clear lifecycle policy is approved.

## Inconsistencies And Gaps

- `Complete` is self-edit enabled, but `Archive / Soft delete` is staff-delete only. This may be correct, but the product distinction is not yet documented as policy.
- The UI label says `Soft delete`, while the route records `ENTRY_ARCHIVED` and sets `status: ARCHIVED`. The user-facing language should probably become `Archive` if this remains a reversible lifecycle action.
- No generic Entry restore route exists, so archived Entries can appear in Review/All Work but do not have a normalized generic restore path.
- Relationship linking uses staff write even when the actor can self-edit the Entry. This keeps linkage conservative, but it means owners cannot organize their own related items.
- Follow-up creation is staff-gated and may allow broad assignee selection once the staff gate passes. That should remain elevated until assignee-scope policy is formalized.
- Older access-level contract tests still describe guardian and athlete access through `resolveEntryAccess`; newer EntryOps visibility/self-edit helpers intentionally supersede that for Entry detail and owner workflows. Future tests should distinguish legacy staff access from EntryOps visibility/action policy.

## Recommended Implementation Roadmap

### 24D.8X-O — Rename Archive UI And Document Restore Gap

Goal: normalize user-facing lifecycle language from `Soft delete` to `Archive` where the route archives rather than permanently deletes.

Allowed files/modules:

- Entry detail presentation
- Entry delete/archive route copy or activity metadata only if needed
- Targeted UI text tests
- Planning documentation

Non-goals:

- No schema changes
- No new restore route
- No permission expansion
- No broad lifecycle redesign

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted presentation tests if changed

Acceptance criteria:

- Users see archive language for archive behavior.
- PR documents that generic restore remains deferred.

### 24D.8X-P — Decide Owner Archive And Restore Policy

Goal: decide whether creators/owners, direct assignees, or active assignment participants may archive and/or restore their own Entries.

Allowed files/modules:

- EntryOps lifecycle authorization helper
- Entry archive/delete route
- Potential generic restore route only if explicitly approved
- Targeted lifecycle tests
- Planning documentation

Non-goals:

- No hard delete
- No reassignment or ownership changes
- No conversion behavior changes
- No schema changes unless explicitly approved

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted lifecycle permission tests

Acceptance criteria:

- Matrix-backed policy is implemented for archive/restore.
- Unrelated users remain blocked.
- Guardian dependent read access does not become mutation access without explicit approval.

### 24D.8X-Q — Evaluate Owner Relationship And Follow-Up Self-Service

Goal: decide whether self-edit actors should be allowed to create relationships, object links, or follow-ups for their own Entries without staff `entry.update`.

Allowed files/modules:

- Relationship source write helper
- Entry relationship/object-link routes
- Follow-up route
- Targeted relationship/follow-up tests
- Planning documentation

Non-goals:

- No broad relationship redesign
- No generated runtime/task records
- No cross-person assignment expansion without explicit policy
- No schema changes

Validation:

- `npm run typecheck`
- `npm run build`
- Targeted relationship/follow-up tests

Acceptance criteria:

- Owner self-service relationship/follow-up policy is explicit.
- Direct-route checks match UI controls.
- Cross-person assignment remains protected.

## Validation

- `npm run typecheck`
- `npm run build`

No targeted tests were run because this slice is documentation-only and made no code changes.
