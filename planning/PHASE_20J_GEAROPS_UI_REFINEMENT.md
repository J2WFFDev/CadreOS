# Phase 20J — GearOps Visual UI Refinement and Operator Experience

## Overview

Arc 20J builds a refined, user-friendly GearOps interface on top of the inventory, custody, location, rapid/mobile, readiness, maintenance, event deployment, reporting, and admin configuration architecture completed in Arc 20A–20I.

The primary goal is a cleaner, more intuitive, visually rich GearOps user experience while preserving access to raw operational details for power users and administrators. No backend model rewrites or design-system overhauls are introduced.

---

## UI Mode Strategy

### Simple Operator View
Optimized for coaches, volunteers, field operators, equipment cage users, and event staff.

- Shows what action needs to be taken — not a wall of fields
- Uses clear labels, status chips, action buttons, and guided flows
- Supports mobile and tablet use
- Minimizes cognitive load for routine check-out/check-in/transfer/stage flows

### Detailed Admin / Power User View
Preserves raw operational depth for administrators and power users.

- Full inventory, custody, readiness, history, event, maintenance, category, and audit context
- Accessible through "Advanced" / detail drill-down sections, not forced on every user
- Supports troubleshooting, review, cleanup, and administrative control

---

## Status Badge / Color / Label Conventions

Status tone is driven by a unified `LifecycleTone` type in `lib/gear-ops-ui.ts`:

| Tone      | Color Meaning              | Use Case                                 |
|-----------|---------------------------|------------------------------------------|
| `success` | Green — healthy/ready      | ACTIVE lifecycle, GOOD condition, READY readiness, RETURNED checkout |
| `info`    | Sky/Blue — in-use/assigned | CHECKED_OUT, ASSIGNED, RESERVED, NEEDS_INSPECTION |
| `warning` | Amber — attention needed   | MAINTENANCE lifecycle, POOR/DAMAGED condition, MAINTENANCE_REQUIRED readiness, OVERDUE checkout |
| `danger`  | Red — critical problem     | RETIRED, LOST, DECOMMISSIONED lifecycle, DECOMMISSIONED readiness |
| `neutral` | Gray — inactive/unknown    | null states, VOIDED, CANCELLED |

### Badge Components (`components/gear-ops/status-badge.tsx`)

- `GearLifecycleBadge` — lifecycle status pill
- `GearConditionBadge` — condition status pill
- `GearReadinessChip` — readiness state chip
- `GearCheckoutBadge` — checkout status pill
- `GearAssignmentBadge` — assignment status pill
- `GearInventoryTypeBadge` — DURABLE / CONSUMABLE pill
- `GearAvailabilityChip` — AVAILABLE / CHECKED_OUT / ASSIGNED / MAINTENANCE chip
- `GearAvailabilityBanner` — prominent banner in item header (prominent colored strip)

---

## Mobile-First Interaction Decisions

- Card-first layout: `GearOperatorCard` and `GearQuickActionCard` use generous padding, large touch targets, and a single primary action button per card
- Bottom action area: scan page uses a full-width submit button and a `py-3 text-base font-semibold` style for thumb-reachable tap targets
- Filter chips are shown at the top of the items list so operators can switch views with a single tap, without scrolling to a sidebar
- Active scan mode is highlighted with a `border-l-4` left accent to provide a clear visual anchor on small screens
- Subnav uses `py-2 px-3` or `px-4` touch targets and is horizontally scrollable on narrow viewports

---

## Rapid Action UX Decisions

- The scan page (`/gear-ops/scan`) acts as the primary rapid-action entry point
- Scan input is rendered `text-lg font-mono border-2` with prominent focus styling
- Active mode card uses a left-border accent (`border-l-4 border-sky-400`) as a quick visual indicator of the current mode
- Mode presets and context chips are consolidated into a single presets panel rather than separate sections, reducing page length on mobile

---

## Event Gear Workflow UI Decisions

- Event gear plan UI (Arc 20H routes) feeds into the same badge and action-bar components for consistency
- `GearEventPlanBoard` and `GearDeploymentChecklist` concepts are supported by the same `GearActionBar` and `GearDashboardCard` patterns
- Status at the event level (staged / deployed / returned) uses the same `LifecycleTone` color system

---

## Dashboard / Reporting UI Decisions

- `GearDashboardCard` uses a `border-l-4` tone-colored left accent and a `{tone}` icon row for visual hierarchy
- `buildDashboardConcernSummary` aggregates `maintenanceItems`, `conditionConcernItems`, `lowAvailabilityConsumables`, and `readinessConcerns` into `criticalCount`, `warningCount`, `readinessConcernCount`, `overallTone`, and `overallLabel`
- Exception panel (`GearExceptionPanel`) sorts by severity: critical first, then warning, then info
- Dashboard drill-down: card links navigate to filtered operational lists

---

## Category / Template UI Decisions

- Category/template admin pages continue to use the existing `CategoryConfigFields` component
- `GearInventoryTypeBadge` visually differentiates DURABLE vs CONSUMABLE items throughout all list and detail views
- Category-aware display behavior is preserved through the existing GearOps admin routes

---

## Preserved Raw Detail Access

Raw detail views are not removed. They are accessible via:

- "Raw details" / "Advanced" collapsible sections on the item detail page
- The existing admin routes (`/gear-ops/admin`, `/gear-ops/items/[itemId]/edit`, etc.)
- The subnav Admin group links

The new operator-friendly surface is layered on top; no existing detail content is deleted.

---

## Deferred Scope

The following items are explicitly out of scope for Arc 20J:

- Full design-system rewrite
- Separate native mobile app
- Full offline sync capability
- Heavy animation framework
- Complex gesture system
- Advanced drag-and-drop workflow engine
- New charting dependency
- Major backend model rewrites
- AI-guided UI flows
- Enterprise warehouse UI patterns

These remain candidate scope for future arcs.

---

## Changed Files

### New Files

| File | Purpose |
|------|---------|
| `lib/gear-ops-ui.ts` | Pure UI helpers: tone derivation, badge classes, labels, availability signal, concern level, dashboard summary |
| `components/gear-ops/status-badge.tsx` | All GearOps badge/chip components |
| `components/gear-ops/action-bar.tsx` | `GearActionBar` — primary action button row |
| `components/gear-ops/dashboard-card.tsx` | `GearDashboardCard` — tone-accented metric card |
| `components/gear-ops/filter-bar.tsx` | `GearFilterBar` — chip-based filter row |
| `components/gear-ops/exception-panel.tsx` | `GearExceptionPanel` — severity-sorted concern list |
| `components/gear-ops/operator-card.tsx` | `GearOperatorCard` — mobile-friendly field card |
| `components/gear-ops/quick-action-card.tsx` | `GearQuickActionCard` / `GearQuickActionGrid` |
| `tests/gear-ops-ui/ui-helpers.test.ts` | 45 tests for `lib/gear-ops-ui.ts` pure functions |
| `planning/PHASE_20J_GEAROPS_UI_REFINEMENT.md` | This document |

### Modified Files

| File | Changes |
|------|---------|
| `components/gear-ops/subnav.tsx` | Grouped navigation (Field / Events / Ops / Admin), filled active tab, aria-current, larger touch targets |
| `app/(dashboard)/gear-ops/page.tsx` | Readiness concern banner, quick-action grid, tone-colored metric cards, exception panel, low-stock list, open checkouts list |
| `app/(dashboard)/gear-ops/items/page.tsx` | New badge components, availability chip, top filter chips with active state, search preserves filters, cleaner custody row |
| `app/(dashboard)/gear-ops/items/[itemId]/page.tsx` | New badge components, `GearAvailabilityBanner` in header, `GearReadinessChip`, improved primary action button |
| `app/(dashboard)/gear-ops/scan/page.tsx` | Larger input, active mode left-border card, bigger submit button, consolidated context chips |

---

## Arc 20K Recommendations

1. **Event gear workflow UI** — Refine the event gear plan board (`/events/[eventId]/gear`) with `GearEventPlanBoard`, `GearDeploymentChecklist`, and `GearRecoveryChecklist` patterns
2. **GearDetailDrawer** — Slide-in drawer for item detail on mobile without a full page navigation
3. **GearHistoryTimeline** — Readable visual timeline for custody, maintenance, and readiness history
4. **GearMobileActionSheet** — Bottom sheet (CSS-only) for primary actions on mobile
5. **Offline/PWA foundation** — Service worker + IndexedDB sync groundwork for field-use offline scenarios
6. **Improved readiness forms** — Streamlined inspection form with camera-friendly image attachment
7. **Consumables dashboard** — Dedicated low-stock alert and reorder workflow UI
8. **Permission-aware nav hiding** — Suppress admin subnav group from operator-only roles
9. **Print/label workflow** — Improved label print flow for newly staged or transferred items
10. **Performance** — Pagination and streaming for large item lists
