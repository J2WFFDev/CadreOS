# Navigation Model

This document defines the navigation structure for CadreOS across platform contexts and UI modes.

---

## Overview

Navigation in CadreOS is domain-organized at the top level, with context-sensitive secondary navigation within domains. Navigation patterns vary by platform and UI mode.

---

## Top-Level Navigation Domains

These domains are stable across all modes and platforms, though their presentation varies.

| Domain | Purpose | Current Status |
|---|---|---|
| Dashboard / Home | Overview, quick actions, today view | Planned (Arc 19B) |
| Events | Event management, attendance, scheduling | Active |
| People / Roster | Athletes, staff, guardians, roles | Active |
| Teams | Team composition, context, readiness | Active |
| Notes | Observations, follow-up, operational capture | Active |
| Tasks | Follow-up actions, assignments, resolution | Active |
| GearOps | Gear catalog, custody, maintenance, readiness | Active |
| FieldOps | Resource booking, facility management | Active |
| Reporting | Operational summaries, exports | Active (Arc 18) |
| Settings | Organization, configuration, roles | Active |

---

## Navigation Patterns by Platform

### Desktop Web — Admin/Operator Mode

**Pattern:** Persistent sidebar navigation

```
[Sidebar]
  Dashboard
  Events
  People
    └── Roster
    └── Teams
  Notes
  Tasks
  GearOps
    └── Catalog
    └── Assignments
    └── Maintenance
  FieldOps
    └── Resources
    └── Bookings
  Reporting
  Settings

[Main Content Area]
  [PageHeader]
  [ActionBar]
  [DataTable | InspectorDrawer | Detail Panel]
```

**Behavior:**
- Sidebar is always visible on desktop
- Active domain is highlighted
- Sub-navigation expands inline within the sidebar
- Breadcrumb in PageHeader for deep navigation state
- InspectorDrawer slides in from the right without navigating away

---

### Mobile Web — Guided Mode

**Pattern:** Bottom tab navigation (primary) + stack navigation (secondary)

```
[Content Area]
  [PageHeader — compact]
  [Card list | Action flow | Scan view]

[Bottom Tab Bar]
  Home | Events | GearOps | People | More
```

**Behavior:**
- Bottom tab bar for top-level navigation (5 items max)
- Secondary navigation uses back-stack push (full-screen transitions)
- "More" tab expands to a menu sheet for less-frequent destinations
- No sidebar on mobile
- MobileActionSheet for contextual actions
- No InspectorDrawer on mobile (separate detail screen instead)

**Tab bar items (proposed):**
1. Home (today view, quick actions)
2. Events (upcoming events, attendance)
3. GearOps (quick checkout, scan)
4. People (quick lookup, roster)
5. More (Notes, Tasks, Reporting, Settings)

---

### PWA

**Pattern:** Same as Mobile Web with addition of:
- Install prompt handling
- Notification permission prompt (future)
- Offline status indicator in AppShell
- Service worker status in shell navigation

---

### Offline Mobile App (Future)

**Pattern:** Similar to Mobile Web, with additional:

```
[AppShell]
  [OfflineBanner — always visible when offline]
  [SyncQueueIndicator — visible when items pending]

[Content Area]
  [Scan-first entry points]
  [Pending sync items visible]

[Bottom Tab Bar]
  Home | Scan | GearOps | Attendance | Sync
```

**Behavior:**
- Scan is elevated to a primary tab
- Sync tab/indicator shows pending operations
- All write actions confirm whether they are queuing for sync
- Conflict resolution accessible from sync queue view

---

## Navigation Depth Guidelines

| Level | Desktop | Mobile |
|---|---|---|
| Level 1 | Sidebar top-level item | Bottom tab |
| Level 2 | Sidebar sub-item or PageHeader tab | Push to new screen |
| Level 3 | DataTable row → InspectorDrawer | Push to detail screen |
| Level 4 | InspectorDrawer linked entity | Push to nested detail screen |
| Level 5+ | Avoid — link to separate admin view | Avoid — surface critical info at L3 |

---

## Context-Sensitive Navigation

Within a domain, secondary navigation adapts to the current entity context:

**Example: GearOps Asset Detail**

Desktop Admin Mode:
```
/gear-ops/assets/[assetId]
  [Tabs: Overview | Custody History | Maintenance | Assignments | Audit Log]
```

Mobile Guided Mode:
```
/gear-ops/assets/[assetId]  (single scroll view)
  [Status Card]
  [Current Custodian]
  [Primary Action Button: Check Out / Return]
  [Recent Events — collapsed, expandable]
```

The same route can render differently based on mode context.

---

## Breadcrumbs and Wayfinding

**Desktop:** Breadcrumb trail in PageHeader for all routes deeper than L1:
```
GearOps > Assets > Helmet #007 > Maintenance Log
```

**Mobile:** Back button with parent screen name. No full breadcrumb trail.

---

## Deep Linking

All primary entity views should be deep-linkable by ID. This supports:
- Audit link sharing among staff
- Admin review of a specific record
- Future notification-triggered navigation

Format: `/[domain]/[entityType]/[entityId]`

Example: `/gear-ops/assets/clxyz123`

---

## Navigation Anti-Patterns to Avoid

- Do not use modal dialogs as the primary navigation pattern for detail views on mobile.
- Do not require more than 3 taps to complete a primary field action.
- Do not hide critical navigation paths behind settings menus.
- Do not use the same layout for admin and field contexts without mode-aware adaptation.
- Do not break back-stack navigation on mobile.
