# Phase 16B — GearOps Prisma Schema and Data Model

## Goal

Add the minimal GearOps Prisma data model to `prisma/schema.prisma` for inventory accountability while keeping runtime workflows deferred.

This phase follows [Phase 16A GearOps Architecture and Scope Boundaries](./PHASE_16A_GEAROPS_ARCHITECTURE_BOUNDARIES.md).

---

## Models Added

### GearCategory

Organization-scoped grouping for durable/consumable inventory classification.

Core fields: `organizationId`, `name`, `inventoryType`, `description`, timestamps.

Relations: `Organization`, `GearItem[]`

---

### GearItem

Canonical organization-scoped inventory record for durable assets and consumable stock lines.

Core fields: `organizationId`, `programId?`, `gearCategoryId`, `name`, `inventoryType`, `sku?`, `serialNumber?`, `quantityOnHand`, `quantityMin?`, `lifecycleStatus`, `conditionStatus?`, timestamps.

Relations: `Organization`, `Program?`, `GearCategory`, `GearAssignment[]`, `GearCheckout[]`, `GearMaintenanceLog[]`, `ConsumableTransaction[]`

---

### GearAssignment

Assignment record linking an item to person/team/event context with accountable actor attribution.

Core fields: `organizationId`, `gearItemId`, `assignedToPersonId?`, `assignedToTeamId?`, `assignedToEventId?`, `assignedByPersonId`, lifecycle timestamps, `status`, `notes?`.

Relations: `Organization`, `GearItem`, `Person? (assignedTo)`, `Team?`, `Event?`, `Person (assignedBy)`

---

### GearCheckout

Custody transfer lifecycle record for checkout/check-in tracking.

Core fields: `organizationId`, `gearItemId`, `eventId?`, `checkedOutById`, `issuedById`, `returnedById?`, `receivedById?`, checkout/return timestamps, `status`, `conditionOnReturn?`, notes.

Relations: `Organization`, `GearItem`, `Event?`, `Person` (checkedOutBy, issuedBy, returnedBy?, receivedBy?)

---

### GearMaintenanceLog

Durable gear maintenance and condition-history entry.

Core fields: `organizationId`, `gearItemId`, `performedByPersonId`, `maintenanceType`, `performedAt`, `conditionBefore?`, `conditionAfter?`, `notes`, timestamps.

Relations: `Organization`, `GearItem`, `Person (performedBy)`

---

### ConsumableTransaction

Consumable stock movement transaction log.

Core fields: `organizationId`, `gearItemId`, `transactionType`, `quantityDelta`, `recordedByPersonId`, `eventId?`, `recordedAt`, `notes?`, `createdAt`.

Relations: `Organization`, `GearItem`, `Person (recordedBy)`, `Event?`

---

## Enums Added

- `GearInventoryType` (`DURABLE`, `CONSUMABLE`)
- `GearItemLifecycleStatus` (`ACTIVE`, `ASSIGNED`, `CHECKED_OUT`, `MAINTENANCE`, `RETIRED`, `LOST`)
- `GearConditionStatus` (`NEW`, `GOOD`, `FAIR`, `POOR`, `DAMAGED`, `RETIRED`)
- `GearAssignmentStatus` (`PENDING`, `ACTIVE`, `RETURNED`, `TRANSFERRED`, `CANCELLED`, `OVERDUE`)
- `GearCheckoutStatus` (`OPEN`, `RETURNED`, `OVERDUE`, `LOST`)
- `GearMaintenanceType` (`INSPECTION`, `REPAIR`, `CLEANING`, `REPLACEMENT`, `RETIREMENT`)
- `ConsumableTransactionType` (`RECEIVED`, `USED`, `DISTRIBUTED`, `DISPOSED`, `ADJUSTED`)

---

## Organization Scope and Core References

All GearOps models include `organizationId` with FK relations to `Organization`.

Cross-module references are additive and align with Arc 16A boundaries:

- `Program` referenced from `GearItem.programId`
- `Team` referenced from `GearAssignment.assignedToTeamId`
- `Person` referenced for assignment/custody/maintenance/transaction actor attribution
- `Event` referenced from assignment, checkout, and consumable transaction context

No Core ownership transfer is introduced.

---

## Indexes and Uniqueness Added for MVP

Highlights:

- Category uniqueness: `GearCategory @@unique([organizationId, name])`
- Durable identity guardrail: `GearItem @@unique([organizationId, serialNumber])`
- Lookup indexes for org/category/program/status patterns on `GearItem`
- Assignment, checkout, maintenance, and consumable transaction indexes keyed by `organizationId` plus operational filtering fields (`status`, actor IDs, event IDs, due/recorded timestamps)

---

## Required Back-Relations Added

Only relation-supporting additions were made to existing models:

- `Organization`: GearOps collections
- `Program`: `gearItems`
- `Team`: `gearAssignments`
- `Person`: assignment/custody/maintenance/consumable relation collections
- `Event`: assignment/checkout/consumable relation collections

---

## Explicitly Deferred (Not Implemented in 16B)

- UI pages
- Runtime workflows and route handlers
- Messaging/notifications
- Purchasing/finance/depreciation
- Automated replenishment

---

## Validation Commands

```bash
npm run lint
npm run typecheck
npm run build
DATABASE_URL="..." ./node_modules/.bin/prisma validate
```

---

## Phase 16B Output Summary

- `prisma/schema.prisma` updated with minimal GearOps enums/models and required relation back-references.
- `planning/PHASE_16B_GEAROPS_PRISMA_SCHEMA.md` added.
- `planning/PHASE_16B_VALIDATION_CHECKLIST.md` added.
- `planning/README.md` updated with Phase 16B links.
