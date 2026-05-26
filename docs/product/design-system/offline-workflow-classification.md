# Offline Workflow Classification

This document classifies CadreOS workflows by their suitability for offline operation. It establishes a reference matrix for future offline arc planning.

---

## Purpose

Not all workflows are equally suitable for offline operation. Some require real-time server validation. Others are safe to capture locally and sync later. This classification guides:

- Prioritization of offline-capable features in the future mobile app arc
- UI design decisions for offline-aware interaction patterns
- Sync model design (see `sync-and-conflict-model.md`)

---

## Classification Definitions

### Online Required

The workflow cannot safely complete without a server round-trip. Attempting to perform it offline would result in invalid state, data loss, or unresolvable conflicts.

### Offline Capture Allowed

The workflow can safely capture a local event record (e.g., `AttendanceMarked`, `AssetCheckedOut`) for sync on reconnect. The operation may be pending validation until sync completes.

### Sync Risk

The likelihood that a synced operation will conflict with server state changes made during the offline period.

- **Low:** Entity state rarely changes while offline; conflicts are uncommon.
- **Medium:** Entity state may change while offline; conflicts are possible.
- **High:** Entity state frequently changes; concurrent offline operations from multiple devices create high conflict probability.

### Conflict Risk

The likelihood that the same entity will be modified by another user or device concurrently during the offline period.

- **Low:** Entity is typically owned by one user or device at a time.
- **Medium:** Entity may be accessed by multiple users but changes are sequential.
- **High:** Entity is actively managed by multiple users simultaneously.

### Recommended UI Pattern

The interaction pattern appropriate for the workflow given its offline classification.

### Notes

Additional context, caveats, or implementation considerations.

---

## Workflow Classification Matrix

### Attendance Capture

| Attribute | Value |
|---|---|
| Online Required | No |
| Offline Capture Allowed | Yes |
| Sync Risk | Low |
| Conflict Risk | Low |
| Recommended UI Pattern | ScanAction or list select; append `AttendanceMarked` event |
| Notes | Attendance is append-only per person per event. Multiple staff marking the same event offline is safe — same person marked twice is idempotent. Server validates against roster at sync time. |

---

### Gear Checkout

| Attribute | Value |
|---|---|
| Online Required | No |
| Offline Capture Allowed | Yes |
| Sync Risk | Medium |
| Conflict Risk | Medium |
| Recommended UI Pattern | ScanAction → identify athlete → ConfirmDialog → append `AssetCheckedOut` event |
| Notes | Conflict risk if the same item is checked out on multiple devices simultaneously. Server must validate custody state at sync. Items checked out offline should be flagged as `Pending` until sync confirms. |

---

### Gear Return

| Attribute | Value |
|---|---|
| Online Required | No |
| Offline Capture Allowed | Yes |
| Sync Risk | Low |
| Conflict Risk | Low |
| Recommended UI Pattern | ScanAction → confirm custodian → append `AssetReturned` event |
| Notes | Return operations are relatively safe offline. A device capturing a return for an item not checked out on that device requires server reconciliation. |

---

### Custody Transfer

| Attribute | Value |
|---|---|
| Online Required | Preferred |
| Offline Capture Allowed | With caution |
| Sync Risk | High |
| Conflict Risk | High |
| Recommended UI Pattern | ScanAction → identify current custodian → identify new custodian → ConfirmDialog → append `AssetTransferred` event |
| Notes | Transfers involve two parties. If either party also makes an offline change to the same item, conflicts are highly likely. Prefer online for transfers. If offline, mark as high-priority sync conflict candidate. |

---

### Readiness Verification

| Attribute | Value |
|---|---|
| Online Required | No |
| Offline Capture Allowed | Yes |
| Sync Risk | Low |
| Conflict Risk | Low |
| Recommended UI Pattern | Checklist card → step-by-step completion → append `ReadinessVerified` event per check item |
| Notes | Readiness checks are point-in-time captures. Multiple staff verifying the same item offline is safe — last-verified-at and verifier identity are recorded with each event. |

---

### Maintenance Intake

| Attribute | Value |
|---|---|
| Online Required | No |
| Offline Capture Allowed | Yes |
| Sync Risk | Low |
| Conflict Risk | Low |
| Recommended UI Pattern | ScanAction or search → condition form → notes → append `MaintenanceReported` event |
| Notes | Maintenance intake is a new record creation, not a mutation. Multiple maintenance records for the same item are valid (they represent different incidents). Low conflict risk. |

---

### Event Setup Checklist

| Attribute | Value |
|---|---|
| Online Required | No |
| Offline Capture Allowed | Yes |
| Sync Risk | Low |
| Conflict Risk | Medium |
| Recommended UI Pattern | Checklist with progress bar → per-item completion → append `EventChecklistItemCompleted` per item |
| Notes | Conflict risk if multiple staff complete the same checklist item offline on different devices. Idempotent handling at sync (same item completed twice → first completion wins, second is logged but not double-counted). |

---

### Guardian Approval

| Attribute | Value |
|---|---|
| Online Required | Preferred |
| Offline Capture Allowed | With caution |
| Sync Risk | Medium |
| Conflict Risk | Low |
| Recommended UI Pattern | ConfirmDialog with guardian identity → append `GuardianApprovalRecorded` event |
| Notes | Guardian approvals have legal/policy significance. Offline capture is possible but requires careful sync validation. If the approval has already been recorded on the server, the offline copy is a duplicate. If the approval was revoked server-side while offline, conflict resolution requires staff review. |

---

### User / Role Management

| Attribute | Value |
|---|---|
| Online Required | Yes |
| Offline Capture Allowed | No |
| Sync Risk | N/A |
| Conflict Risk | N/A |
| Recommended UI Pattern | Online-only form with ConfirmDialog |
| Notes | Role changes have authorization implications that cannot be safely deferred. Online required. If attempted while offline, show clear error with explanation. |

---

### Reporting

| Attribute | Value |
|---|---|
| Online Required | Yes |
| Offline Capture Allowed | No |
| Sync Risk | N/A |
| Conflict Risk | N/A |
| Recommended UI Pattern | Server-rendered views with online-only indicator |
| Notes | Reports are derived from server state. Pre-fetching a recently-viewed report for offline reading is acceptable. Generating new reports offline is not. |

---

### Resource Booking

| Attribute | Value |
|---|---|
| Online Required | Yes |
| Offline Capture Allowed | No |
| Sync Risk | N/A |
| Conflict Risk | N/A |
| Recommended UI Pattern | Online-only booking form with conflict precheck |
| Notes | Bookings require real-time conflict checking (double-booking prevention). Online required. |

---

### Facility Setup

| Attribute | Value |
|---|---|
| Online Required | Yes |
| Offline Capture Allowed | No |
| Sync Risk | N/A |
| Conflict Risk | N/A |
| Recommended UI Pattern | Online-only configuration form |
| Notes | Facility configuration is a system-level operation. Online required. |

---

## Summary Matrix

| Workflow | Offline Allowed | Sync Risk | Conflict Risk |
|---|---|---|---|
| Attendance Capture | ✅ Yes | Low | Low |
| Gear Checkout | ✅ Yes | Medium | Medium |
| Gear Return | ✅ Yes | Low | Low |
| Custody Transfer | ⚠️ With caution | High | High |
| Readiness Verification | ✅ Yes | Low | Low |
| Maintenance Intake | ✅ Yes | Low | Low |
| Event Setup Checklist | ✅ Yes | Low | Medium |
| Guardian Approval | ⚠️ With caution | Medium | Low |
| User / Role Management | ❌ No | N/A | N/A |
| Reporting | ❌ No | N/A | N/A |
| Resource Booking | ❌ No | N/A | N/A |
| Facility Setup | ❌ No | N/A | N/A |

---

## UI Pattern for Offline-Disallowed Workflows

When a user attempts an offline-disallowed workflow while offline:

1. Show `OfflineBanner` if not already visible.
2. Display a clear in-context message: "This action requires a connection. Connect to continue."
3. Do not disable or hide the feature entirely — preserve discoverability.
4. If the user was mid-flow when connectivity dropped, preserve their in-progress state and resume on reconnect.

---

## Implementation Timing

This matrix is a planning artifact. No offline workflow implementation is required before the designated offline mobile app arc. These classifications inform:

- Future component design (OfflineBanner, SyncQueueIndicator, PendingSyncBadge)
- Sync model design (see `sync-and-conflict-model.md`)
- GearOps UI pilot design (see `gearops-ui-pilot.md`)
