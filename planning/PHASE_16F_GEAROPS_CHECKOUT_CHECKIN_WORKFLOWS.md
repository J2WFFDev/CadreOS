# Phase 16F: GearOps Checkout and Check-in Custody Workflows

## Overview

Arc 16F adds staff-scoped checkout/check-in workflows for `GearCheckout` custody tracking on durable and mixed-use gear inventory items. This arc builds on Arc 16B schema foundations plus Arc 16C/16D/16E GearOps routes and follows the same organization scoping, staff authorization, and route/form patterns already used in CadreOS.

Maintenance write workflows and consumable transaction write workflows remain deferred to later Arc 16 phases.

---

## Routes Added

| Route | Method | Description |
|-------|--------|-------------|
| `/gear-ops/items/[itemId]/checkout` | GET | Checkout create form page |
| `/gear-ops/items/[itemId]/checkout/create` | POST | Create checkout route handler |
| `/gear-ops/items/[itemId]/checkouts/[checkoutId]/edit` | GET | Checkout edit/check-in form page |
| `/gear-ops/items/[itemId]/checkouts/[checkoutId]/edit/update` | POST | Update checkout/check-in route handler |

---

## Item Detail Checkout Visibility Enhancements

`/gear-ops/items/[itemId]` checkout presentation now includes:

- **Check out gear** action button in the Checkouts section header.
- **Edit** link on each checkout card.
- Split checkout display into:
  - **Current open checkouts** (`OPEN`, `OVERDUE`)
  - **Checkout history** (`RETURNED`, `LOST`)
- Labeled custody context values where schema supports them:
  - checked-out-to person (`checkedOutBy`)
  - event (`event`)
  - team/program derived from linked event when available
  - fallback program label from `GearItem.program` where event program is not present
- Safe empty state when no checkout records exist.

---

## Authorization

### Read-gate on form pages

Both checkout form pages use `resolveGearOpsReadAccess()` and deny rendering when staff read access is unavailable.

### Write-gate on route handlers

Checkout create/update handlers use `requirePhase1CMutationPermission()` with checkout actions:

| Role | `gearCheckout.create` | `gearCheckout.update` |
|------|------------------------|------------------------|
| ORGANIZATION_ADMIN | ✓ | ✓ |
| PROGRAM_DIRECTOR | ✓ | ✓ |
| COACH | ✓ | ✓ |
| ASSISTANT_COACH | — | — |

Both actions are org-scoped (not added to `SCOPED_ACTIONS`), matching existing GearOps create/update behavior.

---

## Workflow Schema (`lib/workflows/index.ts`)

Added:

- `gearCheckoutWorkflowSchema`
- `GearCheckoutWorkflowInput`
- `requirePhase1CMutationPermission` action union support for:
  - `gearCheckout.create`
  - `gearCheckout.update`

Validation includes:

- Required custody actors (`checkedOutById`, `issuedById`)
- Required checkout timestamp (`checkedOutAt`)
- Enum validation for checkout status and return condition
- Datetime format validation (`YYYY-MM-DDTHH:mm`) for checkout/expected return/returned timestamps
- Status-date consistency rules:
  - `RETURNED` requires `returnedAt`, `returnedById`, and `receivedById`
  - non-`RETURNED` statuses cannot set return/check-in fields
  - expected/returned timestamps cannot be earlier than checkout timestamp

---

## Cross-Organization Protection

Both checkout route handlers enforce organization scoping for all referenced entities:

- target `GearItem`
- `checkedOutById` / `issuedById`
- optional `returnedById` / `receivedById`
- optional `eventId`

This prevents cross-organization reference injection through form manipulation.

---

## Error Handling and Redirects

- Validation and business-rule errors redirect back to the form with field-level error query params and preserved input values.
- Invalid item/checkout IDs produce clear not-found states on form pages.
- Update route uses `updateMany` filtered by `id + gearItemId + organizationId` and returns an error redirect when no row is updated.
- Successful create/update/check-in redirects to `/gear-ops/items/[itemId]`.
- Cancel actions return safely to `/gear-ops/items/[itemId]`.

---

## Constraints Preserved

- No Prisma schema changes in Arc 16F.
- No maintenance write workflows.
- No consumable transaction write workflows.
- No messaging/notifications changes.
- No purchasing/finance/depreciation workflows.
- No barcode/QR scanning behavior.
- Existing Arc 16C catalog views, Arc 16D category/item create/edit workflows, and Arc 16E assignment workflows remain intact.

