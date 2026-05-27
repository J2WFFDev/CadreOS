# GearOps Administrator Configuration Deep Guide (Arc 20P)

Use this guide when you are responsible for configuring GearOps for an organization.

This guide is based on the release-candidate GearOps module and Arc 20O user/operator documentation.

---

## 1) GearOps Admin Overview

### What administrators control

Administrators configure:
- **GearOps → Categories** (behavior, custody mode, identifier strategy, maintenance/readiness flags, consumable defaults, event support, reporting grouping, guardian boundary flags)
- **GearOps → Categories → [Category]** custom fields
- **GearOps → Event Templates** (organization requirement templates)
- **GearOps → Admin (Settings)** organization-level GearOps settings
- **GearOps → Locations** and **GearOps → Kits** structure

### What operators control

Operators and staff run day-to-day workflows:
- item creation and updates
- check-out/check-in
- assignment/transfer
- maintenance logs
- consumable adjustments
- event plan requirements and event assignment/staging/recovery
- scan-first workflow execution

### Global vs category/template configuration

- **Global (organization settings):** default custody mode, default report group, GearOps capability toggles, admin notes.
- **Category-level:** behavior type, custody mode, identifier type, maintenance flags, consumable flags, event deployment support, guardian-required flag, report grouping/label.
- **Template-level:** starter defaults for new categories and reusable event requirement template rows.

### What should not be configured casually

Treat these as high-impact changes:
- category **custody mode**
- category **primary identifier type**
- category **guardian approval required**
- category **supports consumable tracking**
- category **report group/report label**
- organization default settings in **GearOps → Admin**

Make these changes during controlled windows and verify reports, scans, and active workflows immediately after.

---

## 2) Organization-Level GearOps Settings

Screen: **GearOps → Admin**

### Current settings

- Default custody mode
- Default report group
- Enable guardian approval
- Enable consumable tracking
- Enable event deployment
- Enable readiness tracking
- Enable maintenance tracking
- Admin notes

### Scope and permissions

- Settings are organization-scoped.
- Access requires **organization admin** for this settings page.
- Other GearOps catalog screens are staff-scoped.

### Operational boundary (important)

Current RC behavior stores these organization settings and exposes them in admin UI, but these toggles are not a full global rules engine. Keep category-level configuration as the primary enforcement surface.

### Safe change guidance

1. Record intent in Admin notes.
2. Update one setting group at a time.
3. Validate with one category and one item workflow before broad rollout.
4. Recheck **GearOps → Reports** for unexpected shifts.

---

## 3) Gear Categories

Screen: **GearOps → Categories** and **GearOps → Categories → New**

### Create and edit

You can create categories from:
- starter templates, or
- manual configuration.

Category names are unique per organization.

### Naming guidance

Use stable, operational names:
- Good: `Duty Radio`, `Athlete Uniform`, `First Aid Kit`, `Training Ammunition`
- Avoid: temporary campaign names, abbreviations only, vendor-specific names unless operationally required

### Category behavior mapping

Use behavior type + inventory type to model:
- durable gear
- consumable gear
- kit/bundle container behavior
- assigned vs shared patterns
- event-supporting categories
- generic assets

### Lifecycle considerations

Before editing a category with active items:
- check linked item count and active custody
- check open event usage
- check consumable thresholds and report grouping impacts

If many active items are in use, prefer creating a new category and migrating new intake first.

---

## 4) Gear Category Templates

Screen: **GearOps → Categories → New → Start from template**

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

### When to use templates

Use templates to reduce setup drift and start from known defaults for custody, identifier, maintenance, event support, and reporting group.

### How to modify templates safely

Treat template output as a starting baseline:
1. create from template
2. review custody + identifier + maintenance fields
3. confirm guardian boundary and report grouping
4. save
5. test with one item and one scan workflow

### Category examples

- **Firearm:** assigned, serialized, guardian boundary enabled by default.
- **Magazine set:** kit-like grouped durable set.
- **Ammunition:** consumable with low-stock default.
- **Radio / tablet:** durable assigned/shared field gear with maintenance tracking.
- **First aid / tool / sports equipment:** shared or assigned durable gear depending operating model.
- **Kit bundle:** category flagged as kit container for grouped assets.
- **Trailer/large equipment:** stricter custody mode + return inspection by default.
- **Generic asset:** neutral baseline.

---

## 5) Category Fields

Screens:
- category core config in **New/Edit Category**
- custom fields in **Category detail → Custom fields**

### Standard and optional config fields

Core category fields include:
- behavior type
- custody mode
- primary identifier type
- report group/report label
- return inspection flag
- maintenance tracking + optional cadence and interval
- consumable tracking + low-stock default
- event deployment support flag
- kit container flag
- guardian approval required flag

### Category custom fields

Custom fields support:
- field key
- label
- type (`text`, `number`, `date`, `boolean`, `select`)
- optional select options
- required flag
- display order

### Validation expectations

- field key: alphanumeric, underscore, dash; unique per category
- display order: 0–99
- select fields require options
- maintenance interval days: 1–3650
- low-stock default: 0–999999

### Custom-field boundary

Custom fields are per-category metadata extensions, not a full custom schema designer.

---

## 6) Identifier Configuration

Category setting: **Primary identifier type**

Supported category identifier types:
- QR code
- barcode
- serial number
- asset tag
- manual lookup

Operational scan resolution currently matches item/location through normalized scan input and prefixed tokens.

### Scan-first workflow guidance

Use **GearOps → Scan** for operational speed. Keep consistent label encoding and category identifier strategy.

### Fallback lookup behavior

If strict match is not found, workflows still support manual lookup/search by known item identifiers (name, barcode/QR value, serial, SKU) in item and scan flows.

### Uniqueness and safety

- serial uniqueness is organization-scoped in data model
- category primary identifier should match real-world labeling practice
- do not mix identifier conventions in one category without migration plan

### Identifier troubleshooting

If scan fails:
1. confirm label text/prefix accuracy
2. verify item identifier value exists on the item record
3. verify organization scope
4. use manual lookup fallback and correct source label data

---

## 7) Custody and Assignment Rules

Screens:
- item check-out/check-in
- item assignment
- scan custody contexts

### Current custody model surfaces

- check-out and check-in workflows
- assignment workflows (person/team/event, one assignment context at a time)
- transfer achieved by closing prior custody then creating next custody

### Person/athlete/team/event references

Assignments can reference person, team, or event context. Cross-module references are organization-scoped and read-only from GearOps.

### Guardian boundaries

Category-level `guardianApprovalRequired` and cross-module guardian relationship context are present. Full guardian approval workflow automation and complete approval audit UX remain bounded/deferred.

### Block vs warn guidance

Use stricter custody modes and category flags for restricted categories, but confirm actual runtime enforcement in your operational workflows before policy rollout.

### Audit/history implications

Custody operations feed history and reporting; incomplete check-in/return behavior directly inflates exception counts.

---

## 8) Readiness, Condition, Maintenance, and Inspection Rules

Primary states include:
- readiness: Ready, Needs inspection, Maintenance required, Not ready, Decommissioned
- condition: New, Good, Fair, Poor, Damaged, Retired

### Maintenance and inspection configuration

Use category settings to control:
- requires maintenance tracking
- maintenance frequency default
- maintenance interval default
- return inspection requirement

### Availability impact

Out-of-service and maintenance concern logic is report-visible and affects event readiness interpretation.

### History impact

Maintenance logs and related status transitions should be captured at intake and completion to keep audit trails accurate.

---

## 9) Consumable Rules

Use consumable categories/items for stock-driven inventory.

### Configuration points

- category supports consumable tracking
- category/item low-threshold behavior
- consumable transaction history (received/used/distributed/disposed/adjusted)
- event-linked consumable transactions

### Warning/report behavior

Low-threshold items appear as consumable concerns and exception contributors in reporting.

### Current boundary

GearOps tracks operational quantities and adjustments; it is not a procurement/accounting system.

---

## 10) Kit and Bundle Configuration

There are two related concepts:
- **Category-level kit container flag** (`isKitContainer`)
- **Inventory kits** (`GearOps → Kits`) for grouped loadouts

### When to use which

- Use category kit flag when category semantics are container-like.
- Use inventory kits when you need reusable grouped item membership and quantity tracking.

### Kit type selection guidance

When creating an inventory kit, **Kit type** is primarily a descriptive classification for how staff think about, store, and use the grouped gear. In the current GearOps implementation, these types do **not** create different operational workflows by themselves; they help teams apply consistent naming and find the right grouped gear faster.

| Kit type | Meaning | Choose this when |
|---|---|---|
| `Kit` | General-purpose grouped gear. | No more specific label fits. This is the default and safest choice. |
| `Bundle` | Another grouped collection label; functionally the same as `Kit`. | Your team naturally uses “bundle” instead of “kit.” |
| `Case` | Gear organized in a protective or rigid case. | The container format matters operationally, such as firearm cases or hard cases. |
| `Bag` | Gear organized in a carry bag or soft container. | Staff think of it as a bag, such as a medical response bag or athlete gear bag. |
| `Set` | A matched grouping of pieces that belong together. | The emphasis is on a complete set, such as pad sets or magazine sets. |
| `Loadout` | Gear prepared for a role, person, mission, or event context. | The grouping represents what someone should take or deploy together. |
| `Equipment Package` | A broader packaged grouping of gear. | You want a higher-level packaged collection, such as an event support package. |

### Practical default

If staff are unsure which type to choose:
- use **Kit** as the default
- use **Case** or **Bag** when the storage form matters
- use **Set** when the grouped pieces are intended to stay matched
- use **Loadout** when the group is assembled for a specific person, role, mission, or event

### Parent/child and history implications

Kit membership is tracked through kit item entries; each item still keeps its own custody, maintenance, and lifecycle history.

### Example sets

Applicable patterns:
- magazine sets
- first-aid kits
- radio kits
- tool kits
- sports equipment sets

### Event impact

Event assignment/staging/recovery still executes at item level.

---

## 11) Location Configuration

Screen: **GearOps → Locations**

### Supported setup today

Current UI supports name, optional location code, optional description, and hierarchical parent support.

Use naming/coding conventions for:
- vaults
- equipment cages
- lockers
- trailers
- fields
- bays
- rooms
- storage areas
- event staging/recovery locations

### Guidance

- keep codes short and scan-friendly
- avoid duplicate/near-duplicate names
- establish one canonical naming convention per site

### History implications

Location configuration quality directly impacts staging/recovery clarity, audits, and report grouping by location.

### Common mistakes

- creating ad-hoc duplicate names (`Main Vault`, `Main vault`, `Vault Main`)
- missing location codes for scan-heavy workflows
- using inactive locations without review

---

## 12) Event Gear Requirement Templates

Screen: **GearOps → Event Templates**

### What templates currently provide

Each template stores one reusable requirement definition with:
- template name
- requirement label
- optional category scope
- requirement type (required/optional/support)
- quantity needed
- active/inactive status
- optional description/notes

### Current boundary

Templates are reusable stored definitions, but there is no full one-click event plan auto-population workflow yet. Event requirements are still added directly in event gear planning workflows.

### Staging/deployment/recovery impact

Staging/deployment/recovery are executed from event plan assignments, not from template objects directly.

---

## 13) Reporting and Dashboard Configuration

Screens:
- **GearOps** overview
- **GearOps → Reports**

### Key grouping surfaces

Reporting groups and category configuration influence:
- readiness summary
- custody summary
- location summary
- event gap/unreturned summary
- maintenance concerns
- consumable concerns
- exception list

### Filter model

Reports can be filtered by category, location, event, lifecycle status, ownership, assignee, and readiness.

### Avoid misleading configuration

- keep categories aligned to real operational use
- avoid over-broad generic categories
- keep report labels stable
- do not change critical category behavior in the middle of high-volume event windows without a validation check

---

## 14) Mobile and Offline Configuration Boundaries

Statuses shown in pending workflows include:
- Drafted locally
- Pending sync
- Sync failed
- Needs review
- Completed
- Online required

### Offline-safe vs online-required

- Some maintenance/verification and scan drafts are offline-safe or draftable.
- Custody-sensitive actions are offline-limited and require review/confirmation.
- Event plan changes, event requirement changes, and event assignment creation are online-required.

### Admin policy guidance

Do not treat local pending custody/event actions as final. Final truth is server-confirmed history.

### Why full offline sync is deferred

Full replication/conflict automation is intentionally deferred to avoid unsafe custody/readiness divergence in RC scope.

---

## 15) Cross-Module Integration Configuration Boundaries

GearOps references adjacent modules for:
- people/athletes
- guardians
- teams/programs
- events
- tasks/notes/activity links

### Ownership boundaries

GearOps does **not** own source-of-truth person/team/event/task/note models. It consumes references and degrades gracefully when adjacent data is unavailable.

### Fallback behavior

When adjacent module data is missing/incomplete, GearOps can continue core workflows with reduced context and availability messaging.

---

## 16) Admin Troubleshooting

### Category does not appear

- verify staff scope visibility
- verify organization context
- verify category has visible items if scoped staff access is restrictive

### Template defaults are wrong

- confirm starter template used
- edit category immediately after creation
- document local override in admin notes

### Scan identifier does not resolve

- validate identifier text/prefix and item data field
- verify location code/item identifier exists
- use manual lookup and correct label/data drift

### Item cannot be checked out

- check lifecycle/readiness out-of-service status
- check conflicting open checkout/assignment
- verify role permission scope

### Guardian approval blocks or warns unexpectedly

- verify category `guardianApprovalRequired`
- verify guardian relationships exist for athlete references
- confirm current deployment boundaries (full guardian approval workflow UX remains bounded/deferred)

### Readiness blocks event deployment

- inspect readiness + lifecycle + condition states
- resolve maintenance and status before assignment/deployment

### Consumable count looks wrong

- inspect transaction history (used/distributed/disposed/received/adjusted)
- verify pending/offline actions are server-confirmed

### Dashboard/report grouping looks wrong

- check report group/report label per category
- re-run with clear filters first

### Event template does not assign as expected

- templates define reusable requirement rows only
- event item assignment/staging still occurs in event gear plan workflows

### Permission/access issue

- admin settings require organization admin
- other GearOps views/workflows are staff-scoped and scope-dependent

---

## 17) Known Limits and Deferred Scope

Current RC explicitly does **not** include:
- full custom schema designer
- enterprise rules engine
- workflow automation engine for configuration policy orchestration
- procurement/accounting system
- predictive maintenance
- AI recommendations
- full native mobile app
- full offline sync engine
- enterprise warehouse management

Additional bounded areas:
- guardian approval UX/audit completion is partial
- organization-level GearOps setting toggles are stored/admin-facing but not a complete global policy engine
- event requirement templates are reusable definitions, not full automatic event plan generation

---

## Safe Configuration Change Checklist

Use this checklist before and after any high-impact admin change:

1. Confirm the target scope (organization vs category).
2. Confirm active item count and open custody/event usage.
3. Apply the minimal required change.
4. Validate one scan workflow, one custody workflow, one report view.
5. Confirm no unexpected exceptions/regressions.
6. Record rationale in Admin notes.

---

## Related GearOps Documentation

- [GearOps User Guide](./README.md)
- [Admin Configuration Overview](./admin-configuration-overview.md)
- [Readiness and Maintenance Guide](./readiness-maintenance-guide.md)
- [Reporting and Dashboard Guide](./reporting-dashboard-guide.md)
- [Mobile and Offline Behavior Guide](./mobile-offline-guide.md)
- [Troubleshooting Guide](./troubleshooting.md)
- [Known Limitations and Deferred Scope](./known-limitations-and-deferred-scope.md)
