# GearOps Test Scenarios (Pilot Requirements)

## Purpose
Defines initial test scenarios for GearOps pilot workflows and use cases.

## Scenario Matrix

| ID | Scenario | Roles | Preconditions | Expected Result |
|---|---|---|---|---|
| GS-01 | Rapid checkout succeeds for ready item | Equipment Manager | Item exists, READY, no open custody | Open custody created with actor/recipient metadata |
| GS-02 | Rapid checkout blocked for maintenance item | Equipment Manager | Item state is maintenance/not ready | Checkout denied with explicit reason |
| GS-03 | Check-in closes active custody | Equipment Manager | Open checkout exists | Custody closes, condition captured, status updated |
| GS-04 | Check-in mismatch handled | Equipment Manager | No open custody exists | Exception logged and operator guided to resolution |
| GS-05 | Custody transfer succeeds | Equipment Manager, Head Coach | Source custody open and transferable | Source closes, new custody opens, trace chain maintained |
| GS-06 | Custody transfer blocked on unresolved conflict | Equipment Manager | Source custody overdue/unresolved | Transfer denied until conflict resolution path completed |
| GS-07 | Inventory lookup returns correct status/location | Equipment Manager, Team Admin | Item identifiers are valid and unique | Lookup shows lifecycle, readiness, custody, location |
| GS-08 | Readiness verification detects deployment gap | Event Operator, Head Coach | Event list includes not-ready required item | Gap flagged and replacement action required |
| GS-09 | Maintenance intake records deficiency | Equipment Manager | Item selected with reportable issue | Maintenance intake created with required metadata |
| GS-10 | Vault/equipment cage return confirms secure location | Equipment Manager, Event Operator | Item returned from active use | Location and custody updated to secured state |
| GS-11 | Event gear checkout captures shortage exception | Event Operator | Event requirements exceed available ready items | Checkout partial/blocked with requirement gap record |
| GS-12 | Guardian approval required path succeeds | Parent/Guardian, Equipment Manager, Athlete | Item category requires approval, eligible recipient | Approval captured and checkout proceeds |
| GS-13 | Guardian approval denied path blocks issuance | Parent/Guardian, Equipment Manager, Athlete | Approval required and denied | Issuance blocked with denial reason retained |

## Exception Validation Coverage

| Area | Minimum Validation Requirement |
|---|---|
| Eligibility checks | Ensure readiness/lifecycle/custody constraints block invalid checkout |
| Approval gates | Ensure guardian-required paths cannot bypass missing or denied approvals |
| Transfer integrity | Ensure prior custody cannot remain open after successful transfer |
| Event readiness | Ensure requirement gaps are visible and auditable |
| Return handling | Ensure vault/cage returns update both location and custody state |
| Failure resilience | Ensure failed commits do not produce false-positive success states |

## Assumptions
- Scenario IDs will be reused by manual QA and future automated test planning.
- Pilot validation emphasizes operational correctness over UX polish.
- Event and approval scenarios are mandatory for pilot readiness.

## Open Questions
- Which scenarios must be automated first versus validated manually?
- What data fixtures are required to reliably reproduce guardian and event edge cases?
- Should offline pending-state scenarios be added now or deferred to roadmap milestone entry?

## Roadmap Dependencies
- Mobile web milestone should include execution of core GS-01 through GS-13 scenarios.
- Mobile app milestone should add device-input and scanning reliability variants.
- Offline capture/sync milestone should extend scenarios for queued actions, conflict, and reconciliation.
