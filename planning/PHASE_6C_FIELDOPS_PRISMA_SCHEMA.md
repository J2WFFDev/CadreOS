# Phase 6C — FieldOps Prisma Schema

## Goal

Add the initial FieldOps data model to `prisma/schema.prisma` without adding UI, routes, or business workflows.

This phase implements the schema described in [Phase 6B FieldOps Schema Draft](./PHASE_6B_FIELDOPS_SCHEMA_DRAFT.md).

---

## Models Added

### Facility

Physical location where bookable resources exist.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| organizationId | String | FK → Organization |
| name | String | Required |
| description | String? | Optional |
| addressLine1 | String? | Optional |
| addressLine2 | String? | Optional |
| city | String? | Optional |
| state | String? | Optional |
| postalCode | String? | Optional |
| status | FacilityStatus | Default: ACTIVE |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

Relations: Organization, FacilityResource[], ResourceBooking[]

---

### FacilityResource

Schedulable unit within a facility (bay, field, room, etc.).

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| organizationId | String | FK → Organization |
| facilityId | String | FK → Facility |
| name | String | Required |
| resourceType | ResourceType | Required |
| description | String? | Optional |
| capacity | Int? | Optional |
| status | ResourceStatus | Default: ACTIVE |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

Relations: Organization, Facility, ResourceBooking[]

---

### ResourceBooking

Reserved/requested time block for a resource.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| organizationId | String | FK → Organization |
| facilityId | String | FK → Facility |
| resourceId | String | FK → FacilityResource |
| programId | String? | FK → Program (optional) |
| teamId | String? | FK → Team (optional) |
| eventId | String? | FK → Event (optional) |
| requestedByPersonId | String | FK → Person (required) |
| approvedByPersonId | String? | FK → Person (optional) |
| title | String | Required |
| description | String? | Optional |
| startsAt | DateTime | Required |
| endsAt | DateTime | Required |
| status | BookingStatus | Default: DRAFT |
| precheckStatus | PrecheckStatus | Default: NOT_RUN |
| approvalStatus | ApprovalStatus | Default: NOT_REQUIRED |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

Relations: Organization, Facility, FacilityResource, Program?, Team?, Event?, requestedBy Person, approvedBy Person?, BookingConflict[]

---

### BookingConflict

Detected conflict or warning associated with a booking.

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| organizationId | String | FK → Organization |
| bookingId | String | FK → ResourceBooking |
| conflictType | ConflictType | Required |
| severity | ConflictSeverity | Required |
| message | String | Required |
| relatedBookingId | String? | FK → ResourceBooking (optional) |
| createdAt | DateTime | Auto |
| resolvedAt | DateTime? | Optional — set when resolved |

Relations: Organization, ResourceBooking (primary), ResourceBooking? (related)

---

## Enums Added

| Enum | Values |
|---|---|
| FacilityStatus | ACTIVE, INACTIVE, ARCHIVED |
| ResourceStatus | ACTIVE, INACTIVE, MAINTENANCE, ARCHIVED |
| ResourceType | FIELD, RANGE, BAY, ROOM, COURT, EQUIPMENT_AREA, OTHER |
| BookingStatus | DRAFT, REQUESTED, PRECHECK_PASSED, CONFLICT_FOUND, RECOMMENDED, APPROVED, DENIED, CANCELED, COMPLETED |
| PrecheckStatus | NOT_RUN, PASSED, WARNING, FAILED |
| ApprovalStatus | NOT_REQUIRED, PENDING, APPROVED, DENIED |
| ConflictType | RESOURCE_TIME_OVERLAP, FACILITY_BLACKOUT, EVENT_OVERLAP, MISSING_REQUIRED_STAFF, RESOURCE_UNAVAILABLE, CAPACITY_EXCEEDED, POLICY_WARNING |
| ConflictSeverity | INFO, WARNING, BLOCKING |

---

## Indexes Added

### Facility
- `[organizationId]`
- `[organizationId, status]`

### FacilityResource
- `[organizationId]`
- `[facilityId]`
- `[organizationId, facilityId]`
- `[organizationId, status]`

### ResourceBooking
- `[organizationId]`
- `[organizationId, facilityId]`
- `[organizationId, resourceId]`
- `[organizationId, status]`
- `[organizationId, approvalStatus]`
- `[organizationId, eventId]`
- `[resourceId, startsAt]`
- `[resourceId, endsAt]`

### BookingConflict
- `[organizationId]`
- `[bookingId]`
- `[organizationId, bookingId]`
- `[relatedBookingId]`

---

## Deferred Items

### BookingApprovalHistory / BookingApprovalAction

Phase 6B documents `BookingApprovalHistory` as an **optional future audit trail** and the recommended Phase 6C implementation path includes only `Facility`, `FacilityResource`, `ResourceBooking`, and `BookingConflict`. Approval workflow is planned for **Phase 6H**.

Therefore `BookingApprovalHistory` and the `BookingApprovalAction` enum are **deferred to Phase 6H**.

### Conflict Detection Logic

`BookingConflict` records are stored as data, but no application-level conflict detection logic is added. Detection is deferred to **Phase 6G**.

### Approval Workflow Logic

`approvalStatus` field is present on `ResourceBooking` for data readiness, but no approval workflow routes or UI exist yet. Deferred to **Phase 6H**.

### Recurring Bookings

Recurrence support is not included in MVP schema. Deferred to a later phase.

### DB-Level Overlap Exclusion

No `EXCLUDE` constraints or database-level temporal overlap enforcement. Conflict enforcement will be handled in application logic (Phase 6G).

---

## Back-Relations Added to Existing Models

| Model | Relation added |
|---|---|
| Organization | `facilities`, `facilityResources`, `resourceBookings`, `bookingConflicts` |
| Program | `resourceBookings` |
| Team | `resourceBookings` |
| Event | `resourceBookings` |
| Person | `requestedBookings` ("BookingRequestedBy"), `approvedBookings` ("BookingApprovedBy") |

---

## Seed Changes

Minimal idempotent FieldOps demo data added to `prisma/seed.mjs`:

- **1 Facility**: `cadreos-demo-facility` — "Demo Range Complex"
- **2 FacilityResources**:
  - `cadreos-demo-resource-bay-a` — "Bay A" (BAY, 25 yards, capacity 4)
  - `cadreos-demo-resource-bay-b` — "Bay B" (BAY, 50 yards, capacity 4)
- **No bookings seeded** — booking seed deferred to Phase 6D.

All seed records use deterministic fixed IDs and `upsert` for full idempotency.

---

## Migration Notes

- No automatic migration was run as part of Phase 6C.
- **Phase 6D** will run `prisma migrate dev` or `prisma db push` against the live database.
- The schema has been validated with `prisma validate` against Prisma 6.x (the project's installed version).

---

## Next Implementation Phase

**Phase 6D** — Manual DB migration and demo data seed
- Run `prisma migrate dev` or `prisma db push`
- Seed demo FieldOps data with the updated seed file
- Validate seeded records appear correctly

**Phase 6E** — Read-only Facility/Resource/Booking views  
**Phase 6F** — Create booking request workflow  
**Phase 6G** — Basic conflict detection  
**Phase 6H** — Approval workflow (includes BookingApprovalHistory)

---

## Validation Commands

```bash
DATABASE_URL="..." ./node_modules/.bin/prisma validate
npm run typecheck
npm run lint
```

---

## Phase 6C Output Summary

1. **Files changed**
   - `prisma/schema.prisma` — FieldOps enums and models added; back-relations added to Organization, Program, Team, Event, Person
   - `prisma/seed.mjs` — Minimal idempotent FieldOps demo data added
   - `planning/PHASE_6C_FIELDOPS_PRISMA_SCHEMA.md` — This document
   - `planning/README.md` — Phase 6C entry added

2. **Prisma models added**
   - `Facility`
   - `FacilityResource`
   - `ResourceBooking`
   - `BookingConflict`

3. **Enums added**
   - `FacilityStatus`, `ResourceStatus`, `ResourceType`
   - `BookingStatus`, `PrecheckStatus`, `ApprovalStatus`
   - `ConflictType`, `ConflictSeverity`

4. **Seed changes**
   - 1 Facility, 2 FacilityResources; no bookings

5. **Known limitations**
   - No conflict detection logic
   - No approval workflow logic
   - No UI or routes
   - No DB-level overlap constraints
   - `BookingApprovalHistory` deferred to Phase 6H
   - No recurring booking support

6. **Phase 6C status**: ✅ Ready for PR
