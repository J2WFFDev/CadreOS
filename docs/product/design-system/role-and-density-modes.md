# Role and Density Modes

This document defines the two primary UI modes for CadreOS and the density and layout behaviors associated with each.

---

## Overview

CadreOS supports two coexisting UI modes. These are not separate applications or separate codebases. They are different presentation layers that can coexist within the same screens, with mode context influencing layout density, information visibility, and action presentation.

| Mode | Primary Surface | Density | User Types |
|---|---|---|---|
| Admin / Operator Mode | Desktop Web | High | Admins, operators, program managers, staff |
| Guided / Field Mode | Mobile Web, PWA, Offline App | Low | Coaches, field staff, athletes (future), guardians (future) |

---

## Role Experience Model (Confirmed)

CadreOS uses a **Today-first, role-filtered, module-backed** experience model:

- **Today-first:** users land on what needs attention now.
- **Role-filtered:** actions and context are scoped to role and permission.
- **Module-backed:** TeamOps, GearOps, FieldOps, ResourceOps, EventOps, TaskOps, Reporting, and Admin modules still own workflows and data.
- **User-facing language:** UI should not force users to think in internal module names.

### Role Experience Examples

| Role | Today-first focus |
|---|---|
| Program Admin | Cross-program blockers, approvals, staffing/resource gaps, unresolved conflicts, admin-required exceptions |
| Head Coach | Team readiness, event staffing/attendance gaps, gear readiness blockers, critical athlete updates |
| Assistant Coach | Assigned attendance tasks, athlete follow-up tasks, event setup checklist items, quick readiness checks |
| Parent / Guardian | Athlete-related approvals, required responses, upcoming event obligations, policy acknowledgments |
| Athlete | Personal readiness steps, assigned gear expectations, event participation status, required acknowledgments |
| Volunteer | Assigned check-in/setup tasks, shift readiness, required briefings, completion confirmations |
| Equipment Manager | Checkout/return queues, maintenance intake, custody anomalies, readiness blockers |
| Facility / Range Manager | Facility setup readiness, booking conflicts requiring action, safety checklist and availability issues |

---

## Mode 1: Admin / Operator Mode

### Description

Admin/Operator Mode is the current primary mode of CadreOS. It exposes the full operational state of the system, including raw identifiers, relationship graphs, audit trails, workflow state transitions, and configuration details.

This mode is not deprecated, hidden, or reduced. It is a permanent first-class mode.

### Layout Characteristics

- **Tables:** Primary display pattern for lists and collections
- **Multi-column layouts:** Inspector panels, side drawers, detail columns
- **Dense information hierarchy:** Multiple data points visible simultaneously
- **Raw IDs visible:** Entity IDs, relationship IDs, system-generated identifiers
- **Audit context visible:** Created by, modified by, timestamps, workflow state history
- **Full relationship display:** Linked entities, parent/child chains, reference paths
- **Configuration access:** Settings, schema details, role assignments, system state

### Interaction Patterns

- Click-to-navigate between related entities
- Inline editing where appropriate
- Bulk action support
- Keyboard-accessible filters and search
- Paginated data tables with sort and filter
- Inspector drawers for detail without navigation

### When to Use Admin / Operator Mode

- Setting up programs, seasons, events, roles, teams
- Reviewing audit logs and workflow state
- Resolving operational exceptions and conflicts
- Configuration management
- Reporting and operational review
- Any action requiring full system context

### Visibility Guarantee

> The Admin/Operator Mode must always surface: entity IDs, audit timestamps, actor attribution, workflow state, relationship context, and raw system data. Future guided UI layers must never remove access to this information — only add a simplified view alongside it.

---

## Mode 2: Guided / Field Mode

### Description

Guided/Field Mode is the future simplified presentation layer for role-appropriate, action-oriented workflows. It reduces cognitive load for users performing specific, well-defined tasks in the field or on mobile devices.

This mode is additive. It does not replace Admin/Operator Mode.

### Layout Characteristics

- **Cards:** Primary display pattern for entities and status
- **Single-column layout:** Optimized for mobile screen widths
- **Progressive disclosure:** Show one decision or action at a time
- **Role-aware content:** Only show fields and actions relevant to the current user's role
- **Large touch targets:** Minimum 44×44px, generous spacing
- **Status-first:** Entity status prominently visible before actions
- **Minimal ID exposure:** Human-readable names and labels rather than raw IDs

### Interaction Patterns

- Scan-first entry for asset and athlete workflows
- Step-by-step guided flows for multi-step operations
- Confirmation screens before committing irreversible actions
- Bottom sheets / action sheets for contextual actions on mobile
- Swipe-to-reveal for secondary actions
- Inline feedback rather than navigation-to-confirm

### When to Use Guided / Field Mode

- Field gear checkout and return
- Attendance marking at an event
- Quick status lookups
- Readiness verification in the field
- Guardian approval capture
- Any workflow that needs to run fast with minimal friction

---

## Mode 3: Field / Mobile Mode (Extension of Guided Mode)

For offline-capable scenarios and high-friction field environments, Guided Mode extends into a Field/Mobile Mode with additional affordances:

- **Offline indicators:** OfflineBanner, SyncQueueIndicator, PendingSyncBadge visible at all times when offline
- **Scan-optimized:** Camera scan as the default entry point, keyboard entry as fallback
- **Connectivity-aware:** Actions that require connectivity are disabled with explanation, not silently unavailable
- **Sync queue management:** Pending operations visible and reviewable before and after sync
- **High contrast:** Status indicators use high-contrast colors for outdoor/low-light use

---

## Mode Selection

### How Mode is Determined (Future Implementation)

Mode context will be derived from a combination of:

1. **Device context:** Screen width, touch capability, user agent
2. **Role context:** The user's assigned roles in the organization
3. **User preference:** An explicit mode toggle for users who have both modes available
4. **URL/route context:** Some routes may be mode-specific by design

### Mode Coexistence

Some screens will offer both modes. For example, a GearOps asset detail page might show:
- Admin Mode: full table with ID, all custody events, maintenance log, condition history
- Guided Mode: card with current status, current custodian, one-tap action for checkout/return

Both views operate on the same data. The mode determines presentation, not access.

---

## Layout Density Reference

| Characteristic | Admin / Operator Mode | Guided / Field Mode |
|---|---|---|
| Primary layout pattern | Table | Card |
| Column count | Multi-column | Single-column |
| Information density | High | Low |
| Entity IDs visible | Always | Hidden (accessible via admin) |
| Audit trail visible | Always | Summary only |
| Actions per view | Many | One primary + secondary |
| Touch target size | Standard (24px+) | Large (44px+) |
| Offline indicators | Not required | Required when offline |
| Scan workflows | Secondary | Primary |
| Progressive disclosure | Minimal | Aggressive |
| Configuration access | Full | None |

---

## Relationship to Components

Component patterns in `component-patterns.md` are designed to support both modes:

- `DataTable` is the Admin Mode primary pattern.
- `EntityCard` is the Guided Mode primary pattern.
- `InspectorDrawer` is Admin Mode-specific.
- `MobileActionSheet` is Guided/Field Mode-specific.
- `StatusBadge` is shared across all modes.
- `OfflineBanner` and `SyncQueueIndicator` are Field Mode extensions.
