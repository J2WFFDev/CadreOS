# Arc 20D — Inventory Labels & Print Support

## Status
Implementation complete.

## Scope Delivered
- Lightweight inventory-label architecture in `lib/inventory-labels` with reusable template definitions, printable identifiers, render context shaping, and lightweight print-job metadata.
- Printer-agnostic SVG rendering for QR and Code 128 labels using server-side generation only.
- Organization-scoped label preview and print workflow at `/gear-ops/labels`.
- Operational label coverage for inventory items, vault/cage locations, kits/loadouts, consumables, custody labels, and temporary operational labels.
- Direct label entry points from GearOps item, location, kit, and overview/navigation surfaces.
- Label utility tests covering template metadata, identifier shaping, file naming, and status presentation helpers.

## Architecture Decisions

### Lightweight label domain
Arc 20D keeps labels out of the persistence model for now.  
`InventoryLabelPreview`, `PrintableIdentifier`, `LabelRenderContext`, and `InventoryLabelPrintJob` are computed on demand from existing GearOps inventory records, which keeps the system organization-scoped, low-friction, and reusable without introducing label inventory tables or print infrastructure state.

### Printer-agnostic rendering
Labels render as server-generated SVG-backed HTML previews.  
This keeps output simple for browser print, PDF export, and future printer integrations while avoiding thermal-printer SDK coupling, vendor lock-in, or print server orchestration.

### Reuse of Arc 20A–20C identifiers
Arc 20D intentionally reuses existing scan-compatible prefixes for current workflows:
- `BC:` or `ITEM:` for item labels
- `LOC:` for location labels

Kit and temporary labels emit stable prefixed identifiers (`KIT:` / `TEMP:` / `LOCID:`) as future-compatible payloads without claiming present-day mobile resolution where the underlying workflow is not implemented yet.

### Operational readability first
Templates favor a small number of high-signal fields:
- identifier
- subject name
- organization identifier
- readiness/lifecycle state
- custody/location hints
- simple operational footer

This keeps labels legible in field conditions and supports quick scan-or-read decisions during custody handoffs and audits.

## Deferred Scope (Intentional)
- Persistent print queues, print retries, printer routing, or enterprise print management.
- Thermal-printer command generation or hardware-specific calibration/orchestration.
- Bulk warehouse shipping/logistics labels.
- Template designers, branding engines, or rich customization systems.
- Offline/mobile sync for future kit/custody/temporary label scan resolution.

## Arc 20E Recommended Next Steps
1. Add explicit mobile scan resolution flows for `KIT:` and other future-compatible label payloads.
2. Add batch label generation for audit sessions, event staging, and large cage/vault refreshes.
3. Add lightweight PDF/export bundling for multi-label print packets.
4. Add configurable organization label policies (required location codes, preferred symbology, format defaults).
5. Add scan-result analytics linking printed label usage to audits, custody exceptions, and relabeling needs.
