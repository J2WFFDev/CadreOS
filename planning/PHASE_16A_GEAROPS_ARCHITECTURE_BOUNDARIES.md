# Phase 16A — GearOps Architecture and Scope Boundaries

## Goal

Establish the Arc 16A planning foundation for GearOps MVP before any schema or runtime implementation.

This phase is architecture/scope definition only: no Prisma schema updates, no runtime feature delivery, and no expansion into deferred operational domains.

## Scope Guardrails (enforced)

- Do not change runtime code.
- Do not change Prisma schema.
- Do not add GearOps features in this phase.
- Preserve Core ownership of people, teams, roster, and authorization foundations.
- Preserve FieldOps ownership of facilities/resources/bookings.
- Keep communications/notifications and automation behavior deferred.

## GearOps MVP Purpose

GearOps MVP is the portable asset accountability layer for CadreOS operations.

It must provide:

1. Equipment inventory visibility.
2. Consumable inventory visibility.
3. Assignment workflows to person, team, or event context.
4. Check-out/check-in custody tracking.
5. Condition and maintenance logging for durable items.
6. Basic dashboard visibility of current accountability state.

## GearOps Boundaries

### In scope for GearOps MVP

- Portable equipment and consumable inventory records.
- Assignment and custody records tied to existing Core entities.
- Item condition state and maintenance history for durable equipment.
- Consumable stock movement tracking.
- Read-oriented operational visibility for staff.

### GearOps references (not ownership)

GearOps may reference existing Core entities:

- `Person`
- `Team`
- `Program`
- `Event`

### Explicit non-ownership

- GearOps does **not** create or manage People.
- GearOps does **not** manage rosters.
- GearOps does **not** manage facilities, resources, or bookings (FieldOps scope).

### Explicit non-goals for MVP

- Purchasing workflows.
- Finance/accounting workflows.
- Depreciation tracking.
- Automated replenishment behavior.
- Messaging/notifications behavior.

## Minimal GearOps MVP Entity Model (proposal)

### 1) GearCategory

Purpose: classify inventory into durable-equipment and consumable groupings for filtering/reporting/policy defaults.

### 2) GearItem

Purpose: canonical tracked inventory record for a specific durable item or consumable stock line.

### 3) GearAssignment

Purpose: assignment record linking a gear item to a person, team, or event context with accountable attribution.

### 4) GearCheckout

Purpose: custody-chain record for temporary possession transfer and return lifecycle.

### 5) GearMaintenanceLog

Purpose: condition, inspection, repair, and retirement history for durable equipment accountability.

### 6) ConsumableTransaction

Purpose: stock movement event log (receive/use/distribute/dispose/adjust) for consumable inventory continuity.

## Durable vs Consumable Behavior

### Durable gear behavior

- Unit-level lifecycle emphasis (assignment/custody/return/maintenance/retirement).
- Condition status is first-class and evolves over time.
- Maintenance logs are expected and auditable.
- Overdue/lost/damaged accountability is tracked per custody/assignment state.

### Consumable behavior

- Quantity movement emphasis (on-hand counts and transactions).
- No long-lived custody chain requirement per unit.
- Maintenance logging is generally not applicable.
- Stock events must remain actor-attributed and optionally event-linked.

## Lifecycle and Status States (MVP baseline)

### Gear item lifecycle state (proposed)

- `ACTIVE` — available for assignment/check-out/use.
- `ASSIGNED` — currently allocated by assignment record.
- `CHECKED_OUT` — currently in temporary custody.
- `MAINTENANCE` — unavailable due to inspection/repair.
- `RETIRED` — no longer operationally available.
- `LOST` — unavailable with unresolved recovery/disposition.

### Assignment lifecycle state (proposed)

- `PENDING` — initiated but not yet confirmed.
- `ACTIVE` — assignment in force.
- `RETURNED` — assignment completed with return.
- `TRANSFERRED` — moved to a new assignment/custody context.
- `CANCELLED` — closed without fulfillment.
- `OVERDUE` — expected return window exceeded.

## Authorization Expectations (existing pattern alignment)

GearOps authorization must reuse CadreOS scoping and role expectations already established for organization/program/team operations:

- Organization-scoped access boundaries remain authoritative.
- Program/team context controls read/write scope where references exist.
- Staff-role expectations gate assignment/custody/maintenance actions.
- Actor attribution must resolve to valid linked `Person` identity for accountable writes.
- Non-staff and out-of-scope users must not gain write access through GearOps references.

GearOps must integrate with existing authorization helpers/patterns rather than introducing a parallel authorization model.

## Rollback / Defer Boundaries Before Schema Implementation

The following boundaries are required before Arc 16B schema work begins:

1. Confirm GearOps remains additive and reference-based (no ownership takeover of Core/FieldOps domains).
2. Confirm no runtime writes are introduced in Arc 16A.
3. Defer advanced capabilities:
   - purchasing/finance/depreciation,
   - automated replenishment,
   - notification/messaging/escalation automation,
   - barcode/mobile-native/offline inventory behavior.
4. Keep dashboard scope basic/read-oriented for MVP.
5. Lock MVP entity list and lifecycle semantics before drafting Prisma enums/models in Arc 16B.
6. Require explicit rollback safety: if Arc 16B+ implementation stalls, current Core + FieldOps runtime remains unaffected.

## Validation and Compliance Confirmation

- This phase is documentation-only.
- Runtime code was not changed.
- Prisma schema was not changed.
- GearOps implementation work is intentionally deferred to later Arc 16 phases.

## Source References

- `planning/ROADMAP_POST_15A_GEAROPS_NEXT.md`
- `planning/MODULE_ROADMAP_FIELDOPS_GEAROPS.md`
- `planning/ROADMAP_CORE_FIELDOPS_GEAROPS.md`
- `planning/DOMAIN_MODEL.md`
- `prisma/schema.prisma`

## Phase 16A output summary

Phase 16A defines GearOps MVP purpose, confirms explicit Core/FieldOps boundary separation, proposes a minimal MVP entity set, establishes durable-vs-consumable behavior and lifecycle state expectations, aligns authorization with current organization/program/team/staff patterns, and sets strict defer/rollback boundaries before any schema or runtime implementation in subsequent Arc 16 phases.
