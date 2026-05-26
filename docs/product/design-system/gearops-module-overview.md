# GearOps Module Overview

GearOps is the CadreOS module for managing organizational gear: inventory, custody, maintenance, event deployment, and reporting. It was built across Arcs 20A–20K and hardened in Arc 20L.

---

## Data model summary

### Core entities (Prisma models)

| Model | Purpose |
|---|---|
| `GearCategory` | Typed category with configurable capability rules and identifier requirements |
| `GearItem` | A single durable or consumable gear item belonging to the organization |
| `GearCheckout` | A time-bounded custody record linking a gear item to a person or team |
| `GearAssignment` | A longer-term assignment of a gear item to a person |
| `GearMaintenanceRecord` | An intake or completion record for maintenance or inspection |
| `GearLocation` | A named physical or logical storage location |
| `GearActivityEntry` | Immutable server-confirmed activity log for any gear item event |
| `GearUsageEvent` | A usage record tied to a gear item |
| `EventGearPlan` | A gear plan attached to an organizational event |
| `EventGearRequirement` | A typed gear requirement within an event plan |
| `EventGearAssignment` | A specific gear item assigned to satisfy an event requirement |

### Key enums

| Enum | Values |
|---|---|
| `GearItemLifecycleStatus` | ACTIVE, RESERVED, ASSIGNED, CHECKED_OUT, MAINTENANCE, QUARANTINED, RETIRED, LOST |
| `GearConditionStatus` | NEW, GOOD, FAIR, POOR, DAMAGED |
| `InventoryReadinessState` | READY, NEEDS_INSPECTION, MAINTENANCE_REQUIRED, NOT_READY, DECOMMISSIONED |
| `GearCheckoutStatus` | OPEN, OVERDUE, RETURNED, LOST |
| `GearAssignmentStatus` | PENDING, ACTIVE, OVERDUE, RETURNED, TRANSFERRED, CANCELLED |
| `GearInventoryType` | DURABLE, CONSUMABLE |
| `GearLocationClassification` | VAULT, CAGE, LOCKER, TRAILER, BAY, FIELD, ROOM, STORAGE_AREA, GENERAL, OTHER |
| `EventGearPlanStatus` | DRAFT, READY_TO_STAGE, STAGED, DEPLOYED, RECOVERING, COMPLETED |

---

## Inventory and custody model

### Inventory types

- **Durable**: Serialized, trackable items (firearms, radios, medical kits). Subject to checkout, assignment, and maintenance tracking.
- **Consumable**: Quantity-tracked items (batteries, zip ties, tape). Support low-stock thresholds and consumable adjustment events.

### Lifecycle progression (durable)

```
ACTIVE → CHECKED_OUT → (OVERDUE) → RETURNED → ACTIVE
ACTIVE → ASSIGNED → ACTIVE (on return)
ACTIVE → MAINTENANCE → ACTIVE (on completion)
ACTIVE → QUARANTINED → (admin review) → ACTIVE | RETIRED
ACTIVE → RETIRED | LOST
```

### Custody model

Custody is tracked via `GearCheckout` (short-term check-out to a person) and `GearAssignment` (longer-term assignment). Both are scoped to an organization.

- An open checkout or active assignment means the item is not freely available.
- Overdue custody generates exception reports.
- Custody transfers require explicit check-in of the existing custody before a new one is opened.

---

## Ownership and source model

Each gear item carries an `ownershipSource` and optionally an `ownerPersonId`:

| Source | Meaning |
|---|---|
| PURCHASED | Acquired by the organization |
| DONATED | Donated to the organization |
| LOANED | On loan; expected to be returned |
| SHARED | Shared pool, may be used by multiple orgs |
| ASSIGNED | Personal-issue item; owned by an individual |

Guardian approval gates apply when `guardianApprovalRequired = true` on the category. This is used for sensitive gear categories (e.g., firearms) where a guardian must approve assignment to a minor.

---

## Rapid and mobile workflows

Rapid inventory operations are defined in `lib/rapid-inventory-ops.ts`. They provide low-friction scan-first or search-first paths for:

- **Check out** (`CHECKOUT`): open a checkout record for a scanned item
- **Check in** (`CHECKIN`): close an open checkout for a scanned item
- **Quick assign** (`ASSIGN`): create a short-term assignment
- **Report condition** (`CONDITION_REPORT`): log a condition observation
- **Consumable adjustment** (`CONSUMABLE_ADJUST`): record a quantity change

Each rapid action maps to a scan context (`GearScanContext`) and a mobile action card (`MobileInventoryAction`). Scan results resolve to a `GearScanTarget` that routes to the appropriate action flow.

### Scan-first fallback

When a scan fails (unrecognized barcode, manual entry), the operator is offered a fallback manual search before the action is blocked. See `lib/inventory-scan/types.ts` for `ScanEventResult` values and `normalizeInventoryCodeValue` for input normalization.

---

## Readiness, maintenance, and usage lifecycle

### Readiness states

Readiness reflects whether a durable item is operationally ready:

| State | Meaning |
|---|---|
| READY | Cleared for deployment |
| NEEDS_INSPECTION | Due or overdue for inspection |
| MAINTENANCE_REQUIRED | Active maintenance deficiency |
| NOT_READY | Admin-blocked from deployment |
| DECOMMISSIONED | Permanently removed from service |

### Maintenance flow

1. Intake creates a `GearMaintenanceRecord` and transitions the item to `MAINTENANCE` lifecycle status.
2. Completion updates the record with outcome and condition, and transitions back to `ACTIVE` (or `QUARANTINED` if result is FAIL_QUARANTINE).
3. Maintenance history is visible in the item's activity feed.

### Availability warnings and blocking

`deriveAvailabilitySignal` in `lib/gear-ops-ui.ts` computes a `GearAvailabilitySignal`:

- `AVAILABLE`: item is ready and has no open custody
- `CHECKED_OUT`: item is currently checked out
- `ASSIGNED`: item is currently assigned
- `MAINTENANCE`: item is in maintenance or quarantine
- `UNAVAILABLE`: item is retired, lost, or otherwise blocked

Items with signal `MAINTENANCE` or `UNAVAILABLE` are blocked from checkout/assignment.

---

## Event gear planning and deployment

### Plan lifecycle

```
DRAFT → READY_TO_STAGE → STAGED → DEPLOYED → RECOVERING → COMPLETED
```

### Requirements and assignments

Each `EventGearPlan` has `EventGearRequirement` rows (REQUIRED, OPTIONAL, SUPPORT). Each requirement tracks:
- `quantityNeeded`
- Assigned gear items (`EventGearAssignment`)
- Derived gaps (needed - assigned)

### Availability derivation

`deriveEventGearAvailability` computes an `EventGearAvailabilityState` for each assigned item:

| State | Meaning |
|---|---|
| READY | Available and in good condition |
| LIMITED_USE | Fair condition or needs inspection |
| UNAVAILABLE | Blocking checkout or assignment exists |
| OUT_OF_SERVICE | Retired, lost, or quarantined |
| MAINTENANCE_NEEDED | In maintenance |

### Post-event recovery

After an event, the plan transitions to RECOVERING. Deployed checkouts are closed, items are returned, and any unreturned or damaged items generate exception records.

---

## Dashboards and reports

Dashboard summaries in `lib/gear-ops-dashboard.ts`:

| Summary | Covers |
|---|---|
| `summarizeReadiness` | Readiness state distribution, DECOMMISSIONED count |
| `summarizeCustody` | Open/overdue checkouts and assignments |
| `summarizeLocations` | Item count per location |
| `summarizeMaintenance` | Active/completed/scheduled maintenance |
| `summarizeConsumables` | Low-stock, critical-stock items |
| `summarizeEventRequirements` | Gaps, ready counts, unreturned items per event plan |
| `buildGearOpsExceptions` | All exception records with kind, count, and link |
| `summarizeOperationalRisk` | Five risk categories (overdue, maintenance, consumable, event gap, event unreturned) with high/medium/low severity |

### Exception kinds

| Kind | Trigger |
|---|---|
| OUT_OF_SERVICE | Item is RETIRED, LOST, or QUARANTINED |
| OVERDUE_UNRETURNED | Open checkout or assignment is past due date |
| MAINTENANCE_NEEDED | Item has MAINTENANCE_REQUIRED readiness or open maintenance record |
| LOW_CONSUMABLE | Consumable quantity is at or below low-stock threshold |
| EVENT_GEAR_GAP | Required gear quantity exceeds assigned quantity |
| EVENT_GEAR_UNRETURNED | Deployed event gear not recovered after event end |

---

## Category and template configuration

`lib/gear-category-config.ts` provides:

- **12 starter templates** (e.g., `firearm`, `radio`, `medical-kit`, `uniform`, `vehicle`) with opinionated defaults for custodyMode, identifier type, maintenance tracking, and report grouping.
- `applyGearCategoryTemplate(slug)` returns defaults for a given template slug, or `{}` if unknown.
- `getGearCategoryTemplate(slug)` returns the full `GearCategoryTemplateDef` or `undefined`.
- `isCategoryDurable` / `isCategoryConsumable` derive behavior from `inventoryType`.

### Category capability rules

Each category can configure:
- `custodyMode`: FREE_CHECKOUT | STAFF_ASSIGNMENT_ONLY | SHARED_POOL | PERSONAL_ISSUE
- `requiresSerialNumber`, `requiresAssetTag`: identifier enforcement
- `requiresReturnInspection`, `requiresMaintenanceTracking`: workflow enforcement
- `supportsConsumableTracking`, `consumableLowStockDefault`: consumable thresholds
- `guardianApprovalRequired`: approval gate for sensitive gear

### Report grouping

`GearReportGroup` controls dashboard grouping and badge styling. Available groups: FIREARMS, COMMUNICATIONS, ELECTRONICS, MEDICAL, ATHLETIC_EQUIPMENT, APPAREL, TOOLS, VEHICLES_LARGE_EQUIPMENT, CONSUMABLES, GENERAL.

---

## Mobile and offline foundation

See also: `docs/product/design-system/gearops-mobile-offline-foundation.md`

### Offline capability tiers

| Capability | Label | Meaning |
|---|---|---|
| OFFLINE_SAFE | Offline-safe | Action completes locally; sync confirms later |
| OFFLINE_DRAFTABLE | Offline-draftable | Action saved as draft; requires online to confirm |
| OFFLINE_LIMITED | Offline-limited | Action partially supported; some fields require online |
| ONLINE_REQUIRED | Online-required | Action blocked when offline |

### Pending action states

Each pending action has a `GearPendingActionStatus`:
- `PENDING_SYNC`: queued for server confirmation
- `DRAFTED_LOCALLY`: local draft, not yet submitted
- `SUBMITTED_AWAITING_CONFIRM`: submitted; awaiting server response
- `CONFIRMED`: server confirmed
- `FAILED`: server rejected or network error
- `DISCARDED`: operator cancelled

### Connectivity banner

The UI shows a connectivity banner when offline. Pending actions are surfaced in the operator view. Confirmed actions are written to `GearActivityEntry` and trusted as the source of truth.

### Action state language

- **Pending**: action is queued locally but not confirmed by the server
- **Confirmed**: server has acknowledged and persisted the action
- The UI must not show a pending action as completed. Activity history only reflects confirmed events.

---

## UI model

### Operator vs admin views

GearOps supports two density modes:
- **Simple operator view**: minimal fields, prominent action buttons, large touch targets, mobile-first layout
- **Admin/power-user view**: full detail, raw identifiers, configuration access, all history

### Badge and status chips

Badge classes are provided by `lib/gear-ops-ui.ts` via a tone-based API:
- `getLifecycleBadgeClass`, `getConditionBadgeClass`, `getReadinessBadgeClass` (use `toneToChipClass` internally)
- `getCheckoutBadgeClass`, `getAssignmentBadgeClass`, `getAvailabilitySignalChipClass`, `getConcernLevelChipClass`

The older direct-class API in `lib/gear-ops.ts` (`getGearConditionBadgeClass`, `getGearLifecycleBadgeClass`, `getReadinessBadgeClass`) is deprecated in favor of `lib/gear-ops-ui.ts`.

### Empty, loading, and error states

All GearOps pages must handle:
- **Empty state**: no items, no history, no plan assignments — show a contextual empty message, not a blank panel
- **Loading state**: show skeleton or spinner while data is fetching
- **Error state**: show an error banner with retry option; do not silently fail

---

## Organization scoping

All GearOps data is scoped to an organization via `organizationId`. All routes resolve `organizationId` via `getOrganizationScope()` and reject requests from other organizations. Category templates are org-scoped once instantiated.

---

## Permission model

GearOps uses the CadreOS role system. Key permission boundaries:

- **ORGANIZATION_ADMIN**: full access — create/edit categories, view all reports, configure templates
- **STAFF**: checkout, check-in, assignment, maintenance intake, event gear planning
- **OPERATOR**: rapid actions (scan, checkout, check-in, condition report) in the mobile operator view
- **GUARDIAN**: read-only access to gear assigned to their dependents; approval responses only

Firearm-specific guardian approval (`guardianApprovalRequired`) is a category-level rule and must not be assumed for non-firearm categories.

---

## Known limitations and deferred scope

- Full native mobile app and offline sync engine are out of scope for Arc 20A–20L.
- Procurement and accounting integrations are not implemented.
- Predictive maintenance scheduling is not implemented.
- Complex BI/analytics dashboards beyond the current summary + exception model are deferred.
- Guardian approval flows are scaffolded but UI-complete authorization is deferred to a later phase.
- Multi-org gear sharing (SHARED ownership source) has model support but no cross-org sync.

---

## Testing notes

Test files covering GearOps (under `tests/`):

| File | Coverage |
|---|---|
| `gear-ops-core/helpers.test.ts` | `formatGearOpsEnum`, `formatGearOpsDateTime`, badge class functions in `gear-ops.ts` |
| `gear-ops-ui/ui-helpers.test.ts` | Tone helpers, badge classes, label functions, availability signal, concern level in `gear-ops-ui.ts` |
| `gear-ops-dashboard/types.test.ts` | All summary functions, exception generation, `summarizeOperationalRisk` |
| `gear-ops-categories/config.test.ts` | Template lookup, `applyGearCategoryTemplate`, category behavior helpers, `formatGearLocationClassification` |
| `inventory-ops/types.test.ts` | Inventory type predicates, lifecycle helpers |
| `inventory-scan/types.test.ts` | Scan identifier parsing, normalization, label helpers, `isOpenCheckoutStatus` |
| `gear-offline/types.test.ts` | Offline policy derivation, pending state machine, capability labels |
| `event-gear/types.test.ts` | Event gear availability derivation, assignment status, requirement/plan summaries, badge helpers |
| `rapid-inventory-ops/types.test.ts` | Rapid action presets, href building, mobile action resolution |

Run all tests with `npm test`.

---

## Arc 20M recommendations

- Build out end-to-end route tests for the major GearOps API routes (checkout, check-in, assignment, maintenance).
- Add integration tests for organization scoping enforcement in GearOps routes.
- Implement guardian approval UI flow.
- Add UI test coverage for empty/loading/error states.
- Address firearm-category isolation to ensure no leakage into generic categories.
- Evaluate readiness for a beta operator rollout and identify remaining UX gaps.
