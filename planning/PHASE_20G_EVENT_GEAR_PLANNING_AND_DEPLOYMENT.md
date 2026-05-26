# Arc 20G Event Gear Planning and Deployment

## Summary

Arc 20G adds lightweight, organization-scoped event gear planning on top of the existing GearOps inventory, custody, readiness, location, maintenance, rapid/mobile, and consumable workflows.

The implementation adds:

- `EventGearPlan` for one operational plan per event
- `EventGearRequirement` for required, optional, and support gear needs
- `EventGearAssignment` for specific item-to-requirement planning, staging, and recovery records
- an event gear workspace at `/events/[eventId]/gear`
- event detail links and at-a-glance event gear status

## Model

### EventGearPlan

Tracks the event-linked operational plan:

- status (`DRAFT`, `READY_TO_STAGE`, `STAGED`, `DEPLOYED`, `RECOVERING`, `COMPLETED`)
- default staging and recovery locations
- deployment context text
- checklist, staging, and recovery notes
- readiness check timestamp
- prepared by / prepared at metadata

One plan is attached to one event to keep the workflow lightweight and event-centric.

### EventGearRequirement

Tracks gear needs inside a plan:

- requirement label
- requirement type (`REQUIRED`, `OPTIONAL`, `SUPPORT`)
- quantity needed
- preferred gear category
- notes

Requirements remain generic and reusable across multiple gear categories.

### EventGearAssignment

Tracks the specific inventory item assigned to a requirement:

- assigned by / assigned at
- staged from / staged to / staged by / staged at
- recovered to / recovered by / recovered at
- condition on recovery
- maintenance flag
- notes and recovery notes

Checkout and return custody remain in the existing `GearCheckout` workflow. Event assignments add the event-specific planning, staging, and recovery layer around those custody records.

## Workflow

### Planning

1. Create or update the event gear plan from the event gear page.
2. Add required, optional, and support requirements.
3. Assign specific inventory items to each requirement.

### Readiness

Readiness is derived from the assigned item state and existing GearOps lifecycle signals:

- ready
- unavailable
- out of service
- limited-use
- maintenance-needed
- missing / not yet assigned

Unavailable highlights blocking custody or assignment conflicts. Limited-use highlights fair-condition, needs-inspection, or low-quantity signals. Out-of-service and maintenance-needed keep maintenance/readiness concerns visible before departure.

### Staging

Staging updates the event assignment and records an inventory movement to the chosen staging location when one is provided. This keeps vault / equipment cage and location workflows aligned with the event plan.

### Deployment

Deployment intentionally reuses the existing item checkout and rapid/mobile scan flows:

- rapid checkout scan
- item checkout form with event prefilled
- event-linked GearCheckout custody records

This avoids building a second custody system while still attaching deployment to the event.

### Return and Recovery

Return continues through existing item return / check-in workflows.

Recovery then completes the event-specific post-event review:

- recovered-to location
- condition on recovery
- maintenance flag
- recovery notes

Recovery can also set maintenance-needed readiness and create an inspection log when the event review finds issues.

### Consumables

Consumables continue to use event-linked `ConsumableTransaction` records. The event gear page links operators into item consumable adjustment workflows with event context prefilled.

## Readiness, Custody, and Location Integration

- readiness uses existing `GearItem.readinessState`, lifecycle status, and condition status
- custody uses existing `GearCheckout` and `GearAssignment` models
- location tracking uses existing `InventoryLocation` and `InventoryMovement`
- maintenance follows existing `GearMaintenanceLog`

Arc 20G adds orchestration around those systems instead of replacing them.

## Activity and History

The event gear page shows a lightweight gear history timeline using:

- staging events
- recovery events
- event-linked checkouts and returns
- event-linked consumable transactions

Plan, requirement, assignment, staging, and recovery writes also emit `AuditEvent` records for audit-friendly review.

## Deferred Scope

Arc 20G intentionally does not add:

- logistics routing
- vehicle/loadout optimization
- warehouse picking optimization
- procurement workflows
- advanced scheduling rebuilds
- full offline sync
- heavy realtime collaboration
- automated planning recommendations

## Future Path

Recommended next steps after Arc 20G:

1. add requirement editing / cancellation controls
2. add batch staging and batch recovery actions
3. add event gear dashboard rollups on the events list
4. add richer audit/history filtering for event gear operations
5. add mobile-first event gear views and offline-ready capture boundaries
