# Phase 20A — Inventory Operations Architecture

## Status
Implementation complete.

## Overview

Arc 20A strengthens GearOps from basic inventory CRUD into **operational inventory management**.

It introduces a reusable, organization-scoped inventory operations layer built on top of the existing GearOps models, adding:

- **Full movement history** — every state and location change is recorded as an immutable InventoryMovement event
- **Location/vault support** — items can be assigned to physical or logical InventoryLocations with optional hierarchy
- **Kit/loadout management** — gear items can be grouped into operational InventoryKits
- **Readiness state** — items carry an explicit InventoryReadinessState (READY, NEEDS_INSPECTION, MAINTENANCE_REQUIRED, NOT_READY, DECOMMISSIONED)
- **Ownership type** — items can be classified by ownership (ORGANIZATION_OWNED, PERSONALLY_OWNED, LOANED_IN, LOANED_OUT, DONATED)
- **Barcode/QR compatibility** — items carry a nullable `barcodeValue` field for future scan workflows
- **Extended lifecycle states** — `GearItemLifecycleStatus` now includes QUARANTINED and RESERVED
- **Operational graph integration** — new node types (INVENTORY_LOCATION, INVENTORY_MOVEMENT, INVENTORY_KIT) participate in the Arc 19 operational graph

## Architecture Decisions

### Schema Design

**InventoryMovement as an append-only audit trail**
Every custody transfer, location change, and lifecycle transition is recorded as a separate `InventoryMovement` row. Records are never updated or deleted, providing full traceability. This enables future audit queries without requiring a separate audit log system.

**InventoryLocation with optional hierarchy**
Locations support a self-referencing `parentLocationId` for vault → shelf → bin style hierarchies. This is a lightweight foundation; complex warehouse topology is explicitly deferred.

**InventoryKit with soft-delete for items**
Kit items are soft-deleted via `removedAt` rather than hard-deleted, so historical kit contents remain visible for audit and operational review.

**GearItem as the central inventory record**
Rather than introducing a separate `InventoryItem` model, Arc 20A extends `GearItem` directly with the new operational fields (`ownershipType`, `readinessState`, `locationId`, `barcodeValue`). This avoids a redundant indirection layer while the existing GearOps CRUD patterns remain stable.

**Organization-scoped authorization**
Inventory operations inherit GearOps staff authorization via `resolveInventoryOpsReadAccess` and `resolveInventoryOpsWriteAccess`. This will be tightened in a future Arc if a dedicated GEAR_OPS_MANAGER role is added.

### State Machine

The `lifecycleStatusForMovementType` function provides a deterministic mapping from movement type to lifecycle status, ensuring the item state and movement history remain consistent. Callers can override this mapping via `updateLifecycleStatus` when needed.

```
RECEIVED       → (no status change, just records arrival)
ASSIGNED       → ASSIGNED
UNASSIGNED     → ACTIVE
CHECKED_OUT    → CHECKED_OUT
CHECKED_IN     → ACTIVE
LOANED_OUT     → ASSIGNED
LOAN_RETURNED  → ACTIVE
SENT_FOR_MAINTENANCE   → MAINTENANCE
RETURNED_FROM_MAINTENANCE → ACTIVE
RESERVED               → RESERVED
RESERVATION_RELEASED   → ACTIVE
QUARANTINED            → QUARANTINED
QUARANTINE_RELEASED    → ACTIVE
LOST                   → LOST
FOUND                  → ACTIVE
RETIRED                → RETIRED
MOVED_TO_LOCATION      → (no status change, location update only)
TRANSFERRED            → (no status change, location update only)
```

### Integration

The `recordInventoryMovement` service function wraps all writes in a DB transaction: it creates the movement record and optionally updates the `GearItem`'s `lifecycleStatus` and `locationId` atomically.

The `lib/inventory-ops` module is published as a clean public API surface via `index.ts`, with internal sub-modules (`types.ts`, `service.ts`, `access.ts`) not intended for direct import.

## Changed Files

### Schema
- `prisma/schema.prisma` — Added enums `InventoryOwnershipType`, `InventoryReadinessState`, `InventoryMovementType`; extended `GearItemLifecycleStatus` with QUARANTINED, RESERVED; added fields to `GearItem`; added models `InventoryLocation`, `InventoryMovement`, `InventoryKit`, `InventoryKitItem`; extended `OperationalGraphNodeType` and `EntryObjectLinkTargetType`

### Library
- `lib/inventory-ops/types.ts` — Type definitions, state constants, movement type groupings, state machine helper, label helpers
- `lib/inventory-ops/service.ts` — Movement recording, location management, kit management, custody lookup
- `lib/inventory-ops/access.ts` — Organization-scoped authorization wrappers
- `lib/inventory-ops/index.ts` — Public module API
- `lib/gear-ops.ts` — Added `getReadinessBadgeClass`, extended `getGearLifecycleBadgeClass` for QUARANTINED/RESERVED
- `lib/operational-graph/render.ts` — Added node type labels for new inventory nodes
- `lib/operational-graph/service.ts` — Added node existence checks and view resolution for INVENTORY_LOCATION, INVENTORY_MOVEMENT, INVENTORY_KIT
- `lib/operational-graph/types.ts` — Added new node types to constants and ENTRY_OBJECT_TO_GRAPH_NODE mapping

### Components
- `components/gear-ops/subnav.tsx` — Added Locations and Kits nav entries

### UI
- `app/(dashboard)/gear-ops/locations/page.tsx` — Location list
- `app/(dashboard)/gear-ops/locations/new/page.tsx` — Location create form
- `app/(dashboard)/gear-ops/locations/create/route.ts` — Location create POST handler
- `app/(dashboard)/gear-ops/locations/[locationId]/page.tsx` — Location detail with item list
- `app/(dashboard)/gear-ops/kits/page.tsx` — Kit list
- `app/(dashboard)/gear-ops/kits/new/page.tsx` — Kit create form
- `app/(dashboard)/gear-ops/kits/create/route.ts` — Kit create POST handler
- `app/(dashboard)/gear-ops/kits/[kitId]/page.tsx` — Kit detail with item list
- `app/(dashboard)/gear-ops/items/[itemId]/page.tsx` — Updated to show location, readiness, ownership, barcode, and movement history

### Tests
- `tests/inventory-ops/types.test.ts` — 27 tests covering state constants, movement type groupings, state machine transitions, and label helpers

## Deferred Scope

The following capabilities were intentionally deferred per the problem statement guidance:

| Deferred Capability | Reason for Deferral |
|---|---|
| Barcode/QR scan workflow UI | Requires hardware/camera integration; field is ready in schema (`barcodeValue`) |
| Bulk audit workflows | Requires dedicated audit tooling; movement history provides the data foundation |
| Replenishment automation | ERP-scale; consumable min/low-availability signaling already exists |
| IoT/sensor integrations | Out of scope for operational MVP |
| Advanced offline sync | Requires dedicated offline architecture |
| Vault access control (who can open cage) | Separate physical security concern |
| Inventory reservation workflow UI | State exists in schema; CRUD routes for RESERVED state are deferred |
| Movement history API (REST endpoint) | Data access via page routes is sufficient for MVP |
| Kit deployment workflows | Kit management UI is present; "deploy kit to event" workflow is Arc 20B |
| Item-level readiness workflow | State exists; automated readiness checks are Arc 20B |

## Arc 20B Recommendations

1. **Inventory movement API routes** — Add POST routes for recording movements directly (e.g., `POST /gear-ops/items/[itemId]/movements`) so the movement history is populated from real operations
2. **Kit deployment workflow** — Wire kit checkout to GearCheckout records, enabling "deploy kit for event" and "return kit" flows
3. **Readiness workflow integration** — Auto-flag items as NEEDS_INSPECTION after checkout return or maintenance completion
4. **Reservation management** — Add RESERVED lifecycle workflow: reserve items for upcoming events, then convert to CHECKED_OUT
5. **Location movement UI** — Quick-action "Move to location" on item detail page
6. **Barcode/QR scan integration** — Add `barcodeValue` search to item lookup once mobile scanner workflow is defined
7. **Ownership workflow** — Support loaned-in equipment return workflows and personally-owned equipment tracking
8. **Audit report foundation** — Export movement history for a date range as a basic inventory audit report
