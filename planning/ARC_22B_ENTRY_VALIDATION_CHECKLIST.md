# Arc 22B — Entry Quick Capture and Inbox Validation Checklist

## Entry Creation

- [ ] Create a minimal Entry from quick capture with only required text input.
- [ ] Create a note-style Entry from quick capture.
- [ ] Create a task-style Entry from quick capture (where supported).
- [ ] Create an Entry from dashboard/feed quick-capture surfaces.

## Context Handling

- [ ] Create an Entry with no team/person/event context and verify save succeeds.
- [ ] Create an Entry with team/person/event/gear/resource context where supported.
- [ ] Verify low-context capture routes to Entry Inbox/default queue.

## Feed and Inbox Visibility

- [ ] Verify created low-context Entry appears in `/entries/inbox`.
- [ ] Verify created Entry appears in expected feed lane(s) and detail view.
- [ ] Verify Inbox metadata shows status, type, and priority when available.

## Validation and UX

- [ ] Verify required-field behavior is clear in quick capture.
- [ ] Verify validation/save errors are understandable and visible.
- [ ] Verify failed save preserves typed quick-capture values where practical.
- [ ] Verify successful save produces exactly one entry.
- [ ] Verify mobile quick-capture layout remains usable.

## Authorization and Scope

- [ ] Verify unauthorized users cannot create entries outside allowed scope.
- [ ] Verify role-aware visibility remains intact for entry/feed/inbox surfaces.

## Integration Safety

- [ ] Verify `/notes/new` create behavior remains unchanged and functional.
- [ ] Verify `/tasks/new` create behavior remains unchanged and functional.
- [ ] Verify dashboard, MemberOps, GearOps, ResourceOps, and roster workflows remain stable.
