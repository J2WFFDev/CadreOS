# Phase 16H: GearOps Consumable Transaction Workflows

## Overview

Arc 16H adds staff-scoped consumable transaction workflows for GearOps using the existing `ConsumableTransaction` model. This arc introduces controlled create/update flows for consumable stock movement and expands item detail presentation for consumable transaction visibility while preserving Arc 16A–16G behavior and boundaries.

Purchasing/finance, automated replenishment, barcode/QR workflows, and notifications remain deferred.

---

## Routes Added

| Route | Method | Description |
|-------|--------|-------------|
| `/gear-ops/items/[itemId]/consumables/new` | GET | Consumable transaction create form page |
| `/gear-ops/items/[itemId]/consumables/create` | POST | Consumable transaction create route handler |
| `/gear-ops/items/[itemId]/consumables/[transactionId]/edit` | GET | Consumable transaction edit form page |
| `/gear-ops/items/[itemId]/consumables/[transactionId]/edit/update` | POST | Consumable transaction update route handler |

---

## Item Detail Consumable Visibility Enhancements

`/gear-ops/items/[itemId]` consumable transaction presentation now includes:

- **New transaction** action button for consumable items.
- **Edit** link on each consumable transaction card.
- Split consumable visibility into:
  - **Recent transactions**
  - **Transaction history**
- Display of:
  - transaction type
  - quantity delta and unit label
  - related context where available (event, derived team/program)
  - notes
  - actor context (`recordedBy`)
  - recorded and created/logged timestamps (`recordedAt`, `createdAt`)
- Safe empty state when a consumable item has no transactions.
- Clear non-applicable message for durable items.

---

## Authorization

### Read-gate on form pages

Consumable transaction create/edit form pages use `resolveGearOpsReadAccess()` and return the existing denial state when staff read access is unavailable.

### Write-gate on route handlers

Consumable transaction create/update route handlers call `requirePhase1CMutationPermission()` with consumable transaction actions:

| Role | `gearConsumableTransaction.create` | `gearConsumableTransaction.update` |
|------|------------------------------------|------------------------------------|
| ORGANIZATION_ADMIN | ✓ | ✓ |
| PROGRAM_DIRECTOR | ✓ | ✓ |
| COACH | ✓ | ✓ |
| ASSISTANT_COACH | — | — |

Both actions are org-scoped and are not added to `SCOPED_ACTIONS`.

---

## Workflow Schema (`lib/workflows/index.ts`)

Added:

- `gearConsumableTransactionWorkflowSchema`
- `GearConsumableTransactionWorkflowInput`
- `requirePhase1CMutationPermission` action union support for:
  - `gearConsumableTransaction.create`
  - `gearConsumableTransaction.update`

Validation includes:

- Required transaction type (`ConsumableTransactionType`)
- Required quantity delta as integer
- Required recorded date/time (`recordedAt`) with `YYYY-MM-DDTHH:mm` validation
- Transaction type sign rules where practical:
  - `RECEIVED` must be positive
  - `USED`, `DISTRIBUTED`, and `DISPOSED` must be negative
  - `ADJUSTED` supports positive or negative values
  - zero quantity is rejected
- Optional event context and notes with max length enforcement

---

## Organization Scope and Cross-Reference Protection

Create/update route handlers enforce:

- target `GearItem` belongs to authenticated organization
- target item inventory type is `CONSUMABLE`
- optional `eventId` belongs to authenticated organization
- update target filter uses `id + gearItemId + organizationId`

These checks prevent cross-organization reference/update injection and durable-item misuse.

---

## Stock Continuity Behavior

- Successful consumable transaction create increments/decrements `GearItem.quantityOnHand` by `quantityDelta`.
- Successful consumable transaction update applies stock correction by the delta difference between old and new `quantityDelta`.
- Stock updates and transaction writes execute in a database transaction for consistency.

---

## Error Handling and Redirects

- Validation errors redirect back to form pages with field-level errors and preserved values.
- Invalid item ids and invalid transaction ids produce explicit not-found states on form pages with safe back links.
- Durable-item requests to consumable workflows return clear non-applicable messages.
- Update route returns error redirect when no matching transaction row is updated.
- Successful create/update redirects to `/gear-ops/items/[itemId]`.
- Cancel actions return to `/gear-ops/items/[itemId]`.

---

## Constraints Preserved

- No Prisma schema changes in Arc 16H.
- No purchasing/finance/depreciation workflows.
- No automated replenishment behavior.
- No barcode/QR scanning behavior.
- No messaging/notification changes.
- Existing Arc 16C read-only catalog routes remain intact.
- Existing Arc 16D category/item create-edit workflows remain intact.
- Existing Arc 16E assignment workflows remain intact.
- Existing Arc 16F checkout/check-in workflows remain intact.
- Existing Arc 16G maintenance/condition workflows remain intact.

