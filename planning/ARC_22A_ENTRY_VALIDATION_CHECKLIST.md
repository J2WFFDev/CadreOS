# Arc 22A — Entry Current-State QA Checklist

Use this checklist to verify existing Entry behavior before Arc 22B+ implementation changes.

## Entry Create / Capture

- [ ] Open quick capture from header button and `⌘/Ctrl + K`.
- [ ] Create a quick task and confirm redirect to `/entries/[entryId]`.
- [ ] Create a quick note and confirm `sourceNoteId` linkage appears on entry detail.
- [ ] Create a quick follow-up/readiness item and confirm entry type and status defaults.
- [ ] Create a capture with due shortcut (Today/Tomorrow/Next Week) and confirm due date is set.
- [ ] Create capture with assignee selected and verify assignment appears in feed assigned lane.
- [ ] Create capture from a context page (team/event/person/gear item/booking) and verify object link + graph relation are added.

## Entry View / Edit

- [ ] Open `/entries` and verify list loads with type filter.
- [ ] Open entry detail and verify source links, linked entries, related operational items, and activity history render.
- [ ] Edit title/content/type/status/priority and verify values persist.
- [ ] For note-based entry, run “Convert note to task” and verify task linkage and activity write.
- [ ] For task entry, run “Complete task” and verify status/taskCompleted/completedAt behavior.
- [ ] Soft-delete an entry and verify it no longer appears in normal entry lists.

## Feed / Today / Upcoming / Assigned

- [ ] Open `/feed` and verify sections render: Assigned to me, Today & Overdue, Upcoming, Recent Activity.
- [ ] Verify assigned-to-me includes entries assigned via scalar assignee and assignment-table records.
- [ ] Open `/today` and verify due/overdue operational entries render with overdue styling.
- [ ] Open `/upcoming` and verify future due entries render within window.
- [ ] Complete an entry from feed/today and verify status updates + activity event.

## Linking / Operational Graph

- [ ] Link entry-to-entry via entry detail form and verify linked entries section updates.
- [ ] Add operational graph link from entry detail and verify related operational items list updates.
- [ ] Unlink operational graph relationship and verify related item disappears.

## Integration Safety Checks

- [ ] Create note through `/notes/new` and verify note still works independently plus entry-wrapper linkage remains non-blocking.
- [ ] Create task through `/tasks/new` and verify task still works independently plus entry-wrapper linkage remains non-blocking.
- [ ] Confirm decisions page `/decisions` still reads Entry type `DECISION` records.
- [ ] Confirm notifications page still shows entry-driven awareness items where applicable.
- [ ] Confirm no regressions in MemberOps, GearOps, FieldOps, and dashboard navigation paths.

## Authorization / Scope

- [ ] Verify entry create/update/delete/link routes enforce permission checks.
- [ ] Verify staff-scoped users can access expected Entry surfaces.
- [ ] Verify non-staff personas cannot access staff-only entry runtime surfaces.

## Deferred Scope Guardrail Checks

- [ ] Confirm no journal/habit runtime build behavior was introduced.
- [ ] Confirm no full communications delivery-channel behavior was introduced.
- [ ] Confirm no destructive schema rewrite or broad migration was introduced.
