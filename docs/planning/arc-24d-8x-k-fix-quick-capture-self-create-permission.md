# Arc 24D.8X-K — Fix Quick Capture Self-Create Permission

## Summary

This slice fixes Quick Capture so a signed-in person can create a task assigned to themself even when their active role does not have broad staff `task.create` permission.

The change is intentionally scoped to Quick Capture self-create behavior. It does not broaden global EntryOps mutation permissions and does not roll back Entry detail or action-route visibility enforcement from 24D.8X-I/J.

## Root Cause

Quick Capture previously required `task.create` before resolving the final assignee. That permission is staff-only, so Athlete, Guardian, and limited/no-role actors were blocked even when the item would be created by the current person and assigned to the current person.

## Fix

Quick Capture now resolves the assignee before the permission decision.

The route uses a small policy helper:

- `canQuickCaptureCreateForAssignee`

Behavior:

- existing `task.create` permission still allows elevated creation and assignment
- without `task.create`, the actor may only create when:
  - the assignee is the actor/current person
  - no context target is attached
- an invalid assignee is rejected before save

## Role Behavior

- Athlete self-create: allowed
- Limited/no-role self-create: allowed when a linked person exists
- Guardian self-create: allowed
- Guardian dependent assignment: unchanged and still requires future explicit support
- Org Admin/staff assignment to another person: preserved when existing permission checks allow it
- Unrelated assignee for limited roles: blocked

## Inbox/List Behavior

Self-created Quick Capture tasks continue to resolve the default personal Inbox through the existing default list helper. Team-context Quick Capture remains tied to the existing elevated permission path.

## Validation

- `npm run typecheck`
- `npm run build`
- Targeted Quick Capture tests:
  - `npx tsx --test tests/entries/quick-capture.test.ts`

## Remaining Gaps

- Dependent-athlete Quick Capture assignment for guardians remains deferred until the product explicitly defines that workflow.
- Context-linked self-capture for non-staff roles remains blocked because context target access rules are broader than the personal self-create case.
- Broader Entry create/edit permissions remain unchanged.
