# CadreOS Module Roadmap: FieldOps and GearOps

## 1. Core MVP Definition

Core MVP is the set of features required to operate one sports program end-to-end — from onboarding people and assigning roles, through scheduling events and tracking attendance, to capturing notes and closing out follow-up tasks.

### Core MVP Modules

| Module | Purpose |
|---|---|
| **People** | Create and manage persons (athletes, coaches, staff, guardians) |
| **Programs** | Organize work under named programs within an organization |
| **Seasons** | Time-bound containers for program activity |
| **Teams** | Groupings of people within a program and season |
| **Rosters** | Person-to-team assignments with position and status |
| **Roles** | Role definitions and role assignments that control permissions |
| **Events** | Scheduled activities (practices, games, meetings) tied to a team or program |
| **RSVP** | Participant availability signals before an event |
| **Attendance** | Post-event attendance recording and status tracking |
| **Notes** | Structured observations linked to people, teams, or events |
| **Follow-up Tasks** | Actionable items created from notes or events with assignee and due date |
| **Dashboard** | Unified view of pending tasks, upcoming events, and team activity |
| **Authentication** | Verified identity for all users accessing the platform |
| **Authorization** | Role-aware permission enforcement scoped to org, program, or team |

### What Core MVP Delivers

- A program can onboard people and assign roles.
- Staff can build and manage teams and rosters.
- Coaches can schedule events, record attendance, and RSVP outcomes.
- Notes and tasks can be created, assigned, and tracked to closure.
- All actions are gated by authenticated identity and role-based permissions.

---

## 2. FieldOps Module Definition

**FieldOps** is an optional extension module for managing physical spaces and resources used by program activities.

It covers:
- Field, facility, court, range, bay, and venue management.
- Time-slot booking and reservation of physical resources.
- Booking request and approval workflows.
- Conflict detection and resource availability rules.
- Integration with Events so scheduled practices and games are linked to a booked space.

FieldOps does **not** manage people, rosters, or event content. It manages the physical context in which events occur.

---

## 3. GearOps Module Definition

**GearOps** is an optional extension module for managing equipment, consumables, and physical assets owned or tracked by the organization or program.

It covers:
- Inventory item creation and cataloging.
- Equipment assignment to people, teams, or events.
- Consumable stock tracking (decrements on use or distribution).
- Maintenance record logging for equipment lifecycle.
- Check-out and check-in tracking so accountability for gear is clear at all times.

GearOps does **not** manage facilities or booking. It manages portable assets and their assignment and condition.

---

## 4. Core MVP vs Module Scope

The boundary between Core MVP and extension modules follows one rule: **if the program cannot operate without it, it belongs in Core MVP**.

### Belongs in Core MVP

- Managing who people are and what roles they hold.
- Organizing work into programs, seasons, and teams.
- Scheduling events and recording attendance.
- Capturing notes and creating follow-up tasks.
- Controlling access through authentication and role-based authorization.

### Belongs in FieldOps (Extension)

- Defining fields, facilities, bays, ranges, and rooms as bookable resources.
- Requesting and approving time-slot reservations.
- Preventing double-booking through conflict rules.
- Linking event scheduling to a confirmed physical space.

Programs can hold events without FieldOps (using free-text location fields). FieldOps adds structured resource management when a program needs it.

### Belongs in GearOps (Extension)

- Creating an inventory catalog of equipment and consumables.
- Assigning gear to individuals or teams.
- Tracking check-out and check-in of items.
- Logging maintenance and condition history.

Programs can track gear informally through notes without GearOps. GearOps adds structured asset management when accountability and lifecycle tracking become necessary.

### Things That Should Never Be in Either Module

- User identity management or session handling — these belong to the auth layer.
- Person creation or role assignment — these belong to Core MVP People and Roles modules.
- Event creation or attendance recording — these belong to Core MVP Events and Attendance modules.
- Billing, payments, or financial records — explicitly out of scope for the current roadmap.

---

## 5. What Should Not Be Built Before Auth and Authorization Are Complete

Several capabilities depend on a verified identity and enforced role model before they can be built safely. Building them before Phase 4 (auth/authorization) is complete introduces security and data integrity risk.

### Do Not Build Before Auth/Authorization

| Capability | Reason |
|---|---|
| **Booking request and approval** | Approvals require verified identity of the requester and approver; anonymous or mock-user approvals create irreconcilable audit records |
| **Equipment assignment** | Assignments must be attributed to a real linked person; mock attribution breaks accountability chain |
| **Check-out / check-in** | Possession records require a verified actor; without real auth, custody trails are meaningless |
| **Maintenance record authorship** | Log entries require verified staff identity to be auditable |
| **Conflict rule enforcement** | Conflict enforcement has write-side effects (blocking a booking); without enforced authorization, conflict bypass is trivial |
| **Any approval workflow** | Multi-step approval requires that each actor's identity is real, their role is verified, and their actions are scoped to their permission level |

### Safe to Design (but not implement) Before Auth Is Complete

- Entity schemas and Prisma models for FieldOps and GearOps entities.
- Read-only views and inventory catalogs without write-side effects.
- Draft-mode facility and item records visible only to org admins.

---

## 6. Recommended Build Order After Phase 4 Auth

Phase 4 spans sub-phases 4A through 4F. The full auth baseline is complete when:

- Real sign-in/sign-out is wired (Phase 4B).
- `UserAccount` is linked to `Person` (Phase 4C).
- Dashboard routes are protected (Phase 4D).
- Basic authorization checks are enforced (Phase 4E).
- Mock auth constants and first-org fallback are removed (Phase 4F).

### Recommended Sequence After Phase 4F

| Phase | Focus | Rationale |
|---|---|---|
| **5A** | GearOps: Inventory and Assignment MVP | Lower complexity than FieldOps; no conflict detection required; high operational value for programs managing shared gear |
| **5B** | GearOps: Check-out / Check-in and Maintenance Records | Completes GearOps accountability chain before introducing spatial complexity |
| **5C** | FieldOps: Facility and Resource Setup | Define physical spaces before booking logic is built; no approval workflows yet |
| **5D** | FieldOps: Booking and Conflict Rules | Time-slot reservation with conflict detection; builds on stable resource catalog from 5C |
| **5E** | FieldOps: Booking Request and Approval Workflow | Multi-step approval layer on top of confirmed booking model from 5D |
| **5F** | Cross-module integration | Link Event to Booking; link EquipmentAssignment to Event; surface FieldOps and GearOps context in Dashboard |

---

## 7. FieldOps Entity Outline

### Facility

Represents a named physical location owned, leased, or regularly used by the organization.

| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `organizationId` | String | Owning organization; all facilities are org-scoped |
| `name` | String | Human-readable name (e.g., "Riverdale Training Center") |
| `address` | String? | Optional street address |
| `city` | String? | Optional city |
| `notes` | String? | Free-text operational notes |
| `isActive` | Boolean | Whether the facility is available for booking |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Relationships:** A Facility contains one or more Fields/Resources.

---

### Field / Range / Bay / Resource

Represents a bookable sub-unit within a facility (a specific field, shooting range, batting bay, court, or room).

| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `facilityId` | String | Parent facility |
| `name` | String | Human-readable name (e.g., "Field 2", "Range Bay A") |
| `resourceType` | Enum | `FIELD`, `RANGE`, `BAY`, `COURT`, `ROOM`, `OTHER` |
| `capacity` | Int? | Maximum people or concurrent users |
| `isActive` | Boolean | Whether the resource is available for booking |
| `notes` | String? | Free-text operational notes |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Relationships:** A Resource belongs to a Facility and has many Bookings.

---

### Booking

Represents a confirmed time-slot reservation of a Resource.

| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `resourceId` | String | The booked Field/Range/Bay/Resource |
| `programId` | String? | Optional link to the program using the booking |
| `teamId` | String? | Optional link to the team using the booking |
| `eventId` | String? | Optional link to the CadreOS Event this booking supports |
| `requestedById` | String | Person who originated the booking request |
| `approvedById` | String? | Person who confirmed the booking (if approval required) |
| `startTime` | DateTime | Booking window start |
| `endTime` | DateTime | Booking window end |
| `status` | Enum | `PENDING`, `CONFIRMED`, `CANCELLED`, `REJECTED` |
| `notes` | String? | Free-text notes on this booking |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Relationships:** A Booking references a Resource, optionally a Program, Team, and Event, and links two Persons (requester, approver).

---

### BookingRequest

Represents the intake record for a booking before it reaches confirmed status. Separates the request-side workflow from the confirmed-booking record.

| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `resourceId` | String | Requested resource |
| `requestedById` | String | Person requesting the slot |
| `programId` | String? | Program context |
| `teamId` | String? | Team context |
| `proposedStart` | DateTime | Requested window start |
| `proposedEnd` | DateTime | Requested window end |
| `purpose` | String? | Description of intended use |
| `approvalStatus` | Enum | See ApprovalStatus below |
| `reviewedById` | String? | Person who acted on the request |
| `reviewedAt` | DateTime? | When the review action occurred |
| `reviewNotes` | String? | Reviewer's notes |
| `bookingId` | String? | Populated on approval with the resulting Booking id |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

---

### ApprovalStatus

Enum used by BookingRequest (and potentially other approval workflows).

| Value | Meaning |
|---|---|
| `PENDING` | Submitted, awaiting review |
| `APPROVED` | Approved; Booking record created |
| `REJECTED` | Rejected; slot not reserved |
| `CANCELLED` | Requester withdrew the request |
| `NEEDS_INFO` | Reviewer sent back for clarification |

---

### ConflictRule

Defines a time-window constraint on a Resource that prevents double-booking or enforces buffer time.

| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `resourceId` | String | Resource this rule applies to |
| `ruleType` | Enum | `NO_OVERLAP`, `BUFFER_BEFORE`, `BUFFER_AFTER`, `BLACKOUT` |
| `bufferMinutes` | Int? | Used for `BUFFER_BEFORE` / `BUFFER_AFTER` rules |
| `blackoutStart` | DateTime? | Used for `BLACKOUT` rules |
| `blackoutEnd` | DateTime? | Used for `BLACKOUT` rules |
| `notes` | String? | Human-readable explanation of the rule |
| `isActive` | Boolean | |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

---

## 8. GearOps Entity Outline

### InventoryItem

Represents a tracked asset, piece of equipment, or consumable stock item owned by the organization or program.

| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `organizationId` | String | Owning organization |
| `programId` | String? | Optional program scope for program-specific gear |
| `name` | String | Human-readable item name (e.g., "Wilson Batting Helmet", "First Aid Kit") |
| `itemType` | Enum | `EQUIPMENT`, `CONSUMABLE`, `UNIFORM`, `TOOL`, `OTHER` |
| `sku` | String? | Internal or manufacturer SKU |
| `serialNumber` | String? | For serialized equipment |
| `quantityOnHand` | Int | Current available stock count |
| `quantityMin` | Int? | Low-stock threshold for alerts |
| `condition` | Enum | `NEW`, `GOOD`, `FAIR`, `POOR`, `RETIRED` |
| `notes` | String? | Free-text notes |
| `isActive` | Boolean | |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**Relationships:** An InventoryItem has many EquipmentAssignments, ConsumableStock adjustments, MaintenanceRecords, and CheckOut/CheckIn events.

---

### EquipmentAssignment

Records the assignment of an equipment item to a person, team, or event.

| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `inventoryItemId` | String | The assigned item |
| `assignedToPersonId` | String? | Person the item is assigned to |
| `assignedToTeamId` | String? | Team the item is assigned to |
| `assignedToEventId` | String? | Event the item is staged for |
| `assignedById` | String | Person who made the assignment |
| `assignedAt` | DateTime | When the assignment was recorded |
| `expectedReturnAt` | DateTime? | Expected return date for temporary assignments |
| `returnedAt` | DateTime? | Actual return date |
| `status` | Enum | `ASSIGNED`, `RETURNED`, `LOST`, `DAMAGED` |
| `notes` | String? | |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

---

### ConsumableStock

Records a stock adjustment event for a consumable item (replenishment, consumption, or disposal).

| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `inventoryItemId` | String | The consumable item |
| `adjustmentType` | Enum | `RECEIVED`, `USED`, `DISTRIBUTED`, `DISPOSED`, `AUDIT_CORRECTION` |
| `quantity` | Int | Units affected (positive or negative per type) |
| `recordedById` | String | Person recording the adjustment |
| `eventId` | String? | Optional event context for the adjustment |
| `notes` | String? | |
| `adjustedAt` | DateTime | When the stock event occurred |
| `createdAt` | DateTime | |

---

### MaintenanceRecord

Logs a maintenance, inspection, or repair action taken on an equipment item.

| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `inventoryItemId` | String | Item maintained |
| `maintenanceType` | Enum | `INSPECTION`, `REPAIR`, `CLEANING`, `REPLACEMENT`, `RETIREMENT` |
| `performedById` | String | Person who performed or logged the maintenance |
| `performedAt` | DateTime | When maintenance occurred |
| `conditionBefore` | Enum | Condition state before work |
| `conditionAfter` | Enum | Condition state after work |
| `notes` | String | Description of work performed |
| `cost` | Decimal? | Optional cost for expense tracking (not billing) |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

---

### CheckOut / CheckIn

Records the temporary custody transfer of an item to a person, and its subsequent return.

CheckOut and CheckIn are modeled as two records on the same `GearCustodyEvent` table, or as separate `CheckOutEvent` and `CheckInEvent` rows linked by `checkOutId`. The linked model is recommended for clarity.

**CheckOutEvent**

| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `inventoryItemId` | String | Item being checked out |
| `checkedOutById` | String | Person taking custody |
| `issuedById` | String | Staff person issuing the item |
| `checkedOutAt` | DateTime | |
| `expectedReturnAt` | DateTime? | Due date |
| `purposeNotes` | String? | Why the item is being checked out |
| `status` | Enum | `OPEN`, `RETURNED`, `OVERDUE`, `LOST` |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | |

**CheckInEvent**

| Field | Type | Notes |
|---|---|---|
| `id` | String (CUID) | Primary key |
| `checkOutEventId` | String | Links to the originating checkout |
| `inventoryItemId` | String | Item returned |
| `returnedById` | String | Person returning the item |
| `receivedById` | String | Staff person accepting return |
| `returnedAt` | DateTime | |
| `conditionOnReturn` | Enum | Condition at time of return |
| `notes` | String? | |
| `createdAt` | DateTime | |

---

## 9. Dependencies on Current Core MVP Data

Both FieldOps and GearOps are designed as additive modules on top of Core MVP. Neither module replaces or modifies existing Core entities. They reference Core records by foreign key.

### Organization

- **FieldOps**: `Facility.organizationId` — all facilities are scoped to an organization. No cross-org booking.
- **GearOps**: `InventoryItem.organizationId` — all inventory is org-scoped. Org is the top-level accountability boundary for assets.

### Program

- **FieldOps**: `Booking.programId` and `BookingRequest.programId` — bookings can be attributed to a program so usage by program can be reported.
- **GearOps**: `InventoryItem.programId` — gear can be scoped to a specific program (e.g., a program owns its own helmets separate from the org pool).

### Team

- **FieldOps**: `Booking.teamId` and `BookingRequest.teamId` — bookings can be attributed to a specific team for scheduling visibility.
- **GearOps**: `EquipmentAssignment.assignedToTeamId` — gear can be assigned to a team rather than an individual.

### Person

- **FieldOps**: `Booking.requestedById`, `Booking.approvedById`, `BookingRequest.requestedById`, `BookingRequest.reviewedById` — every booking action requires a real, linked Person identity.
- **GearOps**: `EquipmentAssignment.assignedToPersonId`, `EquipmentAssignment.assignedById`, `ConsumableStock.recordedById`, `MaintenanceRecord.performedById`, `CheckOutEvent.checkedOutById`, `CheckOutEvent.issuedById`, `CheckInEvent.returnedById`, `CheckInEvent.receivedById` — all custody, assignment, and maintenance records require verified Person attribution.

### Event

- **FieldOps**: `Booking.eventId` — a confirmed Event can be linked to a Booking so the event's scheduled time is backed by a confirmed resource reservation.
- **GearOps**: `EquipmentAssignment.assignedToEventId`, `ConsumableStock.eventId` — gear can be staged for or consumed at a specific event.

### Task (Follow-up Task)

- **FieldOps**: Future maintenance or facility-issue tasks may reference a `Facility` or `Resource` as their subject context. Not a hard dependency for initial FieldOps build but a natural extension point.
- **GearOps**: Overdue check-outs and low-stock alerts could generate follow-up Tasks. This integration is not required for initial GearOps build but is the natural escalation path for unresolved gear issues.

---

## 10. Build Order Recommendation: FieldOps vs GearOps

### Recommendation: Build GearOps First

**Build GearOps before FieldOps** after Core MVP and Phase 4 auth are complete.

#### Reasons to Build GearOps First

1. **Lower complexity.** GearOps has no conflict detection, no approval workflow, and no spatial scheduling logic. Inventory and assignment are straightforward CRUD with attribution requirements.

2. **Higher immediate operational value.** Programs managing shared gear (helmets, bats, med kits, radios, uniforms) feel the pain of untracked assignments immediately. GearOps solves a present problem for most programs.

3. **Auth dependency is simpler to satisfy.** GearOps requires verified Person attribution for assignments and check-outs. This is exactly what Phase 4C (UserAccount linking) and Phase 4E (authorization checks) provide. No approval workflow is needed.

4. **Builds confidence in the module extension pattern.** GearOps introduces the pattern of additive module data (org-scoped inventory, cross-referenced Core entities, auditable transactions) before FieldOps adds multi-step approval logic on top.

5. **FieldOps requires a stable Event model.** Booking-to-Event linkage is a key FieldOps value. The Event model should be hardened through real usage before FieldOps introduces the requirement for confirmed resource reservations. GearOps creates that additional usage cycle.

#### Why FieldOps Is Second

1. **Conflict detection is complex.** Preventing double-booking requires time-window overlap queries and conflict rule evaluation — more logic surface than inventory CRUD.

2. **Approval workflow requires mature auth.** Multi-step approval (requester → reviewer → confirmer) requires role verification that must be proven stable through real Phase 4E/4F usage before approval workflow is layered on.

3. **Not all programs need it immediately.** Programs with informal venue arrangements (borrowed fields, public parks) have no need for FieldOps. GearOps applies more broadly across program types.

#### Summary

| Decision | Recommendation |
|---|---|
| First extension module | **GearOps** |
| Second extension module | **FieldOps** |
| Prerequisite for both | Phase 4F (auth complete, mock auth removed) |
| FieldOps prerequisite | Phase 5B GearOps complete (proves module pattern) |
