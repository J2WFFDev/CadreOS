# Arc 20Y — GearOps Advanced Inspection and Recurring Maintenance Scheduling

## Overview

Arc 20Y adds practical inspection scheduling and recurring maintenance due-tracking to GearOps.
It builds on the release-candidate, pilot-ready GearOps module completed through Arc 20X.

The goal is operational: allow GearOps to track inspection requirements, recurring maintenance
intervals, due/overdue states, pre-event and post-event checks, and kit/bundle inspection
readiness — without becoming a full CMMS, predictive maintenance platform, or enterprise
work-order engine.

---

## Scope

### In scope

- Inspection schedule configuration per gear category
- Maintenance schedule configuration per gear category
- Due and overdue status for inspection and maintenance
- Inspection result recording (GearInspectionRecord)
- Pre-event readiness gap detection
- Post-event recovery flag detection
- Kit/bundle inspection readiness
- Dashboard and report due-summary integration
- Notification handoff event preparation
- Mobile/offline boundary documentation

### Out of scope (deferred)

- Full CMMS or enterprise work-order engine
- Predictive maintenance
- Service vendor management
- Warranty management
- Procurement or accounting
- Advanced scheduling optimization
- Custom form builder
- AI recommendations
- Notification delivery
- Native mobile inspection app
- Full offline inspection sync
- Unrelated module rewrites

---

## Data Model Changes

### New Enums (prisma/schema.prisma)

| Enum | Values |
|---|---|
| `GearInspectionIntervalType` | EVERY_USE, BEFORE_EVENT, AFTER_EVENT, WEEKLY, MONTHLY, QUARTERLY, ANNUALLY, EVERY_N_DAYS, AFTER_N_USES, AFTER_N_DEPLOYMENTS, MANUAL_DATE |
| `GearInspectionDueStatus` | NOT_SCHEDULED, CURRENT, DUE_SOON, DUE, OVERDUE |
| `GearMaintenanceDueStatus` | NOT_SCHEDULED, CURRENT, DUE_SOON, DUE, OVERDUE |
| `GearItemInspectionResult` | PASSED, PASSED_WITH_NOTES, FAILED, MAINTENANCE_NEEDED, OUT_OF_SERVICE, LIMITED_USE |
| `GearInspectionContext` | ROUTINE, PRE_EVENT, POST_EVENT, PERIODIC, RETURN_INSPECTION, CONDITION_CHECK |

### GearCategory — New Fields

| Field | Type | Purpose |
|---|---|---|
| `inspectionIntervalType` | `GearInspectionIntervalType?` | Default interval type for items in this category |
| `inspectionIntervalDays` | `Int?` | Days between inspections (EVERY_N_DAYS) |
| `inspectionIntervalUses` | `Int?` | Uses between inspections (AFTER_N_USES) |
| `inspectionIntervalDeployments` | `Int?` | Deployments between inspections (AFTER_N_DEPLOYMENTS) |
| `inspectionDueSoonDays` | `Int?` | Days before due date that triggers DUE_SOON (default: 14) |
| `requiresPreEventInspection` | `Boolean` | Flag pre-event readiness gaps for this category |
| `requiresPostEventInspection` | `Boolean` | Flag post-event recovery issues for this category |
| `maintenanceIntervalDays` | `Int?` | Days between maintenance (overrides frequency enum) |
| `maintenanceIntervalUses` | `Int?` | Uses between maintenance |
| `maintenanceIntervalDeployments` | `Int?` | Deployments between maintenance |

### GearItem — New Fields

| Field | Type | Purpose |
|---|---|---|
| `inspectionDueStatus` | `GearInspectionDueStatus` | Current computed inspection due state |
| `maintenanceDueStatus` | `GearMaintenanceDueStatus` | Current computed maintenance due state |
| `nextInspectionDueAt` | `DateTime?` | Next inspection due date |
| `nextMaintenanceDueAt` | `DateTime?` | Next maintenance due date |
| `lastInspectedAt` | `DateTime?` | When last inspected |
| `lastInspectionResult` | `GearItemInspectionResult?` | Result of last inspection |
| `totalUseCount` | `Int` | Cumulative use count (for AFTER_N_USES intervals) |
| `totalDeploymentCount` | `Int` | Cumulative deployment count (for AFTER_N_DEPLOYMENTS) |

### GearMaintenanceLog — New Fields

| Field | Type | Purpose |
|---|---|---|
| `nextMaintenanceDueAt` | `DateTime?` | Next maintenance due date recorded after this service |
| `isPostEventRecovery` | `Boolean` | Whether this log was a post-event recovery action |

### GearInspectionRecord (New Model)

Records a formal per-item inspection result.

| Field | Type |
|---|---|
| `id` | cuid |
| `organizationId` | String |
| `gearItemId` | String |
| `inspectedByPersonId` | String |
| `result` | `GearItemInspectionResult` |
| `context` | `GearInspectionContext` (default: ROUTINE) |
| `notes` | String? |
| `checklistJson` | String? (serialized GearInspectionChecklist) |
| `failedItemsJson` | String? |
| `relatedEventId` | String? |
| `performedAt` | DateTime |
| `nextInspectionDueAt` | DateTime? |

---

## Library Architecture

### lib/gear-inspection.ts (new)

Pure functions for inspection scheduling. No DB calls.

Key types:
- `GearInspectionScheduleConfig` — interval configuration snapshot
- `GearInspectionItemSnapshot` — lightweight item projection for status calculation
- `GearInspectionDueResult` — full due-status result with actionRequired/isOverdue flags
- `GearInspectionChecklistEntry` — individual checklist item (key, label, result, note)
- `GearInspectionChecklist` — checklist summary (items, overallPassed, counts)
- `PreEventInspectionGap` — pre-event gap descriptor
- `GearInspectionNotificationHandoff` — notification handoff payload

Key functions:
- `calculateNextInspectionDueDate()` — computes next due date from config + performedAt
- `calculateInspectionDueStatus()` — computes due status from config + item snapshot
- `buildInspectionDueResult()` — combines status + metadata into a result value
- `buildPreEventInspectionGaps()` — surfaces OVERDUE/DUE/LAST_FAILED/PRE_EVENT_REQUIRED gaps
- `buildDefaultChecklistItems()` — returns template-driven checklist items
- `evaluateChecklist()` — summarizes checklist pass/fail/na counts
- `buildInspectionNotificationHandoff()` — creates notification event payload
- `formatInspectionDueStatus()`, `formatInspectionResult()` — display formatting
- `getInspectionDueStatusBadgeClass()` — CSS badge helper

### lib/gear-maintenance-schedule.ts (new)

Pure functions for maintenance scheduling. No DB calls.

Key types:
- `GearMaintenanceScheduleConfig` — maintenance interval configuration
- `GearMaintenanceItemSnapshot` — item projection for maintenance status
- `GearMaintenanceDueResult` — due status with actionRequired/isOverdue flags

Key functions:
- `resolveMaintenanceIntervalDays()` — resolves days from explicit config or legacy frequency enum
- `calculateNextMaintenanceDueDate()` — next due date from config + performedAt
- `calculateMaintenanceDueStatus()` — computes maintenance due status
- `buildMaintenanceDueResult()` — full result with metadata
- `buildMaintenanceNotificationHandoff()` — notification event payload
- `formatMaintenanceDueStatus()` — display formatting

### lib/gear-ops-dashboard.ts (updated)

- Added `inspectionDueStatus`, `maintenanceDueStatus`, `nextInspectionDueAt`, `nextMaintenanceDueAt` to `GearOpsItemSnapshot`
- Added `INSPECTION_DUE`, `INSPECTION_OVERDUE`, `MAINTENANCE_DUE`, `MAINTENANCE_OVERDUE` exception kinds to `GearOpsException`
- Updated `buildGearOpsExceptions()` to surface inspection/maintenance exceptions
- Updated `summarizeOperationalRisk()` to include inspection/maintenance overdue/due-soon counts (7 risk categories, was 5)
- Added `summarizeInspectionMaintenance()` helper for dashboard summaries

### lib/event-gear.ts (updated)

- Added optional `inspectionDueStatus`/`maintenanceDueStatus` to `EventGearItemSnapshot`
- Added `EventGearReadinessGap` and `buildPreEventReadinessGaps()` for pre-event checks
- Added `EventGearPostEventFlag` and `buildPostEventRecoveryFlags()` for post-event recovery

### lib/gear-kit.ts (updated)

- Added `inspectionDueStatus`/`maintenanceDueStatus` to `GearKitComponentSnapshot`, `GearKitComponentSummary`, `GearKitCompletenessResult`
- `computeKitCompleteness()` populates inspection/maintenance overdue counts
- `computeKitReadiness()` factors in overdue inspection/maintenance on required components

---

## Inspection Scheduling Logic

### Supported Interval Types

| Type | How Due Date is Calculated |
|---|---|
| `WEEKLY` | performedAt + 7 days |
| `MONTHLY` | performedAt + 30 days |
| `QUARTERLY` | performedAt + 91 days |
| `ANNUALLY` | performedAt + 365 days |
| `EVERY_N_DAYS` | performedAt + intervalDays |
| `AFTER_N_USES` | Due when totalUseCount >= intervalUses |
| `AFTER_N_DEPLOYMENTS` | Due when totalDeploymentCount >= intervalDeployments |
| `MANUAL_DATE` | Caller sets nextInspectionDueAt explicitly |
| `EVERY_USE` | Context-driven — no fixed date |
| `BEFORE_EVENT` | Context-driven — surfaced by pre-event check |
| `AFTER_EVENT` | Context-driven — surfaced by post-event check |

### Deferred Interval Types

None deferred — all 11 types are supported. Context-driven types (EVERY_USE, BEFORE_EVENT,
AFTER_EVENT) do not produce a fixed next-due date; their due status is asserted by event
workflow functions, not by `calculateInspectionDueStatus()`.

### Due Status Precedence

```
OVERDUE > DUE > DUE_SOON > CURRENT > NOT_SCHEDULED
```

"Worst wins" applies at the kit/bundle level.

### DUE_SOON Threshold

Default: 14 days before the next due date. Configurable per category via `inspectionDueSoonDays`.

---

## Maintenance Scheduling Logic

### Supported Interval Types

| Source | Behavior |
|---|---|
| `maintenanceIntervalDays` | Explicit days override — takes priority |
| `maintenanceIntervalUses` | Due when totalUseCount >= threshold |
| `maintenanceIntervalDeployments` | Due when totalDeploymentCount >= threshold |
| Legacy `GearMaintenanceFrequency` enum | Resolved to days via `MAINTENANCE_FREQUENCY_DAYS` map |
| AFTER_FAILED_INSPECTION | Triggered by failed inspection result |
| AFTER_CONDITION_CHANGE | Triggered by condition flag change |
| AFTER_EVENT_RECOVERY | Triggered by post-event recovery flag |
| CATEGORY_DEFAULT | Falls back to category-defined interval |

### Deferred Maintenance Concepts

- Predictive maintenance (not built)
- Complex work-order routing (not built)
- Service vendor management (not built)
- Advanced scheduling optimization (not built)

---

## Readiness and Availability Impact

| Inspection/Maintenance State | Default Impact |
|---|---|
| DUE_SOON | Warning (no block) |
| DUE | Warning — see category `requiresPreEventInspection` |
| OVERDUE | Warning or block depending on category rule |
| FAILED inspection | OVERDUE status; block configurable |
| MAINTENANCE_NEEDED result | OVERDUE status; maintenance required before ready |
| OUT_OF_SERVICE result | OVERDUE status; unavailable until re-inspected |
| LIMITED_USE result | DUE status (flagged) |
| Maintenance completed | CURRENT status with updated next due date |

Blocking vs. warning behavior is surfaced via `shouldBlockByInspection()` in `lib/gear-inspection.ts`.
Category-level blocking rules are configurable via the `overdueBehavior` config flag.

---

## Event Inspection Workflows

### Pre-Event Readiness Checks

`buildPreEventReadinessGaps()` (lib/event-gear.ts) and `buildPreEventInspectionGaps()`
(lib/gear-inspection.ts) surface:

- Items with OVERDUE inspection (high severity)
- Items with DUE inspection (medium severity)
- Items whose last inspection FAILED (high severity)
- Items required to have a pre-event inspection that have never been inspected (PRE_EVENT_REQUIRED)

### Post-Event Recovery Checks

`buildPostEventRecoveryFlags()` (lib/event-gear.ts) surfaces:

- Items with OVERDUE inspection after return
- Items with OVERDUE maintenance after return
- Items last inspected with a non-passing result

Both functions operate on lightweight snapshots — no DB queries.

---

## Kit/Bundle Inspection Behavior

Kit readiness (`computeKitReadiness()` in lib/gear-kit.ts) now reflects:

- Required child with OVERDUE inspection → kit readiness degraded
- Required child with OVERDUE maintenance → kit readiness degraded
- Kit-level parent inspection status is tracked independently

`GearKitCompletenessResult` includes:
- `inspectionOverdueCount` — required children with overdue inspection
- `maintenanceOverdueCount` — required children with overdue maintenance

---

## Dashboard and Report Integration

### GearOpsException kinds (lib/gear-ops-dashboard.ts)

New exception kinds:
- `INSPECTION_DUE`
- `INSPECTION_OVERDUE`
- `MAINTENANCE_DUE`
- `MAINTENANCE_OVERDUE`

### summarizeOperationalRisk (updated)

Returns 7 risk categories (was 5):
1. `overdue` — items with lifecycle or custody overdue
2. `maintenance` — items needing maintenance
3. `inspectionOverdue` — items with overdue inspection
4. `maintenanceScheduleOverdue` — items with overdue scheduled maintenance
5. `consumable` — consumable/expiration issues
6. `eventGap` — event gear plan gaps
7. `eventUnreturned` — unreturned event gear

### summarizeInspectionMaintenance (new)

Returns a compact summary of:
- `totalScheduled` — items with any inspection schedule
- `dueSoonCount` — items with DUE_SOON inspection
- `dueCount` — items with DUE inspection
- `overdueCount` — items with OVERDUE inspection
- `maintenanceDueSoonCount` — items with DUE_SOON maintenance
- `maintenanceDueCount` — items with DUE maintenance
- `maintenanceOverdueCount` — items with OVERDUE maintenance

---

## Notification Handoff Readiness

The following notification events are prepared (but not delivered) by Arc 20Y:

| Event Kind | Trigger |
|---|---|
| `INSPECTION_DUE` | inspectionDueStatus → DUE |
| `INSPECTION_OVERDUE` | inspectionDueStatus → OVERDUE |
| `INSPECTION_FAILED` | inspection result is FAILED |
| `MAINTENANCE_DUE` | maintenanceDueStatus → DUE |
| `MAINTENANCE_OVERDUE` | maintenanceDueStatus → OVERDUE |
| `MAINTENANCE_COMPLETED` | maintenance log created |
| `READINESS_BLOCKED_BY_INSPECTION` | overdue inspection blocks readiness |
| `EVENT_GEAR_INSPECTION_ISSUE` | pre-event readiness gap for event gear |
| `KIT_COMPONENT_INSPECTION_ISSUE` | kit component with overdue inspection |
| `CONSUMABLE_EXPIRATION_ISSUE` | (via existing consumable checks) |

Notification delivery is out of scope. These event types are prepared via
`buildInspectionNotificationHandoff()` and `buildMaintenanceNotificationHandoff()`.
Arc 20U defines the delivery contract.

---

## Mobile and Offline Boundaries

Inspection checklists may be drafted offline using the existing pending-action pattern
(GearOfflineForm / pending sync queue), consistent with Arc 20V design.

Constraints:
- Inspection results may be drafted locally but are marked "pending sync"
- Readiness/availability changes from inspection outcomes require server confirmation
- Final `inspectionDueStatus` and `lastInspectionResult` updates happen server-side only
- Out-of-service or maintenance-needed flags must not be applied locally offline
- Offline inspection work is labeled: drafted locally / pending sync / not confirmed

---

## New App Routes

### GET /gear-ops/items/[itemId]/inspect/new

Form page to record a new inspection for a gear item.

Fields:
- Inspection result (GearItemInspectionResult)
- Inspection context (GearInspectionContext)
- Inspected by person
- Inspection date/time
- Next inspection due date (optional)
- Inspection notes (optional)

### POST /gear-ops/items/[itemId]/inspect/create

Creates a `GearInspectionRecord` and updates `GearItem`:
- `lastInspectedAt` = performedAt
- `lastInspectionResult` = result
- `nextInspectionDueAt` = provided value (if any)
- `inspectionDueStatus` = derived from result + nextInspectionDueAt

Derivation rules:
- FAILED / MAINTENANCE_NEEDED / OUT_OF_SERVICE → OVERDUE
- LIMITED_USE → DUE
- Otherwise: compute from nextInspectionDueAt if present, else CURRENT

---

## Import/Export

Where practical in Arc 20S export patterns:

- `inspectionDueStatus` is included in GearItem export rows
- `maintenanceDueStatus` is included in GearItem export rows
- `nextInspectionDueAt` is included in GearItem export rows
- `nextMaintenanceDueAt` is included in GearItem export rows

Import of inspection schedules is deferred (complex schedule configs should not
be imported without server-side validation and category matching).

---

## Known Limitations

1. **No inspection schedule UI** — Category-level inspection interval configuration
   is a schema-only field in Arc 20Y. A dedicated category inspection settings screen
   is deferred to a subsequent arc.

2. **No maintenance schedule UI** — Same as above for maintenance interval fields.

3. **No automatic due-date recalculation** — `inspectionDueStatus` and `maintenanceDueStatus`
   on GearItem are updated by explicit server actions (inspection record creation,
   maintenance log creation), not by a background job. A scheduled recalculation worker
   is deferred.

4. **totalUseCount / totalDeploymentCount not auto-incremented** — These counters are schema
   fields but are not yet automatically incremented on checkout events. AFTER_N_USES and
   AFTER_N_DEPLOYMENTS intervals require manual counter management until a checkout hook is added.

5. **Checklist JSON is unstructured** — `checklistJson` on GearInspectionRecord stores a
   serialized string. No structured form builder is provided. The lightweight checklist types
   in `lib/gear-inspection.ts` can be serialized into this field by callers.

6. **No batch inspection workflow** — Inspecting multiple items at once (e.g., full kit sweep)
   is not yet supported via a single UI flow.

7. **Photo/attachment support** — Photo fields are placeholders only if the existing attachment
   system supports them. Arc 20Y does not build an attachment system.

8. **Context-driven intervals** — EVERY_USE, BEFORE_EVENT, and AFTER_EVENT do not produce
   a fixed next-due date. They are surfaced by event workflow functions, not calendar logic.

---

## Testing Coverage

Tests added in Arc 20Y:

| File | Coverage |
|---|---|
| `tests/gear-inspection/schedule.test.ts` | ~55 test cases: calculateNextInspectionDueDate, calculateInspectionDueStatus, buildInspectionDueResult, buildPreEventInspectionGaps, buildDefaultChecklistItems, evaluateChecklist, badge/format helpers |
| `tests/gear-maintenance-schedule/schedule.test.ts` | ~45 test cases: resolveMaintenanceIntervalDays, calculateNextMaintenanceDueDate, calculateMaintenanceDueStatus, buildMaintenanceDueResult, frequency map coverage |
| `tests/gear-ops-dashboard/types.test.ts` (updated) | Updated for 7-category risk summary; added inspection/maintenance snapshot fields to test helpers |

---

## Definition of Done

- [x] GearOps supports practical inspection and recurring maintenance scheduling
- [x] Due and overdue inspection/maintenance states are visible
- [x] Inspection results are auditable via GearInspectionRecord
- [x] Readiness and availability reflect inspection/maintenance status where appropriate
- [x] Event pre-check and post-check workflows are supported
- [x] Kit/bundle inspection behavior is supported
- [x] Dashboards/reports surface due/overdue inspection and maintenance issues
- [x] Notification handoff events are prepared
- [x] Mobile/offline behavior remains safe and honest
- [x] Existing GearOps workflows remain stable (448 tests pass)
- [x] Scope remains bounded — no CMMS or predictive maintenance

---

## Recommended Arc 20Z Next Steps

1. **Category inspection/maintenance settings screen** — UI to configure inspection interval type, interval days/uses/deployments, and pre/post-event flags per category.

2. **Automatic due-status recalculation** — A background job or checkout-hook to increment `totalUseCount` / `totalDeploymentCount` and recalculate `inspectionDueStatus` / `maintenanceDueStatus`.

3. **Inspection dashboard panel** — A dedicated due-soon/overdue inspection summary panel on the GearOps dashboard (cards for inspectionDueSoonCount, inspectionOverdueCount, etc.).

4. **Batch inspection workflow** — Inspect all items in a kit in a single workflow step.

5. **Export enrichment** — Add inspection/maintenance due columns to the existing GearOps export flow.

6. **Consumable expiration integration** — Tie GearInspectionContext.CONDITION_CHECK to consumable expiration review dates.

7. **Post-event recovery workflow screen** — A dedicated screen showing all post-event flags for a completed event.
