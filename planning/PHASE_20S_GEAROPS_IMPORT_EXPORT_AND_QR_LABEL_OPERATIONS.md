# Arc 20S — GearOps Import/Export and QR Label Operations

## Status

Implemented as a bounded operational enablement slice.

## Scope delivered

Arc 20S adds practical, organization-scoped workflows for:

- CSV import template download
- CSV import preview and validation
- bounded create-only vs create-or-update commit behavior
- CSV export for inventory, custody, location, readiness, event plan, and audit summary datasets
- printable label-sheet generation for filtered inventory items (category/location/event/item IDs)
- missing-label warnings when permanent identifiers are absent

This remains intentionally bounded and does **not** attempt ETL integrations, procurement/accounting pipelines, warehouse label systems, or scheduled data integrations.

## Import overview

### Template fields

Supported CSV columns:

- `item_name`
- `category`
- `template_key`
- `description`
- `serial_number`
- `asset_tag`
- `qr_identifier`
- `owner_source`
- `location`
- `readiness_status`
- `condition`
- `quantity`
- `low_threshold`
- `notes`
- `active`

Alias headers are accepted for common variants (`name`, `serial`, `readiness`, etc.). Unsupported headers are reported as warnings.

### Required vs optional behavior

Required (per row):

- item name
- category or template key resolving to an organization category
- at least one identifier (`serial_number`, `asset_tag`/`qr_identifier`, or `template_key` fallback)

Optional:

- ownership/source
- location
- readiness/condition
- low threshold
- notes and active flag

### Validation behavior

Preview validates:

- required fields
- category/template resolution within current organization
- duplicate identifiers in file
- existing identifier collision handling by mode
- readiness/condition/ownership enum values
- location references by location name/code in current organization
- consumable quantity and threshold integer format
- unsupported headers

Import errors are surfaced row-by-row with field-level detail.

### Create vs update behavior

Modes:

- `CREATE_ONLY`: existing identifiers fail preview
- `CREATE_OR_UPDATE`: existing identifiers become update actions

Commit reruns preview validation and aborts on any errors.

## Export overview

Available datasets:

- inventory list
- custody summary
- location summary
- readiness summary
- event gear plan summary
- audit session summary

Exports are CSV downloads intended for pilot setup, offline review, audit review, reconciliation, and cleanup workflows.

## QR / label operations

- Existing per-item label previews remain available at `/gear-ops/labels`.
- New label-sheet builder at `/gear-ops/bulk/labels` generates printable sheets by category/location/event/item IDs.
- Sheets include item name, category/location context, printable identifier text, and QR payload.
- Missing permanent identifiers are flagged with reprint guidance.

### Label safety guidance

Labels intentionally avoid personal/guardian/private notes data and only include operationally safe identifiers.

## Organization and permission boundaries

All Arc 20S routes are organization-scoped and enforce:

- GearOps read access for template/export/preview/label-sheet actions
- mutation permission for commit action

All lookups and mutations are constrained to the resolved organization context.

## Known limitations and deferred scope

Still deferred:

- scheduled integrations
- ERP/procurement/accounting exports/imports
- warehouse bin labeling systems
- complex field mapping designers
- automated cleanup/enrichment engines
- native scanner management and RFID flows

## Pilot setup guidance

1. Download template from `/gear-ops/bulk`.
2. Populate basic fields and identifiers.
3. Run preview and resolve all errors.
4. Commit in create-only mode first for initial seed.
5. Use create-or-update mode for bounded correction passes.
6. Export inventory and summaries for pilot verification.
7. Generate/reprint label sheets after final identifier normalization.
