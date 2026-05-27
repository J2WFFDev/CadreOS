# Arc 22E — Entry Activity and Feed Validation Checklist

## Activity Event Creation

- [ ] Create Entry and verify `ENTRY_CREATED` activity.
- [ ] Edit Entry and verify `ENTRY_UPDATED` or `ENTRY_STATUS_CHANGED` activity as appropriate.
- [ ] Link Entry to another Entry and verify `ENTRY_LINKED` activity.
- [ ] Unlink Entry and verify `ENTRY_UNLINKED` activity.
- [ ] Link Entry to operational object and verify object-link activity.
- [ ] Remove object link and verify object-unlink activity.
- [ ] Create follow-up from Entry and verify `FOLLOW_UP_CREATED`.
- [ ] Assign/reassign follow-up and verify `FOLLOW_UP_ASSIGNED`.
- [ ] Complete follow-up and verify `FOLLOW_UP_COMPLETED`.
- [ ] Complete Entry and verify `ENTRY_COMPLETED`.
- [ ] Archive Entry and verify `ENTRY_ARCHIVED`.

## Feed and Timeline Behavior

- [ ] Verify recent activity appears in `/feed` with human-readable labels.
- [ ] Verify activity appears in Entry detail history.
- [ ] Verify Today/Upcoming views remain functional after activity updates.
- [ ] Verify assignment/status/completion changes remain visible in operational surfaces where expected.

## Authorization and Data-Safety Checks

- [ ] Verify admin/staff can view allowed activity surfaces.
- [ ] Verify coach visibility remains within existing allowed scope.
- [ ] Verify guardian/non-staff cannot access restricted Entry feed surfaces.
- [ ] Verify inaccessible linked records do not leak protected names in activity/feed text.
- [ ] Verify activity metadata rendering does not expose raw protected IDs.

## Regression Safety

- [ ] Verify Entry creation, Inbox, detail, linking, and follow-up workflows still function.
- [ ] Verify notes/tasks sync behaviors still function.
- [ ] Verify MemberOps, GearOps, ResourceOps, dashboard, and roster workflows remain stable.

