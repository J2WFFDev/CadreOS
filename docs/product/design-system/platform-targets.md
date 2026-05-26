# Platform Targets

This document defines the target platforms for CadreOS, their intended use cases, capabilities, and planned deployment phases.

---

## Overview

CadreOS is currently deployed as a desktop web application. Future platform expansion will proceed incrementally, with each layer building on the foundation of the previous one.

```
Desktop Web (current)
  └── Mobile Web (responsive layer, near-term)
        └── PWA (installable bridge, optional)
              └── Offline Mobile App (future arc, deferred)
```

---

## Platform Definitions

### 1. Desktop Web

**Status:** Current — active and primary

**Primary users:** Administrators, operators, program managers, coaches, staff

**Primary use cases:**
- System configuration and setup
- Program, season, and event management
- Roster and guardian management
- Reporting and operational review
- GearOps catalog management, assignment, and audit
- FieldOps resource booking and facility setup
- Deep operational review with full audit trail visibility
- Notes, follow-up tasks, and workflow management

**UI mode:** Admin/Operator Mode (primary), Guided Mode (future optional layer)

**Density:** High — tables, multi-column layouts, inspector drawers, detail panels

**Connectivity:** Online required

**Notes:** Admin/operator visibility (raw IDs, audit logs, relationship tables, system state) is preserved and valued on this platform. This is the primary operational surface for CadreOS.

---

### 2. Mobile Web

**Status:** Planned — near-term responsive design target

**Primary users:** Coaches, field staff, athletes (future), guardians (future)

**Primary use cases:**
- Event check-in and attendance marking
- Quick lookups (athlete, gear item, assignment)
- GearOps gear checkout and return in the field
- Quick action capture (notes, observations)
- Readiness verification
- Guardian approval capture
- Status checks

**UI mode:** Guided/Field Mode (primary)

**Density:** Low — large touch targets, cards, single-column layout, minimal friction

**Connectivity:** Online required (offline capability deferred)

**Technical approach:** Responsive CSS, mobile-first breakpoints, touch-optimized interaction targets

**Notes:** Mobile web is achieved through responsive design on the existing Next.js app. No separate codebase required.

---

### 3. PWA (Progressive Web App)

**Status:** Optional bridge — low-cost extension of mobile web

**Primary users:** Field staff, coaches who want an installable experience

**Primary use cases:**
- Same as mobile web, with installable home screen icon
- Push notification support (future)
- Basic caching for recently viewed data (not full offline)

**UI mode:** Guided/Field Mode

**Density:** Low

**Connectivity:** Online required (light caching only; not full offline)

**Technical approach:** `manifest.json`, service worker for shell caching, Next.js PWA plugin (when appropriate)

**Notes:** PWA does not deliver true offline capability for write operations. It provides a better mobile UX wrapper. Full offline sync requires the Offline Mobile App platform.

---

### 4. Offline-Capable Mobile App

**Status:** Future arc — deferred

**Primary users:** Field staff, coaches in environments with limited or no connectivity

**Primary use cases (Field Capture boundary):**
- Attendance capture in no-connectivity environments
- GearOps gear checkout, return, and custody transfer offline
- Readiness verification offline
- Event setup checklist offline
- Maintenance intake offline
- Volunteer check-in and notes/observations capture offline
- Sync queue with conflict review on reconnect

**UI mode:** Field/Mobile Mode (scan-optimized, offline-aware)

**Density:** Minimal — large targets, high-contrast status indicators, offline banners, sync queue indicators

**Connectivity:** Offline-capable for field capture workflows with sync on reconnect; not full offline admin mode

**Technical approach (future options):**
- React Native with shared business logic from web
- Capacitor wrapping the existing Next.js app with offline service worker
- A dedicated lightweight React Native or Expo app sharing API contracts

**Decision deferred:** Technology choice for the offline mobile app is not finalized. The choice depends on the maturity of the sync model and the extent of offline workflows required at that time.

**Notes:** This platform requires the append-only operational event capture model to function safely. Conflict resolution infrastructure must exist before this platform is viable. See `sync-and-conflict-model.md`.

---

## Platform Capability Matrix

| Capability | Desktop Web | Mobile Web | PWA | Offline App |
|---|---|---|---|---|
| Admin/Operator Mode | ✅ Primary | ⚠️ Limited | ⚠️ Limited | ❌ Not planned |
| Guided/Field Mode | ⚠️ Optional | ✅ Primary | ✅ Primary | ✅ Primary |
| Full table views | ✅ | ❌ | ❌ | ❌ |
| Touch-optimized layout | ❌ | ✅ | ✅ | ✅ |
| Scan workflows | ⚠️ Camera-dependent | ✅ | ✅ | ✅ |
| Push notifications | ❌ | ❌ | ⚠️ Future | ✅ Future |
| Offline write capture | ❌ | ❌ | ❌ | ✅ Future |
| Offline read cache | ❌ | ❌ | ⚠️ Shell only | ✅ Future |
| Sync queue UI | N/A | N/A | N/A | ✅ Future |
| Full audit visibility | ✅ | ⚠️ Read-only | ⚠️ Read-only | ❌ |
| Reporting | ✅ | ⚠️ Summary only | ⚠️ Summary only | ❌ |

---

## Deployment Phase Alignment

| Platform | Earliest Relevant Arc |
|---|---|
| Desktop Web | Current (Phases 1–20+) |
| Mobile Web | Arc 21+ (responsive design layer) |
| PWA | Arc 21+ (alongside mobile web) |
| Offline-Capable Mobile App | Future arc (post-sync model implementation) |

---

## Design Constraint

Platform expansion must not degrade the Admin/Operator Mode on desktop web. Every responsive change that simplifies the mobile layout must be implemented as an additive layer (e.g., CSS breakpoints, mode context) rather than a replacement of existing desktop functionality.
