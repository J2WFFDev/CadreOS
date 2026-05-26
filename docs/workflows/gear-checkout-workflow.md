# GearOps Workflow: Gear Checkout

## Purpose
Defines the baseline GearOps checkout workflow for development and test alignment.

## Workflow Scope
- Covers standard checkout, exception paths, and completion criteria.
- Applies to rapid checkout and event gear checkout variants.

## Primary Roles
- Equipment Manager
- Event Operator
- Head Coach
- Assistant Coach
- Parent/Guardian (approval path only)

## Standard Flow

| Step | Action | Result |
|---|---|---|
| 1 | Operator identifies item (scan or lookup) | Candidate item resolved for transaction |
| 2 | System validates current state (custody, readiness, lifecycle) | Eligibility decision returned |
| 3 | Operator selects recipient (person/team/event context) | Recipient context attached |
| 4 | System checks policy gates (including guardian approval when required) | Approval status resolved |
| 5 | Operator confirms checkout details (due, notes, custody context) | Final transaction payload prepared |
| 6 | Checkout committed | Open custody record created with audit metadata |
| 7 | Confirmation shown | Operator receives success with traceable transaction id |

## Exception Flow Branches

| Branch | Trigger | Required Outcome |
|---|---|---|
| Item unresolved | Scan/search cannot uniquely resolve item | Operator routed to inventory lookup resolution path |
| Ineligible state | Item is not ready, in maintenance, retired/lost, or already out | Checkout blocked with explicit reason code |
| Approval required | Guardian approval missing/pending/denied | Checkout paused or blocked based on approval status |
| Recipient unresolved | Athlete/team/event context missing | Checkout blocked until valid recipient context is selected |
| Policy conflict | Role lacks permission for requested action | Transaction denied with role-policy rationale |
| Commit failure | Service/database/network issue | Transaction remains uncommitted; operator receives retry/recovery guidance |

## Completion Criteria
- Custody state is changed only after successful commit.
- Each completed checkout includes actor, recipient, timestamp, and context metadata.
- Blocked attempts produce explicit operational reason output.

## Assumptions
- Scan-first behavior is preferred but lookup-first remains available.
- A single authoritative custody state exists per item at any point in time.
- Guardian approval policies are deterministic at transaction time.

## Open Questions
- Should checkout confirmation include mandatory recipient acknowledgment in all contexts?
- What is the fallback if guardian approval cannot be obtained before event start?
- What retry policy should apply to transient commit failures during high-volume operations?

## Roadmap Dependencies
- Mobile web workflows must preserve full exception handling parity.
- Mobile app roadmap must support checkout confirmation UX and policy-gate messaging.
- Offline capture/sync roadmap must define pending checkout state and server reconciliation behavior.
