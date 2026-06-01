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

- [ ] GEAR-ROLE-001
- [ ] GEAR-ROLE-002
- [ ] GEAR-ROLE-003
- [ ] GEAR-ROLE-004
- [ ] GEAR-ROLE-005
- [ ] GEAR-ROLE-006
- [ ] GEAR-ROLE-007
- [ ] GEAR-ROLE-008
- [ ] GEAR-ROLE-009
- [ ] GEAR-ROLE-010
- [ ] GEAR-ROLE-011
- [ ] GEAR-ROLE-012
- [ ] GEAR-ROLE-013
- [ ] GEAR-ROLE-014
- [ ] GEAR-ROLE-015
- [ ] GEAR-ROLE-016
- [ ] GEAR-ROLE-017
- [ ] GEAR-ROLE-018
- [ ] GEAR-ROLE-019
- [ ] GEAR-ROLE-020
- [ ] GEAR-ROLE-021
- [ ] GEAR-ROLE-022
- [ ] GEAR-ROLE-023
- [ ] GEAR-ROLE-024
- [ ] GEAR-ROLE-025
- [ ] GEAR-ROLE-026
- [ ] GEAR-ROLE-027
- [ ] GEAR-ROLE-028
- [ ] GEAR-ROLE-029
- [ ] GEAR-ROLE-030
- [ ] GEAR-ROLE-031
- [ ] GEAR-ROLE-032
- [ ] GEAR-ROLE-033
- [ ] GEAR-ROLE-034
- [ ] GEAR-ROLE-035
- [ ] GEAR-ROLE-036
- [ ] GEAR-ROLE-037
- [ ] GEAR-ROLE-038
- [ ] GEAR-ROLE-039
- [ ] GEAR-ROLE-040
- [ ] GEAR-ROLE-041
- [ ] GEAR-ROLE-042
- [ ] GEAR-ROLE-043
- [ ] GEAR-ROLE-044
- [ ] GEAR-ROLE-045
- [ ] GEAR-ROLE-046
- [ ] GEAR-ROLE-047
- [ ] GEAR-ROLE-048
- [ ] GEAR-ROLE-049
- [ ] GEAR-ROLE-050
