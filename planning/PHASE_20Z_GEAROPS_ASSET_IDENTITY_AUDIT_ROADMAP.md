# Phase 20Z — GearOps Asset Identity & Audit Roadmap

**Status:** In progress (Phase 20Z)
**Scope:** GearOps asset identity, label, QR, and audit/history improvements

---

## What Was Implemented (Phase 20Z)

### 1. `assetId` field on `GearItem`
- Added `assetId String?` to the `GearItem` Prisma model with org-scoped uniqueness (`@@unique([organizationId, assetId])`) and a covering index.
- Auto-generated on item creation using the format `GO-{CATCODE}-{NNNN}` (e.g., `GO-RIFLE-0007`).
- Admin override accepted on create or edit; must match `GO-[A-Z0-9]{1,8}-[A-Z0-9]{1,8}` or be left blank.
- Generation logic lives in `lib/gear-asset-id.ts`.

### 2. Items list page
- `assetId` added to the Prisma select query and displayed as a monospace chip below each item name.
- Search updated to include `assetId` in the `OR` clause; placeholder updated.

### 3. Item detail page
- `assetId` shown prominently below the item name in the header (monospace, bold).
- An "Asset ID" row added to the readiness/identity `dl` panel.

### 4. Label service
- `assetId` added to the `GEAR_ITEM` select in `getInventoryLabelPreview()`.
- Scan value now encodes as `ASSETID:{assetId}` when present; falls back to `BC:{barcodeValue}` or `ITEM:{id}`.
- Display identifier preference: `assetId` → `barcodeValue` → `serialNumber` → `sku` → fallback ref.

### 5. Create and edit forms
- Item create form (`/gear-ops/items/new`): optional `assetId` override field with placeholder and error display.
- Item edit form (`/gear-ops/items/[itemId]/edit`): pre-filled `assetId` field; blank submission preserves existing value.

### 6. Bulk CSV import/export
- Added `asset_id` as a recognized import column (aliases: `asset_id`, `go_id`).
- `assetId` included in create/update data during import commit.
- Export inventory CSV now includes `asset_id` column.
- Identifier matching priority for import: `serial_number` → `asset_id` → `asset_tag` → `template_key`.

---

## Deferred / Roadmap Items

### A. Kit ID format enforcement
**Current state:** `InventoryKit.labelCode` is an optional free-text string with org-scoped uniqueness.  
**Gap:** No `GO-KIT-{NNNN}` auto-generation; no format validation; `labelCode` is user-managed.  
**TODO:** Add `kitId String?` field to `InventoryKit` mirroring the `assetId` pattern, or enforce `GO-KIT-{NNNN}` format on `labelCode` via a validation helper.

### B. Location ID format enforcement
**Current state:** `InventoryLocation.locationCode` is an optional free-text string.  
**Gap:** No `GO-LOC-{NNNN}` auto-generation.  
**TODO:** Add auto-generation and format validation for location codes using the same generator pattern.

### C. Unified audit/history timeline
**Current state:** Multiple history tables exist (`InventoryMovement`, `GearKitCustodyEvent`, `InventoryScanEvent`, checkout/assignment records) but there is no single `GearItemAuditLog` model or UI timeline that merges all event types.  
**Gap:** No single timeline shows all event types (created, edited, Asset ID changed, location changed, checked out, returned, maintenance, damage, approval, kit membership, retired).  
**TODO:**
1. Add a `GearItemAuditLog` model with fields: `id`, `organizationId`, `gearItemId`, `actorPersonId`, `timestamp`, `eventType` (enum), `previousValue`, `newValue`, `notes`.
2. Add `eventType` enum values: `CREATED`, `EDITED`, `ASSET_ID_CHANGED`, `LIFECYCLE_STATUS_CHANGED`, `CONDITION_CHANGED`, `LOCATION_CHANGED`, `CHECKED_OUT`, `RETURNED`, `MAINTENANCE_CREATED`, `MAINTENANCE_COMPLETED`, `DAMAGE_REPORTED`, `APPROVAL_REQUESTED`, `APPROVAL_APPROVED`, `APPROVAL_DENIED`, `KIT_MEMBERSHIP_ADDED`, `KIT_MEMBERSHIP_REMOVED`, `RETIRED`, `LABEL_CHANGED`.
3. Wire audit log writes into all create/edit/checkout/return/maintenance/assignment routes.
4. Display the audit timeline on the item detail page.

### D. Asset ID change audit entries
**Current state:** The edit route accepts and saves `assetId` changes without writing to an audit log.  
**TODO:** After implementing `GearItemAuditLog` (item C), record an `ASSET_ID_CHANGED` entry whenever `assetId` is updated via the edit route, capturing `previousValue` and `newValue`.

### E. Scan-to-action workflows
**Current state:** QR scans resolve to `ASSETID:{assetId}` and navigate to the item detail page via the scan center.  
**Gap:** No direct scan-to-checkout, scan-to-return, scan-to-maintenance, or scan-to-location-assignment flows.  
**TODO:** Add scan context routing so that `ASSETID:{id}` scans in specific contexts (e.g., field checkout station) route directly to the appropriate action form instead of the detail page.

### F. Search/filter enhancements
**Current state:** Inventory list supports search by Asset ID, name, barcode, serial, SKU.  
**Gap:** No UI filter chips for category, status, location, custodian, or owner on the list page (filters exist via URL params but no filter-builder UI).  
**TODO:** Add a filter panel to the items list page for category, lifecycle status, condition status, location, and custodian.

### G. Kit and location label templates
**Current state:** `KIT_LOADOUT` and `INVENTORY_LOCATION` label templates already exist and render QR codes.  
**Gap:** Kit and location labels do not yet use a standardized `kitId`/`locationId` format (deferred to items A and B above).  
**TODO:** After implementing kit ID and location ID auto-generation, update the label service to prefer those IDs for scan values.

---

## Manual Retest Steps

After the database migration is applied:

1. **Create a new gear item** (no Asset ID override):
   - Navigate to `/gear-ops/items/new`, fill out required fields, leave Asset ID blank.
   - Submit. Confirm the item is created with an auto-generated `assetId` in `GO-{CATCODE}-{NNNN}` format.
   - The item detail page should show the Asset ID prominently below the name.

2. **Create a new gear item with explicit Asset ID**:
   - Enter a valid Asset ID override (e.g., `GO-RIFLE-0099`).
   - Confirm it is saved as entered.
   - Attempt to create a second item with the same Asset ID — confirm a validation error is shown.

3. **Edit item Asset ID**:
   - Open an existing item's edit form.
   - Confirm the current Asset ID is pre-filled.
   - Change it to a new value; confirm it updates.
   - Clear the field and save; confirm the existing Asset ID is preserved.

4. **Items list search**:
   - Search by exact Asset ID (e.g., `GO-RIFLE-0007`). Confirm the correct item is returned.
   - Search by partial Asset ID (e.g., `RIFLE`). Confirm matching items appear.

5. **Print label**:
   - From the item detail page, click "Print label".
   - Confirm the label shows the Asset ID as the primary identifier.
   - Confirm the QR code value encodes `ASSETID:{assetId}`.

6. **Bulk CSV import**:
   - Download the inventory export CSV; confirm it includes an `asset_id` column.
   - Prepare an import CSV with an `asset_id` column; upload and confirm items are created/matched by Asset ID.

7. **Existing items (backward compatibility)**:
   - Confirm existing items with no `assetId` still display and function correctly (Asset ID shows `—` on detail page).
