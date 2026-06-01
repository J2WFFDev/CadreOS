# Arc 25F — GearOps Role Experience, Approvals, and Operational Validation

## Scope and guardrails

- No major feature expansion.
- No module renaming.
- No UI redesign.
- Focus on permissions, workflows, visibility, and role usability.

## GearOps role matrix

| Capability | Athlete | Guardian | Coach | GearOps Admin | Program Admin | Organization Admin |
|---|---|---|---|---|---|---|
| Can View | Limited (own-context surfaces only) | Limited (guardian-linked context only) | Scoped | Scoped (operational) | Scoped (program) | Global |
| Can Request | No (current RC1) | No (current RC1) | Yes | Yes | Yes | Yes |
| Can Reserve | No (current RC1) | No (current RC1) | Yes | Yes | Yes | Yes |
| Can Approve | No | Guardian responsibility approvals where presented | Coach/admin review where applicable | Yes | Yes | Yes |
| Can Checkout | No | No | Yes | Yes | Yes | Yes |
| Can Check In | No | No | Yes | Yes | Yes | Yes |
| Can Inspect | No | No | Yes | Yes | Yes | Yes |
| Can Manage Inventory | No | No | Scoped | Scoped | Scoped | Global |
| Can Manage Kits | No | No | Scoped | Scoped | Scoped | Global |
| Can Create Maintenance Tasks | No | No | Yes | Yes | Yes | Yes |
| Can Return To Service | No | No | Yes | Yes | Yes | Yes |

## GearOps workflow matrix

| Workflow | Athlete | Guardian | Coach | GearOps Admin | Program Admin | Organization Admin |
|---|---|---|---|---|---|---|
| Reservation request | View-only context | View-only context | Create/manage in-scope | Create/manage in-scope | Create/manage in-scope | Create/manage global |
| Reservation approval | Not supported as actor | Guardian responsibility approval records when required | Coach/admin manual approval | Approve | Approve | Approve/override |
| Allocation | Not supported as actor | Not supported as actor | In-scope | In-scope | In-scope | Global |
| Checkout / return | Not supported as actor | Not supported as actor | In-scope | In-scope | In-scope | Global |
| Inspection / close | Not supported as actor | Not supported as actor | In-scope | In-scope | In-scope | Global |
| Maintenance issue/task lifecycle | Not supported as actor | Not supported as actor | In-scope | In-scope | In-scope | Global |
| Static kit operations | Not supported as actor | Not supported as actor | In-scope | In-scope | In-scope | Global |
| Dynamic kit operations | Not supported as actor | Not supported as actor | In-scope | In-scope | In-scope | Global |
| Dashboard / reports | Role-filtered | Role-filtered | Scoped operations | Scoped operations | Scoped operations | Global operations |

## Operational validation findings and corrections

### Permission and visibility corrections completed in this arc

1. Reservation list visibility now enforces scoped inventory visibility for:
   - direct item reservations,
   - static kit reservations (through visible kit members),
   - dynamic kit reservations (through visible allocation items).
2. Reservation status update now enforces scoped visibility before allowing mutation.
3. Reservation visibility filtering is centralized via a reusable access helper.

### Approval workflow validation status

- Guardian approval: supported where guardian responsibility rows are created for required categories.
- Coach approval: supported for pending review transitions through manual approval records.
- GearOps/admin approval: supported through coach/admin approval pathways and role-gated mutation routes.
- Administrative override: supported for higher-privilege staff roles through role-based mutation access.

### Maintenance workflow validation status

- Inspection issue capture: supported.
- Task/log creation: supported through maintenance and inspection workflows.
- Task completion: supported via maintenance log lifecycle.
- Return to service: supported via dedicated return-to-service route/workflow.

### Kit workflow validation status

- Static kits: supported (reserve, checkout, return, inspect).
- Dynamic kits: supported (definition, allocation, reservation integration).
- Partial allocations: supported via dynamic allocation status.
- Missing/damaged returns: supported through kit return/inspection pathways.

### Dashboard/review validation status

- GearOps dashboard, reservation, inventory, and maintenance views are role/scoped-context sensitive.
- Arc 25F focuses on scope enforcement and role-appropriate data exposure, not visual redesign.

## Focused testing added

- Added focused test coverage for reservation visibility filter construction (`tests/gear-ops-access.test.ts`).

## GearOps RC1 readiness report

### RC1 readiness summary

- Reservation, custody, inventory, kits, and maintenance foundations are in place from prior arcs.
- Arc 25F closes operational scope gaps for reservation visibility and scoped reservation status mutation.
- Role matrix and workflow matrix are now explicitly documented for RC1 signoff.

### Residual risks / follow-up watch items

- Non-staff role expansion (athlete/guardian self-service request/reserve flows) remains intentionally constrained for RC1.
- Continue validating scoped behavior on additional GearOps surfaces as part of ongoing stabilization.

## Manual validation checklist (GEAR-ROLE-001 through GEAR-ROLE-050)

- [ ] GEAR-ROLE-001 — Athlete cannot open staff-only GearOps inventory detail views.
- [ ] GEAR-ROLE-002 — Guardian cannot open staff-only GearOps inventory detail views.
- [ ] GEAR-ROLE-003 — Coach can access in-scope GearOps dashboard.
- [ ] GEAR-ROLE-004 — GearOps admin can access in-scope GearOps dashboard.
- [ ] GEAR-ROLE-005 — Program admin can access in-scope GearOps dashboard.
- [ ] GEAR-ROLE-006 — Organization admin can access full GearOps dashboard.
- [ ] GEAR-ROLE-007 — Coach sees only in-scope inventory rows.
- [ ] GEAR-ROLE-008 — Program admin sees only in-scope program inventory.
- [ ] GEAR-ROLE-009 — Organization admin sees cross-program inventory.
- [ ] GEAR-ROLE-010 — Reservation list excludes out-of-scope items.
- [ ] GEAR-ROLE-011 — Reservation list includes in-scope static kit reservations.
- [ ] GEAR-ROLE-012 — Reservation list includes in-scope dynamic kit reservations.
- [ ] GEAR-ROLE-013 — Coach can create reservation for in-scope item.
- [ ] GEAR-ROLE-014 — Coach cannot create reservation for out-of-scope item.
- [ ] GEAR-ROLE-015 — GearOps admin can create reservation for in-scope item.
- [ ] GEAR-ROLE-016 — Program admin can create reservation for program-scoped item.
- [ ] GEAR-ROLE-017 — Organization admin can create reservation across org scope.
- [ ] GEAR-ROLE-018 — Reservation request persists request source role attribution.
- [ ] GEAR-ROLE-019 — Guardian-required category reservation creates guardian approval row.
- [ ] GEAR-ROLE-020 — Pending review reservation creates coach/admin approval row.
- [ ] GEAR-ROLE-021 — Coach can approve pending review reservation in scope.
- [ ] GEAR-ROLE-022 — Coach cannot approve pending review reservation out of scope.
- [ ] GEAR-ROLE-023 — Program admin can approve pending review reservation in scope.
- [ ] GEAR-ROLE-024 — Organization admin can approve pending review reservation globally.
- [ ] GEAR-ROLE-025 — Deny action creates denial approval record with actor attribution.
- [ ] GEAR-ROLE-026 — Approval action creates approval record with actor attribution.
- [ ] GEAR-ROLE-027 — Reservation approval updates workflow status correctly.
- [ ] GEAR-ROLE-028 — Reservation release updates release actor and release timestamp.
- [ ] GEAR-ROLE-029 — Reservation fulfillment writes fulfillment timestamp.
- [ ] GEAR-ROLE-030 — Reservation release writes inventory movement history entry.
- [ ] GEAR-ROLE-031 — Checkout from approved reservation updates checkout state.
- [ ] GEAR-ROLE-032 — Check-in/return updates reservation return workflow state.
- [ ] GEAR-ROLE-033 — Return with issue enters inspection-needed workflow state.
- [ ] GEAR-ROLE-034 — Inspection result can trigger maintenance follow-up.
- [ ] GEAR-ROLE-035 — Maintenance log creation captures performer and notes.
- [ ] GEAR-ROLE-036 — Maintenance completion updates item readiness/condition state.
- [ ] GEAR-ROLE-037 — Return-to-service route restores service-ready lifecycle state.
- [ ] GEAR-ROLE-038 — Static kit checkout records kit custody event.
- [ ] GEAR-ROLE-039 — Static kit check-in records kit custody return event.
- [ ] GEAR-ROLE-040 — Static kit return captures missing item issue.
- [ ] GEAR-ROLE-041 — Static kit return captures damaged item issue.
- [ ] GEAR-ROLE-042 — Dynamic kit allocation supports partial allocation status.
- [ ] GEAR-ROLE-043 — Dynamic kit allocation flags unable-to-allocate scenarios.
- [ ] GEAR-ROLE-044 — Dynamic kit return validation captures missing item issue.
- [ ] GEAR-ROLE-045 — Dynamic kit return validation captures damaged item issue.
- [ ] GEAR-ROLE-046 — Custody history is hidden for out-of-scope users.
- [ ] GEAR-ROLE-047 — Reservation details are hidden for out-of-scope users.
- [ ] GEAR-ROLE-048 — Maintenance records are hidden for out-of-scope users.
- [ ] GEAR-ROLE-049 — Dashboard reservation widgets respect role/scoped visibility.
- [ ] GEAR-ROLE-050 — RC1 role matrix and workflow matrix match implemented behavior.
