# GearOps Admin Configuration Guide (Overview)

Use this guide for organization administrators configuring GearOps behavior.

## When to Use This

Use this when setting up categories, templates, defaults, and organization-level controls.

## Admin Work Areas

- **GearOps → Categories**
- **GearOps → Event Templates**
- **GearOps → Admin (Settings)**
- **GearOps → Locations**

## Categories and Templates

Categories define operational behavior (durable/consumable, custody, readiness, maintenance, identifiers, reporting).

Starter templates include:
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

## Category Rule Areas

Configure per-category:
- durable vs consumable behavior
- custody mode
- identifier strategy (serial/asset tag/barcode/manual)
- readiness + maintenance tracking requirements
- return inspection requirement
- consumable low-stock defaults
- event deployment support
- report group/report label
- guardian approval requirement boundary

## Organization Settings

In GearOps admin settings:
- default custody mode
- default report group
- enable guardian approval
- enable consumable tracking
- enable event deployment
- enable readiness tracking
- enable maintenance tracking
- admin notes

## Event Requirement Templates

Use event templates for repeatable requirement rows (name/label/type/quantity/category).

## Location Configuration

Define clear location naming and codes for vault, cage, room, trailer, field, and storage areas so staging/recovery and audits stay consistent.

## Guardian Approval Boundaries

Guardian approval is category-driven and bounded. It is not a universal requirement for all categories.

## Dashboard Interpretation

Admins should monitor:
- readiness concerns
- open/overdue custody
- low-stock consumables
- event requirement gaps/unreturned event gear

Use reports drill-down links to resolve root causes.
