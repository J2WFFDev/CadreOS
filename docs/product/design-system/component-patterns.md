# Component Patterns

This document catalogs the reusable future components for the CadreOS design system. These are design-intent definitions — they describe purpose, props, variants, and usage context, not final visual styling or implementation code.

---

## Catalog

### AppShell

**Purpose:** The outermost application wrapper. Provides navigation chrome, mode context, connectivity state, and layout frame.

**Contains:**
- Sidebar (desktop) or BottomTabBar (mobile)
- OfflineBanner (when offline, if applicable)
- SyncQueueIndicator (when in field mode with pending sync)
- Active user context and role indicator

**Variants:**
- `admin` — full sidebar, high density
- `guided` — compact top bar or bottom tabs, low density
- `field` — bottom tabs, offline indicator always visible

**Notes:** All pages render within AppShell. Mode is passed as context. AppShell does not scroll — content areas inside it do.

---

### PageHeader

**Purpose:** Top-of-page heading area. Displays entity or view name, breadcrumb path (desktop), and primary page-level actions.

**Props:**
- `title` — primary heading
- `breadcrumb` — array of { label, href } items (desktop only)
- `subtitle` — optional secondary description
- `actions` — optional slot for primary action buttons

**Variants:**
- `desktop` — full breadcrumb + title + action buttons
- `mobile` — compact title with back button, no breadcrumb

**Notes:** PageHeader is distinct from ActionBar. PageHeader identifies the view; ActionBar provides operations on the current view's data.

---

### ActionBar

**Purpose:** A toolbar that holds actions applicable to the current view's data. Separate from PageHeader to allow contextual actions to change without re-rendering the page header.

**Props:**
- `primaryAction` — main CTA button
- `secondaryActions` — array of secondary button definitions
- `filterControls` — optional filter/search controls (desktop)
- `selectionActions` — actions visible when rows/items are selected

**Variants:**
- `default` — standard desktop action row
- `mobile` — shows only primary action; secondary actions collapse to MobileActionSheet trigger
- `selection` — bulk action mode when items are selected

---

### StatusBadge

**Purpose:** Displays a single entity status using the canonical vocabulary from `status-language.md`.

**Props:**
- `status` — one of the canonical status values
- `size` — `sm` | `md` | `lg`
- `withIcon` — optional icon prefix

**Status-to-color mapping (illustrative, not final):**
- Ready → Green
- Pending → Amber
- Blocked → Red
- Needs Review → Orange
- Checked Out → Blue
- Returned → Gray
- Overdue → Red (urgent)
- Incomplete → Amber
- Complete → Green
- Archived → Gray (muted)

**Notes:** Never use color alone. Always pair with a text label. Accessible contrast is required for all status color combinations.

---

### EntityCard

**Purpose:** A touch-friendly card representing a single entity (person, asset, event, booking, etc.) with status and primary action.

**Props:**
- `title` — entity name or primary identifier
- `subtitle` — secondary description or type
- `status` — StatusBadge value
- `meta` — array of key-value pairs for secondary info
- `primaryAction` — optional action button or link
- `thumbnail` — optional avatar or asset icon

**Variants:**
- `compact` — minimal info, status badge, name only
- `standard` — name, subtitle, status, 1–2 meta items
- `expanded` — full metadata, action buttons visible

**Usage:** Primary list item pattern in Guided/Field Mode. Used in mobile views where DataTable is not appropriate.

---

### DataTable

**Purpose:** A full-featured table for displaying lists of entities with sorting, filtering, pagination, and optional bulk selection.

**Props:**
- `columns` — column definition array (key, label, sortable, render)
- `rows` — data array
- `pagination` — page size, current page, total count
- `onRowClick` — navigation or drawer open handler
- `selectable` — boolean; enables row checkboxes for bulk actions
- `emptyState` — EmptyState component to show when no rows

**Variants:**
- `standard` — full table with all controls
- `compact` — reduced row height, minimal controls
- `readonly` — no actions, display-only

**Usage:** Primary list pattern in Admin/Operator Mode. Not appropriate for mobile Guided Mode.

---

### InspectorDrawer

**Purpose:** A right-side sliding panel that shows detail for a selected entity without navigating away from the list view. Admin/Operator Mode only.

**Props:**
- `entity` — the entity to inspect
- `title` — drawer heading
- `sections` — array of collapsible section definitions
- `actions` — optional action buttons in drawer footer
- `onClose` — close handler

**Sections (typical):**
- Overview
- Relationships
- Audit Log
- Raw Data (expandable, showing IDs and system fields)

**Notes:** InspectorDrawer is only appropriate on desktop. On mobile, detail views are full-screen navigations.

---

### Timeline

**Purpose:** A chronological event log display for audit trails, custody history, maintenance history, workflow state transitions.

**Props:**
- `events` — array of { timestamp, actor, action, detail } items
- `compact` — boolean; reduces spacing for inline use
- `maxItems` — optional limit with "show more" expansion

**Usage:** Within InspectorDrawer audit sections, entity detail pages, and custody history views.

---

### EmptyState

**Purpose:** A placeholder displayed when a view has no data. Explains what's missing and provides a path to resolution.

**Props:**
- `icon` — optional illustration or icon
- `title` — primary message ("No gear items yet")
- `description` — optional explanation
- `action` — optional CTA button

**Notes:** Every DataTable and card list should supply an EmptyState. An empty view with no guidance is a dead end.

---

### ConfirmDialog

**Purpose:** A blocking dialog requiring explicit user confirmation before committing an irreversible or high-consequence action.

**Props:**
- `title` — action name ("Check Out Asset")
- `description` — consequence summary
- `confirmLabel` — confirm button label
- `cancelLabel` — cancel button label
- `destructive` — boolean; renders confirm button in a warning style

**Usage:** Before checkout, return, delete, archive, transfer, or any action that modifies a custody or audit record.

---

### MobileActionSheet

**Purpose:** A bottom sheet on mobile that presents a list of contextual actions for an entity. Replaces action dropdowns and hover menus on touch surfaces.

**Props:**
- `actions` — array of { label, icon, handler, destructive } items
- `title` — optional sheet heading (entity name or action group)
- `onDismiss` — dismiss handler

**Usage:** Triggered by a "…" or action button in mobile EntityCard views. Replaces context menus.

---

### ScanAction

**Purpose:** A scan-entry component that initiates a camera-based QR or barcode scan and resolves the result to an entity.

**Props:**
- `onScanSuccess` — handler receiving resolved entity ID and type
- `onScanError` — error handler
- `fallbackMode` — `search` | `manual` (shown when scan fails or camera unavailable)
- `label` — instruction text ("Scan gear item barcode")

**Variants:**
- `fullscreen` — full-screen camera view (primary mobile pattern)
- `inline` — embedded camera preview within a form

**Notes:** ScanAction should always provide a manual text entry fallback for environments where camera is unavailable or scan fails repeatedly.

---

### OfflineBanner

**Purpose:** A persistent top-of-screen banner indicating that the device is offline and operations may be queued.

**Props:**
- `pendingCount` — number of pending sync operations
- `onViewQueue` — optional handler linking to sync queue view

**Behavior:**
- Only renders when device is offline
- Automatically dismisses when connectivity is restored
- If `pendingCount > 0`, shows count and link to queue

**Notes:** This is a future component. Do not implement until offline sync arc is active. Design now, implement later.

---

### SyncQueueIndicator

**Purpose:** A persistent indicator (icon badge or inline widget) showing the number of pending sync operations when in an offline or recently-reconnected state.

**Props:**
- `pendingCount` — number of pending operations
- `syncStatus` — `idle` | `syncing` | `error`
- `onOpen` — handler to open queue detail view

**Behavior:**
- Visible in AppShell when pendingCount > 0 or syncStatus is `error`
- Spinner animation during `syncing` state
- Error indicator with retry action on `error` state

---

### PendingSyncBadge

**Purpose:** A small badge on an individual entity card or table row indicating that this specific entity has pending sync operations.

**Props:**
- `count` — number of pending operations for this entity

**Usage:** Attached to EntityCard or DataTable rows in offline mode to show entity-level sync state.

---

### ConflictResolutionPanel

**Purpose:** A UI panel for reviewing and resolving sync conflicts between locally-captured operations and server state.

**Props:**
- `conflict` — conflict record with local version, server version, and conflict type
- `onResolveKeepLocal` — handler
- `onResolveKeepServer` — handler
- `onResolveManual` — handler for manual merge

**Sections:**
- Conflict summary (what conflicted, when)
- Local version detail
- Server version detail
- Resolution action buttons

**Notes:** This is a future component for the offline sync arc. Design now, implement when sync model is active. See `sync-and-conflict-model.md`.

---

## Component Design Constraints

1. All components must support both light and dark mode (future theming).
2. All interactive components must be keyboard accessible.
3. All status-bearing components must use the canonical status vocabulary from `status-language.md`.
4. Mobile-only components (MobileActionSheet, OfflineBanner) must not render on desktop by default.
5. Admin-only components (InspectorDrawer) must not render on mobile by default.
6. New components not listed here must be documented in this catalog before implementation.
