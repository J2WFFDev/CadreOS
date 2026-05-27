# Arc 22C — Entry Detail and Linking Validation Checklist

## Entry Detail

- [ ] Open Entry detail from entries list.
- [ ] Verify title/content/type/status/priority render clearly.
- [ ] Verify creator/assignee/updated-by/timestamp metadata render.
- [ ] Verify mobile detail layout remains usable.

## Entry Editing

- [ ] Edit Entry title/content/type/status/priority where supported.
- [ ] Verify save updates Entry detail and does not break existing Entry behavior.

## Linking and Unlinking

- [ ] Link Entry to person/member/athlete context where supported.
- [ ] Link Entry to team/program/season context where supported.
- [ ] Link Entry to event/session context where supported.
- [ ] Link Entry to gear/resource/reservation context where supported.
- [ ] Link Entry to follow-up task or related Entry where supported.
- [ ] Remove an Entry object link.
- [ ] Remove an Entry-to-Entry link.

## Linked Object / Relationship Display

- [ ] Verify linked object panel shows resolved names and safe navigation paths where available.
- [ ] Verify unresolved/deleted links show safe unavailable placeholders.
- [ ] Verify inaccessible links show safe restricted placeholders.
- [ ] Verify related operational graph panel remains functional.

## Authorization and Visibility

- [ ] Verify admin/staff linked-object visibility remains role-appropriate.
- [ ] Verify coach visibility remains role-appropriate.
- [ ] Verify guardian cannot view unrelated athlete-linked Entry data.
- [ ] Verify unauthorized users cannot infer protected linked record details from names or IDs.

## Integration Safety

- [ ] Verify quick capture and Entry Inbox behavior still works.
- [ ] Verify notes/tasks wrappers and conversion flows still work.
- [ ] Verify MemberOps, GearOps, ResourceOps, dashboard, and roster workflows remain stable.
