# Arc 20H — GearOps Operational Dashboards and Reporting

## Purpose

Arc 20H adds a practical, organization-scoped, permission-aware operational reporting surface for GearOps so operators can quickly identify readiness, custody, location, maintenance, event deployment, consumable, and overdue-risk gaps.

## Delivered in Arc 20H

- New GearOps reporting workspace at `/gear-ops/reports`
- Quick report filters:
  - category
  - location
  - event
  - lifecycle status
  - ownership type (owner)
  - assignee
  - readiness
- Summary metric cards for:
  - visible gear
  - readiness-ready count
  - out-of-service count
  - maintenance-needed count
  - overdue/unreturned count
  - low-consumable count
  - event gap count
  - event unreturned count
- Exception-oriented views for:
  - out-of-service gear
  - maintenance-needed gear
  - overdue/unreturned custody
  - low consumables
  - event required gear gaps
  - event unreturned gear
- Operational rollups for:
  - readiness
  - custody
  - location
  - event gap summary
  - recent consumable activity
- Drill-down links to existing item/event detail workflows.

## Architecture Decisions

- Reporting is derived from existing GearOps entities (`GearItem`, `GearAssignment`, `GearCheckout`, `ConsumableTransaction`, `EventGearRequirement`) instead of introducing parallel reporting state.
- Authorization and visibility reuse existing `resolveGearOpsReadAccess` staff-scoped filters.
- Event requirement readiness/gap visibility reuses existing event gear derivation logic (`summarizeEventGearRequirement`, `deriveEventGearAssignmentStatus`).
- Reusable operational summary/exception/filter logic is centralized in `lib/gear-ops-dashboard.ts` and covered by unit tests.

## Summary Metric Logic

- **Readiness**: counts readiness states and computes ready percentage.
- **Custody**: counts active assignments/open checkouts and detects overdue states by status or expected-return timestamp.
- **Maintenance/Out-of-Service**:
  - out-of-service = lifecycle (`MAINTENANCE`, `QUARANTINED`, `RETIRED`, `LOST`) or readiness (`NOT_READY`, `DECOMMISSIONED`)
  - maintenance-needed = readiness `MAINTENANCE_REQUIRED` or condition (`POOR`, `DAMAGED`) when not already out-of-service
- **Consumables**:
  - low consumable = `CONSUMABLE` with `quantityOnHand <= quantityMin`
  - adjustment count = `ADJUSTED` transactions in last 30 days
- **Event summary**:
  - requirement gap = `max(quantityNeeded - assignedCount, 0)`
  - readiness percent = `readyCount / quantityNeeded`
  - unreturned operational signal = staged/deployed not yet recovered

## Exception Logic

Exceptions are generated from current scoped data:

- `OUT_OF_SERVICE`
- `MAINTENANCE_NEEDED`
- `OVERDUE_UNRETURNED`
- `LOW_CONSUMABLE`
- `EVENT_GEAR_GAP`
- `EVENT_GEAR_UNRETURNED`

Each exception includes severity and a direct drill-down link to item or event detail.

## Permission and Scope Behavior

- Organization scope enforced by current organization context.
- Permission behavior enforced through existing staff access and visibility resolution.
- Report query filters are layered on top of existing scoped visibility.

## Deferred Scope

Arc 20H intentionally does **not** add:

- enterprise BI or advanced analytics
- predictive scoring/recommendations
- scheduled report distribution
- custom charting dependencies
- data warehouse style historical cubes
- realtime streaming infrastructure

## Next Step (Arc 20I Recommendation)

Recommended Arc 20I focus:

1. export-friendly CSV endpoints for current report slices
2. richer event requirement coverage for zero-assignment visibility in scoped contexts
3. saved filter presets per operator role
4. paginated exception queues with bulk workflow shortcuts
5. mobile/offline-compatible report snapshots aligned to rapid scan workflows
