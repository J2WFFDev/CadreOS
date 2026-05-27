# Arc 22D — Entry Workflow Orchestration Validation Checklist

## Entry-to-Follow-Up Flow

- [ ] Create an Entry from a standard capture path.
- [ ] Create a follow-up task from Entry detail.
- [ ] Convert Entry to task where supported.
- [ ] Verify follow-up creation preserves source Entry context.

## Follow-Up Operational Fields

- [ ] Assign follow-up to a valid person in org scope.
- [ ] Set follow-up due date where supported.
- [ ] Set follow-up priority where supported.
- [ ] Mark follow-up complete where supported.

## Visibility Across Operational Surfaces

- [ ] Verify follow-up appears on source Entry detail.
- [ ] Verify follow-up appears in Assigned-to-me where applicable.
- [ ] Verify due follow-up appears in Today/Upcoming where applicable.
- [ ] Verify source Entry remains available after follow-up completion.

## Authorization and Boundary Safety

- [ ] Verify users can create follow-ups only in allowed scope.
- [ ] Verify assigned user can access assigned follow-up.
- [ ] Verify guardian cannot access unrelated staff follow-up/source-entry data.
- [ ] Verify coach/staff/admin boundaries remain intact.
- [ ] Verify source Entry links in task views do not leak hidden data.

## Integration Safety

- [ ] Verify Entry creation, Inbox, Entry detail, and linking remain stable.
- [ ] Verify notes/tasks existing create/edit/complete flows remain stable.
- [ ] Verify MemberOps, GearOps, ResourceOps, dashboard, and roster workflows remain stable.
