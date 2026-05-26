# GearOps Use Cases (Pilot)

## Purpose
This is the initial operational use-case baseline for GearOps as the first CadreOS documentation pilot.

## In-Scope Use Cases

| Use Case | Primary Roles | Trigger | Expected Outcome |
|---|---|---|---|
| Rapid checkout | Equipment Manager, Event Operator, Assistant Coach | Item scan or lookup before practice/event | Custody record opens quickly with actor, recipient, due context |
| Check-in | Equipment Manager, Assistant Coach | Item return to staff | Open custody closes and condition/readiness state updates |
| Custody transfer | Equipment Manager, Head Coach, Assistant Coach | Item moves from one custodian to another | Prior custody closes and new custody opens with full traceability |
| Inventory lookup | Equipment Manager, Team Admin | Item code search or filtered list | Operator confirms item status, location, and custody state |
| Readiness verification | Equipment Manager, Head Coach, Event Operator | Pre-event or pre-practice readiness check | Only deployable items proceed to checkout/event staging |
| Maintenance intake | Equipment Manager | Damage/failure discovered or scheduled check due | Item enters maintenance path with intake reason and status |
| Vault/equipment cage return | Equipment Manager, Event Operator | Post-use secured storage return | Item location and custody state confirm secured return |
| Event gear checkout | Event Operator, Head Coach, Assistant Coach | Event staging starts | Required items assigned/checked out for event execution |
| Guardian approval | Parent/Guardian, Equipment Manager, Athlete | Minor athlete requests gated gear category | Approval decision captured before custody can be finalized |

## Exceptions and Failure Conditions

| Use Case | Exception | Required Handling |
|---|---|---|
| Rapid checkout | Item not found from scan | Fallback to manual lookup; block custody open until resolved |
| Rapid checkout | Item not eligible (maintenance/not-ready/lost) | Prevent checkout and surface operational reason |
| Check-in | No open custody record | Log mismatch event and require manual resolution path |
| Custody transfer | Source custody unresolved/overdue | Force explicit close or exception approval before transfer |
| Inventory lookup | Duplicate identifiers or ambiguous match | Require disambiguation before transaction actions |
| Readiness verification | Required item marked not ready | Escalate replacement workflow and record readiness gap |
| Maintenance intake | Missing required condition metadata | Hold intake submission until mandatory fields provided |
| Vault/equipment cage return | Location unavailable or restricted | Route to fallback secure location with exception log |
| Event gear checkout | Requirement shortfall | Record event gap and provide unresolved requirement list |
| Guardian approval | Approval unavailable/denied | Block issuance and capture reason/status for audit |

## Use-Case Dependencies
- Consistent lifecycle/readiness definitions must be shared with module map and workflow documents.
- Role authorization boundaries must support approval-gated and exception-gated actions.
- Event workflows depend on custody and readiness operations being current and auditable.

## Assumptions
- Operators require low-friction scan-first behavior with clear fallback actions.
- Custody and readiness are authoritative controls for whether an item can be deployed.
- Guardian approval applies only to explicitly gated categories and eligible recipients.

## Open Questions
- What maximum transaction time is acceptable for rapid checkout during high-volume periods?
- Which exceptions require immediate supervisor acknowledgment versus deferred review?
- Should event checkout reserve items ahead of final physical checkout confirmation?

## Roadmap Dependencies
- Mobile web must support rapid checkout/check-in and exception capture parity.
- Mobile app roadmap should include scan reliability targets and guided exception handling.
- Offline capture and sync roadmap must define how pending custody actions reconcile safely.
