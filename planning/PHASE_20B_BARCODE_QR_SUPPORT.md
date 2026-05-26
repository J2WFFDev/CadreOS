# Arc 20B — Barcode & QR Support

## Status
Implementation complete.

## Scope Delivered
- Organization-scoped scan architecture with generic inventory identifiers.
- Inventory scan service layer for validation, resolution, and event recording.
- Scan event activity persistence (`InventoryScanEvent`) for operational history.
- Scan-driven item/location resolution workflows with mobile-friendly interactions.
- Scan-assisted routing for lookup, checkout, check-in, assignment, cage/vault, and audit-prep contexts.
- Scan-aware item history visibility and scan quick actions.
- Barcode/QR identifier capture and validation in gear item create/edit workflows.

## Architecture Decisions

### InventoryIdentifier strategy
- Added a prefix-capable identifier parser supporting:
  - `ITEM:`, `ID:` → gear item id
  - `BARCODE:`, `BC:`, `QR:` → barcode/QR value
  - `SERIAL:`, `SN:` → serial number
  - `SKU:` → SKU
  - `LOC:`, `LOCATION:` → location code
- Supports unprefixed fallback matching across barcode/serial/SKU for low-friction scanning.
- Keeps implementation inventory-type agnostic and reusable across workflows.

### ScanContext strategy
- Introduced explicit operational scan contexts:
  - `INVENTORY_LOOKUP`
  - `CHECKOUT`
  - `CHECKIN`
  - `INVENTORY_VERIFICATION`
  - `ASSIGNMENT`
  - `CAGE_VAULT`
  - `AUDIT_PREP`
- Context drives post-scan routing only; it does not enforce hardware assumptions.

### ScanEvent strategy
- Added `InventoryScanEvent` as immutable history records:
  - stores raw/normalized values, identifier type, context, result, match type, actor, and optional target entities
  - organization-scoped and indexed for operational/audit retrieval
- Preserves compatibility with existing GearOps history patterns while avoiding scanner hardware coupling.

## Deferred Scope (Intentional)
- Native camera/device integrations and scanner hardware SDKs.
- Offline sync/conflict resolution for disconnected field operation.
- Advanced print queue and label template management.
- IoT locker/cage device orchestration.
- AI image decoding or visual recognition.
- Warehouse-grade orchestration (wave picking/bin optimization).

## Arc 20C Recommendations
1. Bulk verification sessions with scan batches and discrepancy review queues.
2. Scan-event analytics/reporting views for custody and audit timelines.
3. Label generation workflow with printable templates per `LabelFormat`.
4. Optional progressive web app scan shell for field/offline-ready UX.
5. Configurable organization scan policies (allowed identifier prefixes, strictness, required contexts).
