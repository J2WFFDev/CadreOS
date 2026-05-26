
# Phase 20I — GearOps Admin Configuration and Category Templates

## Overview
Arc 20I adds an organization-facing configuration layer on top of the GearOps inventory base from Arc 20A–20H. The phase introduces typed category behavior fields, reusable category starter templates, organization-level GearOps settings, reusable event requirement templates, and limited category-level custom fields.

## Configuration architecture decisions
The category model uses explicit typed columns instead of a dynamic JSON schema. This keeps validation simple, preserves Prisma-level typing, makes reporting/indexing practical, and avoids building a general-purpose rules runtime before the operational requirements are stable.

## Category template model
Starter templates are code-defined defaults in `lib/gear-category-config.ts`. Each template has a stable slug, display metadata, and a default configuration payload that can be applied directly when creating a category or used as a baseline for future UI suggestions.

## Default templates list
- firearm
- magazine-set
- ammunition
- radio
- tablet-electronic
- first-aid-kit
- tool
- uniform-apparel
- sports-equipment
- kit-bundle
- trailer-large-equipment
- generic-asset

## Category capabilities summary
Each category now defines behavior type, custody mode, identifier strategy, maintenance defaults, consumable tracking defaults, report grouping, event deployment support, kit-container support, and guardian approval requirements. These fields are stored directly on `GearCategory` so existing inventory records continue working with deterministic defaults.

## Custody/readiness/maintenance rule boundaries
Arc 20I only configures defaults and visibility labels. It does not implement a full custody policy engine, automatic approval routing, or condition/readiness state enforcement beyond existing workflows; downstream arcs can interpret these fields when richer automation is needed.

## Custom field limitations
Custom fields are intentionally narrow: typed keys with simple select options stored as JSON string arrays. There is no nested schema support, conditional logic, custom validation scripting, or per-field permissions in this phase.

## Event template interaction
`EventGearRequirementTemplate` provides organization-scoped starters for event planning. Templates can optionally point at a gear category, allowing event planners to standardize requirement labels and quantities without changing existing event plan or assignment workflows.

## Reporting/dashboard integration
Report grouping is standardized through `GearReportGroup`, enabling future dashboards and exports to aggregate gear categories consistently. Category-level report labels can override or refine presentation without introducing separate reporting metadata tables.

## Deferred scope
This phase deliberately excludes an enterprise rules engine, a custom form builder, and AI-driven template recommendations. It also avoids migration into arbitrary JSON policy blobs so the admin surface stays explainable and operationally safe.

## Future enhancement path
Arc 20J can build on these typed settings by adding recommendations, richer reporting surfaces, smarter category-driven defaults for new gear items, category-aware event planning shortcuts, and controlled automation around maintenance/readiness prompts.
