# Sync and Conflict Model

This document defines the preferred future model for offline data synchronization in CadreOS. It is a planning artifact — implementation is deferred to the designated offline mobile app arc.

---

## Overview

CadreOS's offline sync model is based on **append-only operational events**. Rather than syncing direct entity mutations (which create unresolvable conflicts when the same entity is mutated on two devices), offline operations are captured as immutable event records that are appended to a server-side event log on reconnect.

Server-side state derivation from the event log then determines current entity state.

---

## Core Principle: Append-Only Operational Events

### What this means

Instead of: "Set `AssetCustodian` to `athleteId: xyz`"

Capture: "`AssetCheckedOut { assetId, athleteId, eventId, timestamp, capturedBy, deviceId }`"

The server receives the event, validates it against current state, applies it if valid, and derives the new entity state. If the event cannot be applied (e.g., the asset was already checked out by another device), the server creates a conflict record for staff review.

### Why this is preferred

1. **Events are naturally mergeable.** Two independent events about different entities never conflict. Two events about the same entity can be sequenced by timestamp and validated for logical consistency.

2. **Events are idempotent when content-addressed.** An event with the same `deviceId` + `timestamp` + `entityId` + `action` captured twice (e.g., due to retry) can be deduplicated without side effects.

3. **Events provide an implicit audit trail.** The event log is the audit log. No separate audit table needed.

4. **Server state derivation is reliable.** The server always has the authoritative view. Client state is always derived or provisional.

---

## Canonical Offline Event Types

These are the event types that offline-capable workflows will emit. Each event is a serializable, self-contained record.

### AttendanceMarked

```
{
  eventType: "AttendanceMarked",
  eventId: string,           // CadreOS event being attended
  personId: string,          // athlete or participant
  markedAt: ISO8601,
  markedBy: string,          // userId or deviceId
  status: "present" | "absent" | "late",
  capturedOffline: boolean,
  deviceId: string
}
```

**Conflict handling:** If the same `personId` + `eventId` already has an attendance record, the server keeps the earliest-captured record and logs the duplicate for review.

---

### AssetCheckedOut

```
{
  eventType: "AssetCheckedOut",
  assetId: string,
  custodianPersonId: string,
  eventContextId: string | null,  // optional event association
  checkedOutAt: ISO8601,
  expectedReturnAt: ISO8601 | null,
  checkedOutBy: string,
  capturedOffline: boolean,
  deviceId: string
}
```

**Conflict handling:** If the asset is already checked out to a different person at sync time, the server creates a `CustodyConflict` record and marks both operations as `Needs Review`.

---

### AssetReturned

```
{
  eventType: "AssetReturned",
  assetId: string,
  returnedByPersonId: string,
  returnedAt: ISO8601,
  conditionNote: string | null,
  returnedTo: string,          // staff member receiving
  capturedOffline: boolean,
  deviceId: string
}
```

**Conflict handling:** If the asset is already marked returned on the server, the duplicate is logged but not applied.

---

### AssetTransferred

```
{
  eventType: "AssetTransferred",
  assetId: string,
  fromPersonId: string,
  toPersonId: string,
  transferredAt: ISO8601,
  transferredBy: string,
  capturedOffline: boolean,
  deviceId: string
}
```

**Conflict handling:** Transfers are high-conflict risk. If the custody chain changed while offline, server creates a `CustodyConflict` for staff resolution.

---

### ReadinessVerified

```
{
  eventType: "ReadinessVerified",
  entityType: "asset" | "athlete" | "event",
  entityId: string,
  checkName: string,
  result: "pass" | "fail" | "needs_review",
  verifiedAt: ISO8601,
  verifiedBy: string,
  notes: string | null,
  capturedOffline: boolean,
  deviceId: string
}
```

**Conflict handling:** Multiple verifications of the same check are valid (each represents a verification point). Server records all and derives current status from most recent valid pass.

---

### MaintenanceReported

```
{
  eventType: "MaintenanceReported",
  assetId: string,
  reportedAt: ISO8601,
  reportedBy: string,
  conditionCode: string,
  description: string,
  severity: "low" | "medium" | "high" | "critical",
  capturedOffline: boolean,
  deviceId: string
}
```

**Conflict handling:** No conflict. Maintenance reports are additive. Multiple reports for the same asset are valid and expected.

---

### GuardianApprovalRecorded

```
{
  eventType: "GuardianApprovalRecorded",
  guardianPersonId: string,
  athletePersonId: string,
  approvalType: string,
  approvedAt: ISO8601,
  recordedBy: string,
  capturedOffline: boolean,
  deviceId: string
}
```

**Conflict handling:** If an approval was revoked server-side while offline, the offline capture is flagged as `Needs Review`. Staff must resolve.

---

### EventChecklistItemCompleted

```
{
  eventType: "EventChecklistItemCompleted",
  eventId: string,
  checklistItemId: string,
  completedAt: ISO8601,
  completedBy: string,
  capturedOffline: boolean,
  deviceId: string
}
```

**Conflict handling:** Same item completed by two devices offline → first-write-wins; second is logged but not double-counted.

---

## Sync Lifecycle

### Phase 1: Local Capture (Offline)

1. User performs an action (e.g., gear checkout scan).
2. App creates an event record locally with `capturedOffline: true`.
3. Event is added to the local sync queue.
4. UI shows entity in provisional state (e.g., `Checked Out — Pending Sync`).
5. `PendingSyncBadge` appears on the entity in lists/cards.

### Phase 2: Sync Initiation (On Reconnect)

1. Device detects connectivity restoration.
2. `SyncQueueIndicator` updates to `syncing` state.
3. App submits pending events to the server in chronological order (by `capturedOffline` timestamp).
4. Each event is submitted to a dedicated sync endpoint: `POST /api/sync/events`.

### Phase 3: Server Validation

For each incoming event, the server:

1. Checks for duplicate (idempotency by `deviceId` + `eventType` + `entityId` + `capturedAt`).
2. Validates that the operation is still valid against current state.
3. If valid: applies the event and returns `{ status: "applied" }`.
4. If duplicate: skips and returns `{ status: "duplicate" }`.
5. If conflicted: creates a conflict record and returns `{ status: "conflict", conflictId }`.

### Phase 4: Client State Update

1. App receives sync results per event.
2. Events with `applied` status: remove from sync queue, update local entity state.
3. Events with `duplicate` status: remove from sync queue silently.
4. Events with `conflict` status: mark as conflict in sync queue, surface `ConflictResolutionPanel`.

### Phase 5: Conflict Resolution

1. User reviews `ConflictResolutionPanel` for each conflict.
2. Options: Keep local version, Keep server version, Resolve manually.
3. Resolution is submitted to server.
4. Entity state updates to resolved state.

---

## Conflict Resolution Rules by Event Type

| Event Type | Conflict Scenario | Default Resolution |
|---|---|---|
| AttendanceMarked | Same person marked twice | First-capture wins; second logged |
| AssetCheckedOut | Asset already checked out | Flag as conflict; staff review |
| AssetReturned | Asset already returned | Duplicate logged; no conflict |
| AssetTransferred | Custody chain changed | Flag as conflict; staff review |
| ReadinessVerified | Multiple verifications | Most recent valid pass wins |
| MaintenanceReported | Multiple reports | All valid; no conflict |
| GuardianApprovalRecorded | Approval revoked server-side | Flag as conflict; staff review |
| EventChecklistItemCompleted | Item completed twice | First-capture wins; second logged |

---

## Server-Side State Derivation Principle

> Current state should always be derived or validated server-side after sync where possible.

Clients hold provisional state until sync confirms. The server is the source of truth. This means:

- Client state should not be relied upon for authorization decisions.
- UI should clearly indicate provisional state with `PendingSyncBadge` or status qualifiers.
- Reporting and audit operations should always query server state, never client state.

---

## Deduplication Strategy

Each event record must include:
- `deviceId` — unique identifier for the capturing device
- `capturedAt` — ISO8601 timestamp of local capture
- A content-derived hash or the combination of `deviceId + eventType + entityId + capturedAt` as a natural idempotency key

The server uses this key to detect and discard duplicates without side effects.

---

## Implementation Notes (Future Arc)

This model assumes:

1. A `SyncEvent` table in Prisma schema for storing incoming events.
2. A `ConflictRecord` table for storing unresolved conflicts.
3. A `POST /api/sync/events` endpoint accepting a batch of events.
4. Server-side event handlers per event type with conflict detection logic.
5. Client-side sync queue storage (IndexedDB for PWA; SQLite or AsyncStorage for native app).
6. Connectivity detection in the AppShell layer.

None of these are implemented yet. This document guides their design when the offline arc is ready.
