# GearOps UI Pilot

This document defines GearOps as the first module to be piloted under the CadreOS future design system. It describes the gear checkout workflow in three interface models: desktop admin, mobile web guided, and offline mobile conceptual.

---

## Why GearOps as the Design Pilot

GearOps is the richest intersection of CadreOS platform concerns:

- **Asset identity:** Scan/search and durable item identity handling.
- **Ownership:** Organization, program, and assignment ownership context.
- **Custody:** Checkout, return, and transfer chains with actor attribution.
- **Location:** Physical location and movement context.
- **Purpose:** Event/practice/general-use intent at checkout time.
- **Readiness:** Condition and readiness gating before checkout.
- **Maintenance:** Intake/reporting and readiness impact.
- **Permission validation:** Role/policy checks before custody operations.
- **Guardian-related constraints:** Policy/approval dependencies where required.
- **Scan-assisted workflows:** Scan-first field operations with fallback search.
- **Offline field capture:** Capture-safe operations while disconnected.
- **Sync queue:** Deferred submission and conflict handling expectations.
- **Audit history:** High-fidelity operational traceability.
- **Admin/raw detail:** Full operator visibility remains available.
- **Guided/mobile flow:** Simplified, high-speed field execution UX.

By piloting the design system on GearOps, we validate the most complex combination of patterns before applying them to simpler modules.

---

## Pilot Workflow

The workflow piloted across all three interface models is:

> **Scan or select asset → identify athlete/event/purpose → validate readiness and permissions → check out asset → record custody event → show confirmation → queue sync if offline**

This workflow is the gear checkout flow. It covers the full arc of a field operation from identification through confirmation and sync.

---

## Interface Model 1: Desktop Admin Layout

### Target Platform

Desktop web, Admin/Operator Mode.

### Layout Structure

```
[AppShell — Sidebar visible]
  [PageHeader]
    Breadcrumb: GearOps > Assets > Helmet #007
    Title: Helmet #007 — Check Out
    
  [ActionBar]
    Actions: [Edit] [View Maintenance Log] [View Custody History]
    
  [Main Content — two-column]
    [Left column — asset detail]
      DataTable row or card:
        - Asset ID: clxyz123
        - Category: Helmet
        - Serial: HLM-007
        - Status: Ready (StatusBadge)
        - Current Custodian: None
        - Last Inspection: 2025-05-10
        - Condition: Good
        
    [Right column — checkout form]
      Custodian Search:
        [Search field: "Athlete or staff name"]
        [Result list: EntityCard per match]
      
      Event Context (optional):
        [Dropdown: Select associated event]
      
      Purpose:
        [Text field: Optional purpose note]
      
      Expected Return:
        [Date picker]
      
      [ConfirmDialog trigger: "Check Out Asset"]
        → ConfirmDialog:
           "Check out Helmet #007 to [Athlete Name]?"
           [Confirm] [Cancel]
           
  [InspectorDrawer — right side, triggered by row click]
    Sections:
      - Overview (status, IDs, category, condition)
      - Custody History (Timeline)
      - Maintenance Log (Timeline)
      - Audit Log (raw event log with actor, timestamp, action)
```

### Admin Mode Visibility

- Full asset ID visible
- Custody record ID visible after checkout
- Actor attribution (who performed checkout) recorded and visible
- Audit log entry created and immediately accessible
- Condition state and inspection history visible
- Link to raw database-level details available for staff

### State After Checkout

```
Status: Checked Out (StatusBadge — Blue)
Current Custodian: [Athlete Name]
Custody ID: clcust456 (visible, copyable)
Checked Out By: [Staff Name] at [timestamp]
Sync Status: Synced (no offline indicator needed on desktop)
```

---

## Interface Model 2: Mobile Web Guided Layout

### Target Platform

Mobile web, Guided/Field Mode. Responsive layout, touch-optimized.

### Layout Structure

```
[AppShell — Bottom Tab Bar]
  [OfflineBanner — only if offline]
  
[Screen 1 — Entry]
  [PageHeader — compact]
    Title: Check Out Gear
    
  [ScanAction — fullscreen camera view]
    "Scan gear barcode or QR code"
    [Fallback: Search by name or ID]
    
[Screen 2 — Asset Confirmed]
  [PageHeader]
    Back | Asset Identified
    
  [EntityCard]
    Title: Helmet #007
    Subtitle: Helmet — Good Condition
    Status: Ready (StatusBadge — Green)
    Meta: Last inspected May 10 · No active custody
    
  [Action: "Check Out This Item"]
  
[Screen 3 — Identify Recipient]
  [PageHeader]
    Back | Select Athlete
    
  [Search field: "Search athlete name"]
  [EntityCard list — filtered results]
    Each card: Name, Team, StatusBadge (roster status)
    
  [Action: "Select [Athlete Name]"]
  
[Screen 4 — Confirm & Complete]
  [PageHeader]
    Back | Confirm Checkout
    
  [Summary Card]
    Item: Helmet #007
    To: [Athlete Name]
    Event: [Event Name or "General use"]
    
  [ConfirmDialog — inline on mobile]
    "Check out Helmet #007 to [Athlete Name]?"
    [Confirm Checkout] (large touch target)
    [Cancel]
    
[Screen 5 — Confirmation]
  [Success state]
    Icon: ✓
    "Helmet #007 checked out to [Athlete Name]"
    
  [PendingSyncBadge — only if offline]
    "Saved locally. Will sync when connected."
    
  [Actions]
    [Check Out Another] [Done]
```

### Guided Mode Visibility

- Raw IDs not shown inline (accessible via "View full details" link to admin view)
- Condition history not shown (StatusBadge shows current state only)
- Audit log not shown (available to admin via separate view)
- Status leads with plain-language labels: "Ready to check out", "Already checked out"
- Error states use plain language: "This item is currently out. See admin for custody details."

### State After Checkout

```
[EntityCard — updated]
Status: Checked Out (StatusBadge — Blue)
Meta: Checked out to [Athlete Name] · Just now

[If offline:]
PendingSyncBadge: "Pending sync"
OfflineBanner: "You're offline. This checkout will sync when connected."
```

---

## Interface Model 3: Offline Mobile App Conceptual Layout

### Target Platform

Future offline-capable mobile app (React Native, Capacitor, or similar). This is a conceptual model — not an implementation spec. It describes the interaction intent for when the offline mobile arc is designed.

### Key Differences from Mobile Web Guided

- Scan is the primary home tab, not a sub-flow within GearOps
- Sync queue is a first-class view
- OfflineBanner and SyncQueueIndicator are always visible when offline
- All actions explicitly confirm whether they are queuing for sync
- Checkout confirmation shows offline status prominently

### Conceptual Layout Structure

```
[AppShell]
  [OfflineBanner — persistent when offline]
    "Offline · 3 items pending sync"
    [View Queue]
    
  [SyncQueueIndicator in tab bar]
    Sync tab shows badge count

[Home / Scan Tab]
  [Large scan button — primary CTA]
    "Scan Gear"
    
  [Quick actions]
    Check Out | Return | Verify Readiness
    
  [Pending sync items — inline list]
    [PendingSyncBadge per item]
    "Helmet #007 — checkout pending sync"
    
[Scan Flow — same as Mobile Web steps 1–5, with additions:]

  [Screen 4 — Confirm]
    [Summary Card]
    
    [Offline notice — inline]
      "You're offline. This checkout will be saved and synced when connected."
      
    [Confirm Checkout — large button]
    
  [Screen 5 — Confirmation (Offline)]
    Icon: 📋 (queued, not ✓)
    "Checkout saved. Will sync when you're back online."
    
    [PendingSyncBadge visible on item]
    
[Sync Tab]
  [SyncQueueIndicator — current status]
  
  [Pending operations list]
    Each row: Event type · Entity · Captured at · Status
    
  [Sync Now button — when connectivity restored]
  
  [Conflict list — when conflicts present]
    Each row: [ConflictResolutionPanel trigger]
```

### Sync Flow After Reconnect

```
[AppShell]
  SyncQueueIndicator: "Syncing 3 items..."
  
[After sync completes:]
  SyncQueueIndicator: "All synced" (then dismisses)
  
[If conflicts:]
  SyncQueueIndicator: "1 conflict needs review"
  → Tap → ConflictResolutionPanel
  
[ConflictResolutionPanel — for custody conflict]
  Conflict: "Helmet #007 checkout conflict"
  
  Local version:
    Checked out to: [Athlete A] at 14:32 (offline)
    
  Server version:
    Checked out to: [Athlete B] at 14:35 (by another device)
    
  Resolution:
    [Keep Local (Athlete A)] [Keep Server (Athlete B)] [Review with Admin]
```

---

## Design System Elements Validated by This Pilot

| Element | Used In |
|---|---|
| AppShell | All three models |
| ScanAction | All three models (varies by surface) |
| EntityCard | Mobile Web, Offline App |
| DataTable | Desktop Admin |
| InspectorDrawer | Desktop Admin |
| ConfirmDialog | All three models |
| StatusBadge | All three models |
| PageHeader | All three models |
| ActionBar | Desktop Admin |
| MobileActionSheet | Mobile Web (contextual actions) |
| OfflineBanner | Offline App (required); Mobile Web (when offline) |
| SyncQueueIndicator | Offline App |
| PendingSyncBadge | Offline App; Mobile Web (when offline) |
| ConflictResolutionPanel | Offline App |
| Timeline | Desktop Admin (custody/maintenance history) |
| EmptyState | All three models (no results in scan/search) |

---

## Future Arc Application

When the GearOps mobile web responsive layer is implemented (future arc), this pilot document should be referenced to:

1. Confirm that ScanAction and MobileActionSheet patterns are appropriate for the checkout flow.
2. Validate that StatusBadge usage matches the canonical vocabulary.
3. Confirm that the guided checkout screens do not remove admin visibility (link to admin detail view must be present).
4. Verify that offline-aware UI elements (OfflineBanner, PendingSyncBadge) are in place even before offline sync is implemented, so the capability can be activated without a UI redesign.

---

## Relationship to Roadmap

The GearOps UI pilot does not create a new roadmap arc. It is a design readiness artifact.

The first arc that implements the mobile web responsive layer for GearOps should use this document as its UI/UX reference specification.
