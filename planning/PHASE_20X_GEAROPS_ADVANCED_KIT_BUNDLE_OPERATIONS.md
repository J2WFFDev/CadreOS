# Phase 20X — GearOps Advanced Kit and Bundle Operations

## Overview

Arc 20X adds advanced kit and bundle modeling to the GearOps module. It extends the existing `InventoryKit` and `InventoryKitItem` Prisma models with completeness checking, readiness derivation, full custody lifecycle, inspection logging, and related UI workflows.

This phase is an **operational enhancement arc**, not a warehouse packing, procurement, or bill-of-materials system.

---

## Kit/Bundle Concept Definitions

| Term | Meaning |
|------|---------|
| **Kit** | A named collection of gear items that operate together (e.g. radio kit, firearm case, tool kit) |
| **Bundle** | Alias for kit; same model, different `kitType` label |
| **Set** | A kit typed as `SET` — e.g. magazine set, athlete gear set |
| **Case** | A kit typed as `CASE` — e.g. firearm case, pelican case |
| **Bag** | A kit typed as `BAG` — e.g. athlete gear bag |
| **Regular gear item** | A standalone `GearItem` not part of any kit, or a child item of a kit |

---

## Schema Changes

### New Enums

| Enum | Values |
|------|--------|
| `GearKitType` | `GENERIC`, `CASE`, `BAG`, `SET`, `BUNDLE`, `EVENT_KIT`, `ATHLETE_KIT`, `RESPONSE_KIT`, `TOOL_KIT`, `MEDICAL_KIT` |
| `GearKitComponentRole` | `STANDARD`, `PRIMARY`, `ACCESSORY`, `CONSUMABLE`, `DOCUMENTATION`, `CONTAINER` |
| `GearKitReadinessLabel` | `READY`, `READY_WITH_WARNING`, `INCOMPLETE`, `LIMITED_USE`, `NEEDS_INSPECTION`, `MAINTENANCE_NEEDED`, `OUT_OF_SERVICE`, `MISSING_COMPONENTS`, `CONFLICT` |
| `GearKitCustodyStatus` | `AVAILABLE`, `CHECKED_OUT`, `ASSIGNED`, `DEPLOYED`, `RESERVED`, `IN_INSPECTION`, `IN_MAINTENANCE` |
| `GearKitInspectionStatus` | `PASSED`, `PASSED_WITH_NOTES`, `FAILED`, `INCOMPLETE` |
| `GearKitCustodyEventType` | `CHECKED_OUT`, `CHECKED_IN`, `ASSIGNED`, `UNASSIGNED`, `DEPLOYED`, `RECOVERED`, `RESERVED`, `RESERVATION_RELEASED`, `INSPECTION_STARTED`, `INSPECTION_COMPLETED`, `MAINTENANCE_STARTED`, `MAINTENANCE_COMPLETED`, `TRANSFERRED` |

### Extended `InventoryKit`

New fields: `kitType`, `readinessLabel`, `custodyStatus`, `labelCode`, `lastInspectedAt`, `lastInspectionStatus`, `reservedUntil`, `reservedById`, `assignedToPersonId`, `assignedToTeamId`, `assignedToEventId`.

New relations: `assignedTo` (Person), `assignedToTeam` (Team), `assignedToEvent` (Event), `custodyEvents` (GearKitCustodyEvent[]), `inspections` (GearKitInspection[]).

### Extended `InventoryKitItem`

New fields: `componentRole`, `isRequired`, `quantityExpected`, `sortOrder`.

### New Models

**`GearKitInspection`** — Records a formal inspection of a kit. Includes inspector, date, overall status, notes, and per-item observations (JSON).

**`GearKitCustodyEvent`** — Immutable audit log entry for kit custody changes. Records event type, actor, target person/team/event, and notes.

---

## Architecture Decisions

### Kit as a First-Class Operational Object

Kits extend `InventoryKit` (existing) rather than creating a parallel inventory system. Child items remain real `GearItem` references — kits do not duplicate inventory.

### Parent/Child Custody

- **Full kit checkout** moves `InventoryKit.custodyStatus` to `CHECKED_OUT` and writes a `GearKitCustodyEvent`. Individual child `GearItem` custody is updated via the existing inventory service.
- **Child items are not silently reassigned** when a kit is checked out — the service explicitly moves child custody alongside the kit.
- **Partial checkout** is documented as limited scope: the UI warns but does not enforce at the DB layer in this arc.
- **Kit history** is tracked via `GearKitCustodyEvent` (parent-level). Child-level history is tracked via the existing `InventoryActivity` log.

### Completeness vs. Readiness

**Completeness** (`computeKitCompleteness`) is a pure structural measurement:
- Counts required vs. optional components
- Identifies out-of-service, maintenance-needed, and damaged components
- Based solely on component snapshots — no custody state

**Readiness** (`computeKitReadiness`) is a derived operational label:
- Uses completeness result + custody status + inspection status + conflict flag
- Priority order: CONFLICT → OUT_OF_SERVICE → MISSING_COMPONENTS → MAINTENANCE_NEEDED → NEEDS_INSPECTION → INCOMPLETE → LIMITED_USE → READY_WITH_WARNING → READY

### Component "Present" Definition

A component is `present` when:
- `quantityActual >= quantityExpected`
- `lifecycleStatus` is not in `{MAINTENANCE, QUARANTINED, RETIRED, LOST}`

Snapshots with `removedAt !== null` are filtered out entirely (item removed from kit membership, not counted as missing).

---

## Kit Completeness Logic

```
computeKitCompleteness(snapshots: GearKitComponentSnapshot[]) → GearKitCompletenessResult
```

1. Filter active snapshots (`removedAt === null`)
2. For each snapshot, derive: `outOfService`, `maintenanceNeeded`, `damaged`, `present`
3. Count: `requiredComponents`, `optionalComponents`, `presentCount`, `missingRequiredCount`, `missingOptionalCount`, `outOfServiceCount`, `maintenanceNeededCount`, `damagedCount`
4. Compute: `requiredCompleteness` (fraction), `overallCompleteness` (fraction)

---

## Kit Readiness Logic

```
computeKitReadiness(input: GearKitReadinessInput) → GearKitReadinessLabel
```

Priority chain (first match wins):

1. `hasConflict` → `CONFLICT`
2. `custodyStatus === IN_MAINTENANCE` OR any required component `outOfService` → `OUT_OF_SERVICE`
3. `missingRequiredCount > 0` → `MISSING_COMPONENTS`
4. Any required component `maintenanceNeeded` → `MAINTENANCE_NEEDED`
5. `lastInspectionStatus === FAILED` OR `custodyStatus === IN_INSPECTION` → `NEEDS_INSPECTION`
6. `missingOptionalCount > 0` → `INCOMPLETE`
7. Any required component `damaged` → `LIMITED_USE`
8. Any component with OOS/maintenance warning → `READY_WITH_WARNING`
9. Default → `READY`

---

## Kit Custody Behavior

### Full Kit Checkout
- Sets `custodyStatus = CHECKED_OUT`
- Sets `assignedToPersonId`
- Writes `GearKitCustodyEvent` with type `CHECKED_OUT`
- Child `GearItem` custody moved via `checkOutItem()` service

### Full Kit Check-In
- Clears `custodyStatus = AVAILABLE`
- Clears `assignedToPersonId`
- Writes `GearKitCustodyEvent` with type `CHECKED_IN`
- Child item custody returned via existing service

### Kit Assignment (Person/Team)
- Sets `custodyStatus = ASSIGNED`
- Sets `assignedToPersonId` or `assignedToTeamId`
- Writes `GearKitCustodyEvent` with type `ASSIGNED`

### Event Deployment
- Sets `custodyStatus = DEPLOYED`
- Sets `assignedToEventId`
- Writes `GearKitCustodyEvent` with type `DEPLOYED`

### Event Recovery
- Clears event assignment
- Resets `custodyStatus = AVAILABLE`
- Writes `GearKitCustodyEvent` with type `RECOVERED`
- Supports per-item condition notes via inspection log

### Reservation/Hold
- Sets `custodyStatus = RESERVED`
- Sets `reservedUntil` timestamp
- Writes `GearKitCustodyEvent`
- `hasConflict = true` when reservation is active → `CONFLICT` readiness label

---

## Kit Inspection

`GearKitInspection` records:
- Inspector (person), inspection date, overall status
- Per-item observations (JSON array: `[{ kitItemId, conditionNotes, isMissing }]`)
- Notes

After inspection, `InventoryKit.lastInspectedAt` and `lastInspectionStatus` are updated.

**FAILED** or **IN_INSPECTION** custody → readiness label `NEEDS_INSPECTION`.

---

## Event Kit Deployment

1. Assign kit to event via `deployKitToEvent()`
2. Kit appears in event gear plan with `custodyStatus = DEPLOYED`
3. Readiness is reviewable from kit detail page
4. On recovery via `recoverKitFromEvent()`:
   - Custody reset to `AVAILABLE`
   - Optional inspection log captures post-event child condition

---

## Reservation/Hold Behavior

- `reserveKit()` sets `custodyStatus = RESERVED` and `reservedUntil`
- `releaseKitReservation()` resets status to `AVAILABLE`
- Kit reservation does not automatically reserve child items (bounded scope)
- `hasConflict` flag passed to `computeKitReadiness()` when `reservedUntil > now`

---

## Scan/Label Behavior

- `InventoryKit.labelCode` stores the kit's primary label/QR code identifier
- Existing `InventoryItem.labelCode` covers child items
- Parent kit label can be scanned to show kit detail and membership
- Child item label shows kit membership via `InventoryKitItem` back-reference
- Label generation reuses existing `inventory-labels` infrastructure

---

## UI Routes Added

| Route | Purpose |
|-------|---------|
| `kits/new/page.tsx` | Create kit — now includes `kitType` select |
| `kits/[kitId]/page.tsx` | Kit detail — readiness badge, completeness display, custody status, child items |
| `kits/[kitId]/edit/page.tsx` | Edit kit name/description/type/active |
| `kits/[kitId]/update/route.ts` | POST handler for edit |
| `kits/[kitId]/add-item/page.tsx` | Add gear item to kit with role/required/quantity |
| `kits/[kitId]/add-item-action/route.ts` | POST handler for add item |
| `kits/[kitId]/remove-item/[kitItemId]/route.ts` | Soft-delete kit item |
| `kits/[kitId]/checkout/page.tsx` | Full kit checkout form |
| `kits/[kitId]/checkout-action/route.ts` | POST handler for checkout |
| `kits/[kitId]/checkin/route.ts` | POST handler for check-in |
| `kits/[kitId]/inspect/page.tsx` | Inspection form with per-item observations |
| `kits/[kitId]/inspect-action/route.ts` | POST handler for inspection |

---

## New Service Functions (`lib/inventory-ops/service.ts`)

| Function | Purpose |
|----------|---------|
| `updateInventoryKit()` | Edit kit metadata |
| `checkOutKit()` | Check out full kit to person |
| `checkInKit()` | Return full kit |
| `assignKit()` | Assign kit to person/team |
| `logKitInspection()` | Record inspection result |
| `reserveKit()` | Place hold on kit |
| `releaseKitReservation()` | Release hold |
| `deployKitToEvent()` | Deploy kit to event |
| `recoverKitFromEvent()` | Recover kit from event |
| `listKitCustodyHistory()` | List custody events for kit |
| `listKitInspections()` | List inspection records for kit |

---

## Pure Logic Library (`lib/gear-kit.ts`)

Stateless functions and helpers for use in both server and client contexts:

- `computeKitCompleteness()` — structural completeness from snapshots
- `computeKitReadiness()` — operational readiness label
- `isKitOperationallyReady()` — true if READY or READY_WITH_WARNING
- `isKitBlockedFromUse()` — true if OUT_OF_SERVICE or MISSING_COMPONENTS
- `formatKitCompleteness()` — human-readable completeness string
- Label helpers: `labelForKitType`, `labelForKitReadiness`, `labelForKitCustodyStatus`, `labelForKitComponentRole`, `labelForKitInspectionStatus`
- Badge class helpers: `getKitReadinessBadgeClass`, `getKitCustodyStatusBadgeClass`, `getKitInspectionStatusBadgeClass`
- `GearKitOfflinePolicies` — offline boundary constants

---

## Offline/Mobile Boundaries

Kit operations follow the same offline policy model as other GearOps operations (`lib/gear-offline.ts`):

| Action | Policy |
|--------|--------|
| `gear.kit.checkout.create` | `ONLINE_REQUIRED` |
| `gear.kit.checkin` | `ONLINE_REQUIRED` |
| `gear.kit.assign` | `ONLINE_REQUIRED` |
| `gear.kit.reserve` | `ONLINE_REQUIRED` |
| `gear.kit.inspection.create` | `OFFLINE_DRAFTABLE` |

**Custody-changing actions require online confirmation.** Inspection drafts may be started offline and synced later.

---

## Import/Export Behavior

- Kit membership (parent + child item list) can be exported via existing CSV export infrastructure
- Kit completeness/readiness status is visible in dashboard panels
- Import of kit membership is limited: creating new kits via import is not supported in this arc (bounded scope)
- Label generation for parent kits reuses existing label infrastructure via `labelCode`

---

## Deferred Scope

The following are explicitly **not** implemented in Arc 20X:

- Warehouse packing / fulfillment system
- Procurement bundling or sales bundles
- Bill of materials (BOM) manufacturing system
- Recursive/nested kit hierarchies beyond one level
- Automated kit optimization or AI recommendations
- RFID portal tracking
- Full offline kit sync with conflict resolution
- Native mobile kit app
- Consumable quantity tracking inside kits (bounded; noted but not implemented)
- Complex nested import of kit membership

---

## Known Limitations

- **Partial kit checkout** — UI warns but does not enforce at the DB layer; full kit checkout/check-in is the primary supported workflow
- **Child item reservation propagation** — reserving a kit does not automatically reserve child items; child conflicts must be checked manually
- **Consumables** — consumable-typed components are modeled (`componentRole = CONSUMABLE`) but quantity drawdown is not tracked in this arc
- **Recursive kits** — kits cannot contain other kits; only individual `GearItem` references are supported

---

## Testing Coverage Added

- `tests/gear-kit/completeness.test.ts` — 20 tests covering: empty kit, removed items, active/LOST items, OOS lifecycle statuses, damaged conditions, maintenance readiness, mixed required/optional, requiredCompleteness fraction, components array
- `tests/gear-kit/readiness.test.ts` — 20 tests covering: READY path, IN_MAINTENANCE → OUT_OF_SERVICE, missing required → OUT_OF_SERVICE, MAINTENANCE_REQUIRED → MAINTENANCE_NEEDED, FAILED/IN_INSPECTION → NEEDS_INSPECTION, hasConflict → CONFLICT, `isKitOperationallyReady`, `isKitBlockedFromUse`

---

## Recommended Arc 20Y Next Steps

1. **Kit dashboard panels** — Dedicated dashboard section showing incomplete kits, kits with OOS components, kits pending recovery, kits needing inspection
2. **Event gear plan kit integration** — Expand event readiness summary to show kit completeness/readiness inline when a kit is assigned as an event item
3. **Kit import/export** — CSV export of kit membership and status; bounded import for kit creation
4. **Partial kit checkout enforcement** — Track which child items moved and which stayed during partial ops; surface in kit detail
5. **Consumable quantity tracking** — Track drawdown of consumable-role components (e.g. first aid supplies, ammunition) within bounded scope
6. **Kit label generation UI** — Dedicated label print action for parent kit and all child items from kit detail page
7. **Kit reservation conflict checks** — Check child item availability when reserving a kit; surface conflicts before confirming
8. **Mobile kit scan workflow** — Scan parent kit label → show kit detail; scan child item → show kit membership and status
