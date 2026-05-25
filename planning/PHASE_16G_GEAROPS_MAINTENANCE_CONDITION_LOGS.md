# Phase 16G: GearOps Maintenance and Condition Logging Workflows

## Overview

Arc 16G adds staff-scoped GearOps maintenance and condition logging workflows on top of Arc 16B schema foundations and Arc 16C–16F runtime behavior. This arc introduces controlled create/update flows for `GearMaintenanceLog` records and expands item detail visibility to show recent maintenance activity and historical maintenance context.

Consumable transaction write workflows remain deferred to Arc 16H or later.

---

## Routes Added

| Route | Method | Description |
|-------|--------|-------------|
| `/gear-ops/items/[itemId]/maintenance/new` | GET | Maintenance create form page |
| `/gear-ops/items/[itemId]/maintenance/create` | POST | Maintenance create route handler |
| `/gear-ops/items/[itemId]/maintenance/[maintenanceLogId]/edit` | GET | Maintenance edit form page |
| `/gear-ops/items/[itemId]/maintenance/[maintenanceLogId]/edit/update` | POST | Maintenance update route handler |

---

## Item Detail Maintenance Visibility Enhancements

`/gear-ops/items/[itemId]` maintenance presentation now includes:

- **Maintenance and condition logs** section heading.
- **New maintenance log** action button linking to create workflow.
- **Edit** link on each maintenance record card.
- Split maintenance visibility into:
  - **Recent logs** (latest entries surfaced first)
  - **Maintenance history** (older entries)
- Display of:
  - maintenance type
  - service date/time (`performedAt`)
  - condition before/after
  - notes
  - actor context (`performedBy`)
  - created/logged context (`createdAt`)
- Safe empty states when no logs exist or no additional history remains.

`nextServiceDate` is not currently modeled on `GearMaintenanceLog`, so no next-service field is rendered in Arc 16G.

---

## Authorization

### Read-gate on form pages

Maintenance create/edit form pages use `resolveGearOpsReadAccess()` and return the existing denial state when staff read access is unavailable.

### Write-gate on route handlers

Maintenance create/update route handlers call `requirePhase1CMutationPermission()` with maintenance actions:

| Role | `gearMaintenance.create` | `gearMaintenance.update` |
|------|---------------------------|---------------------------|
| ORGANIZATION_ADMIN | ✓ | ✓ |
| PROGRAM_DIRECTOR | ✓ | ✓ |
| COACH | ✓ | ✓ |
| ASSISTANT_COACH | — | — |

Both actions are org-scoped and are not added to `SCOPED_ACTIONS`.

---

## Workflow Schema (`lib/workflows/index.ts`)

Added:

- `gearMaintenanceWorkflowSchema`
- `GearMaintenanceWorkflowInput`
- `requirePhase1CMutationPermission` action union support for:
  - `gearMaintenance.create`
  - `gearMaintenance.update`

Validation includes:

- Required maintenance type (`GearMaintenanceType`)
- Required performed-by person selection
- Required service date/time (`performedAt`) with `YYYY-MM-DDTHH:mm` validation
- Condition before/after enum validation (`GearConditionStatus`) when provided
- Required notes with max length enforcement

---

## Cross-Organization Protection

Both maintenance route handlers enforce organization scoping for:

- target `GearItem`
- `performedByPersonId`
- maintenance row update target (`id + gearItemId + organizationId` on update)

This prevents cross-organization reference and update injection via form manipulation.

---

## Error Handling and Redirects

- Validation errors redirect back to the corresponding form with field-level errors and preserved values.
- Invalid item ids and invalid maintenance ids produce explicit not-found states on form pages with safe back links.
- Update route returns error redirect when no matching maintenance row is updated.
- Successful create/update redirects to `/gear-ops/items/[itemId]`.
- Cancel actions return to `/gear-ops/items/[itemId]`.

---

## Constraints Preserved

- No Prisma schema changes in Arc 16G.
- No consumable transaction write workflows.
- No messaging/notifications changes.
- No purchasing/finance/depreciation workflows.
- No barcode/QR scanning behavior.
- Existing Arc 16C read-only catalog routes remain intact.
- Existing Arc 16D category/item create-edit workflows remain intact.
- Existing Arc 16E assignment workflows remain intact.
- Existing Arc 16F checkout/check-in workflows remain intact.

