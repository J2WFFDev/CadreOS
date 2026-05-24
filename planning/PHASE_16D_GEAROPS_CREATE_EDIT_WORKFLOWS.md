# Phase 16D: GearOps Category and Item Create/Edit Workflows

## Overview

Arc 16D adds staff-scoped create and edit workflows for GearCategory and GearItem. These workflows build directly on the Arc 16B Prisma schema and Arc 16C read-only catalog views, using the same organization scoping, staff authorization, and form/route patterns established across Core, FieldOps, and earlier GearOps arcs.

Assignment, checkout/check-in, maintenance write workflows, and consumable transactions remain deferred to later Arc 16 phases.

---

## Routes Added

### GearCategory

| Route | Method | Description |
|-------|--------|-------------|
| `/gear-ops/categories/new` | GET | New category form page |
| `/gear-ops/categories/create` | POST | Create category route handler |
| `/gear-ops/categories/[categoryId]/edit` | GET | Edit category form page |
| `/gear-ops/categories/[categoryId]/edit/update` | POST | Update category route handler |

### GearItem

| Route | Method | Description |
|-------|--------|-------------|
| `/gear-ops/items/new` | GET | New item form page |
| `/gear-ops/items/create` | POST | Create item route handler |
| `/gear-ops/items/[itemId]/edit` | GET | Edit item form page |
| `/gear-ops/items/[itemId]/edit/update` | POST | Update item route handler |

---

## Authorization

### Read-gate on form pages

All new/edit form pages call `resolveGearOpsReadAccess()` to gate access. Staff-only read access is required before the form is displayed. Denied access shows the standard denial message and no form is rendered.

### Write-gate on route handlers

All create/update route handlers call `requirePhase1CMutationPermission()` with the appropriate GearOps action. The following roles receive GearOps write permissions:

| Role | gearCategory.create | gearCategory.update | gearItem.create | gearItem.update |
|------|---------------------|---------------------|-----------------|-----------------|
| ORGANIZATION_ADMIN | ✓ | ✓ | ✓ | ✓ |
| PROGRAM_DIRECTOR | ✓ | ✓ | ✓ | ✓ |
| COACH | — | — | ✓ | ✓ |
| ASSISTANT_COACH | — | — | — | — |

GearCategory creation/update is restricted to organization-level staff (ORGANIZATION_ADMIN and PROGRAM_DIRECTOR) because categories are org-wide groupings. GearItem creation/update is also available to COACH roles.

---

## Validation

### GearCategory fields

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Yes | 1–100 characters |
| `inventoryType` | Yes | Must be a valid `GearInventoryType` enum value (DURABLE / CONSUMABLE) |
| `description` | No | Max 1000 characters |

### GearItem fields

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Yes | 1–100 characters |
| `gearCategoryId` | Yes | Must exist in the same organization |
| `inventoryType` | Yes | Must be a valid `GearInventoryType` enum value |
| `lifecycleStatus` | Yes | Must be a valid `GearItemLifecycleStatus` enum value |
| `programId` | No | Must exist in the same organization if provided |
| `sku` | No | Max 100 characters |
| `serialNumber` | No | Max 100 characters; unique constraint enforced by DB |
| `quantityOnHand` | No | Integer ≥ 0, defaults to 0 |
| `quantityMin` | No | Integer ≥ 0 (intended for consumable items) |
| `conditionStatus` | No | Must be a valid `GearConditionStatus` enum value if provided (intended for durable items) |
| `notes` | No | Max 4000 characters |

Field labels on forms use `(durable items)` and `(consumable items)` annotations to guide staff. The server-side handler accepts all fields for both inventory types; business rules about which fields are applicable are advisory at the form level.

---

## Cross-Organization Protection

Both create and update route handlers explicitly verify that `gearCategoryId` and `programId` (if provided) belong to the same organization as the authenticated scope before committing changes to the database. This prevents cross-organization reference injection via form manipulation.

---

## Error Handling

- All validation errors redirect back to the form page with field-level error parameters and preserved input values.
- Database uniqueness violations (P2002) on `serialNumber` are surfaced as field-level errors.
- Permission denied errors display the existing `PermissionDeniedError` message.
- Schema unavailable errors display a schema setup message.
- A not-found item/category on the edit page displays a clear "not found" message with a back link.

---

## Redirect Flow

| Trigger | Redirect Target |
|---------|----------------|
| Successful category create | `/gear-ops/categories/[new id]` |
| Successful category update | `/gear-ops/categories/[categoryId]` |
| Successful item create | `/gear-ops/items/[new id]` |
| Successful item update | `/gear-ops/items/[itemId]` |
| Cancel on new category form | `/gear-ops/categories` |
| Cancel on edit category form | `/gear-ops/categories/[categoryId]` |
| Cancel on new item form | `/gear-ops/items` |
| Cancel on edit item form | `/gear-ops/items/[itemId]` |

---

## Entry Points Added to Existing Pages

| Page | Change |
|------|--------|
| `/gear-ops/categories` | Added "New category" button (top-right, staff visible) |
| `/gear-ops/categories/[categoryId]` | Added "Edit" link in the header badge area |
| `/gear-ops/items` | Added "New item" button (top-right, staff visible) |
| `/gear-ops/items/[itemId]` | Added "Edit" link in the header badge area |

---

## Workflow Schemas Added (`lib/workflows/index.ts`)

- `gearCategoryWorkflowSchema`: Validates and transforms name, inventoryType, description
- `gearItemWorkflowSchema`: Validates and transforms all GearItem fields including numeric quantity parsing and enum validation
- `GearCategoryWorkflowInput`: Type export for gearCategoryWorkflowSchema output
- `GearItemWorkflowInput`: Type export for gearItemWorkflowSchema output

---

## Permissions Added (`lib/permissions/index.ts`)

New `SupportedAction` entries:
- `gearCategory.create`
- `gearCategory.update`
- `gearItem.create`
- `gearItem.update`

All four are added to `SUPPORTED_ACTIONS`. `gearCategory.create` and `gearCategory.update` are org-scoped (not in `SCOPED_ACTIONS`). `gearItem.create` and `gearItem.update` are also treated as org-scoped (no program/team scope required at permission evaluation time; cross-org references are validated explicitly in the route handler).

---

## Constraints Preserved

- No assignment workflows added.
- No checkout/check-in workflows added.
- No maintenance write workflows added.
- No consumable transaction write workflows added.
- No messaging/notifications added.
- No purchasing/finance/depreciation added.
- No barcode/QR scanning added.
- Prisma schema is unchanged.
- All Arc 16C read-only routes are preserved intact.
- All Core and FieldOps behavior is preserved.
