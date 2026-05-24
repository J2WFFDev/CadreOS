# Phase 16C — GearOps Catalog Read-Only Views

## Goal

Deliver safe read-only GearOps catalog visibility across dashboard/navigation and dedicated category/item pages, using the Arc 16B schema and existing organization/staff authorization patterns.

---

## Routes Added

- `/gear-ops`
- `/gear-ops/categories`
- `/gear-ops/categories/[categoryId]`
- `/gear-ops/items`
- `/gear-ops/items/[itemId]`

---

## Read-Only Scope Delivered

### GearOps overview (`/gear-ops`)

- Total categories
- Total gear items
- Durable item count
- Consumable item count
- Active/available count
- Assigned or checked-out count
- Maintenance-state count
- Condition concern count (`POOR`/`DAMAGED`)

### Category visibility (`/gear-ops/categories`, `/gear-ops/categories/[categoryId]`)

- Category name
- Description (if available)
- Inventory type
- Active linked item counts
- Linked item list and item detail links

### Gear item visibility (`/gear-ops/items`, `/gear-ops/items/[itemId]`)

- Item name
- Category
- Inventory type
- Lifecycle/status
- Condition
- Program context
- Assignment context (person/team/event)
- Quantity and minimum stock fields for consumables
- Recent and detailed assignment/checkout/maintenance/consumable transaction context

---

## Authorization and Scoping Alignment

- Reuses `getOrganizationScope()` for organization boundary handling.
- Reuses existing role-resolution helpers (`resolveActorRoleContext`, `evaluateStaffOnlyContentAccess`, `resolveStaffScopeResolution`) for staff-gated read access.
- Applies scoped visibility conditions for non-organization-wide staff assignments across program/team/event-linked GearOps data.

---

## Navigation and Entry Points

- Added GearOps to sidebar navigation.
- Added GearOps card to dashboard navigation cards.
- Added GearOps module sub-navigation for overview/categories/items routes.

---

## Explicitly Deferred (Unchanged in 16C)

- No create/edit item/category workflows
- No checkout/check-in write actions
- No maintenance write actions
- No consumable transaction write actions
- No notifications/messaging changes
- No purchasing/finance/depreciation workflows
- No Prisma schema changes

---

## Validation Commands

```bash
npm run lint
npm run typecheck
npm run build
DATABASE_URL="..." ./node_modules/.bin/prisma validate
```

---

## Phase 16C Output Summary

- Added read-only GearOps dashboard, categories, and items pages.
- Added GearOps sub-navigation and shared read-only display/access helpers.
- Added GearOps links in sidebar and dashboard navigation.
- Added Arc 16C planning and validation documentation, and indexed it in `planning/README.md`.
