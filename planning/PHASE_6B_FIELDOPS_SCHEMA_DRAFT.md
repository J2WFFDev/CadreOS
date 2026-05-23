# Phase 6B — FieldOps Schema Draft

## Goal

Define the proposed FieldOps data model before implementation. This is schema planning only and does not change application code, live Prisma schema, migrations, routes, or UI.

The proposed model is intended to support:

- facilities
- resources
- bookings
- booking requests
- pre-checks
- conflict detection
- recommendations
- human approval
- future Event linkage

## Existing Core MVP Dependencies

FieldOps remains strictly organization-scoped and must align to existing Core MVP entities:

- **Organization**: ownership boundary for all FieldOps records.
- **Program**: optional booking context and authorization scoping.
- **Season**: optional operational context for planning/reporting.
- **Team**: optional booking context and authorization scoping.
- **Person**: requester/approver attribution and activity traceability.
- **Event**: optional linkage target for schedule coordination.
- **Task**: follow-up/remediation workflow from conflicts or failed pre-checks.
- **RoleAssignment**: authorization source for who can request/manage/approve bookings.

## Proposed MVP Entities (Conceptual Prisma-Style Draft)

```prisma
model Facility {
  id            String         @id @default(cuid())
  organizationId String
  name          String
  description   String?
  addressLine1  String?
  addressLine2  String?
  city          String?
  state         String?
  postalCode    String?
  status        FacilityStatus
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  // Relations
  organization  Organization
  resources     FacilityResource[]
}
```

- **Purpose**: Physical location/facility (range, school field, gym, practice complex, meeting location).
- **Relationships**: Organization, FacilityResource[].

```prisma
model FacilityResource {
  id             String          @id @default(cuid())
  organizationId String
  facilityId     String
  name           String
  resourceType   ResourceType
  description    String?
  capacity       Int?
  status         ResourceStatus
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  // Relations
  organization   Organization
  facility       Facility
  bookings       ResourceBooking[]
}
```

- **Purpose**: Schedulable unit in a facility (range bay, field, court, classroom, meeting room, trailer spot).
- **Relationships**: Organization, Facility, ResourceBooking[].

```prisma
model ResourceBooking {
  id                String            @id @default(cuid())
  organizationId    String
  facilityId        String
  resourceId        String
  programId         String?
  teamId            String?
  eventId           String?
  requestedByPersonId String
  approvedByPersonId  String?
  title             String
  description       String?
  startsAt          DateTime
  endsAt            DateTime
  status            BookingStatus
  precheckStatus    PrecheckStatus
  approvalStatus    ApprovalStatus
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  // Relations
  organization      Organization
  facility          Facility
  resource          FacilityResource
  program           Program?
  team              Team?
  event             Event?
  requestedBy       Person
  approvedBy        Person?
  conflicts         BookingConflict[]
}
```

- **Purpose**: Reserved/requested time block for a resource.
- **Relationships**: Organization, Facility, FacilityResource, Program?, Team?, Event?, requestedBy Person, approvedBy Person?, BookingConflict[].

```prisma
model BookingConflict {
  id               String            @id @default(cuid())
  organizationId   String
  bookingId        String
  conflictType     ConflictType
  severity         ConflictSeverity
  message          String
  relatedBookingId String?
  createdAt        DateTime          @default(now())
  resolvedAt       DateTime?

  // Relations
  organization     Organization
  booking          ResourceBooking
  relatedBooking   ResourceBooking?
}
```

- **Purpose**: Detected conflict/warning for a booking.
- **Relationships**: Organization, ResourceBooking, related ResourceBooking?.

```prisma
model BookingApprovalHistory {
  id             String               @id @default(cuid())
  organizationId String
  bookingId      String
  actorPersonId  String
  action         BookingApprovalAction
  note           String?
  createdAt      DateTime             @default(now())

  // Relations
  organization   Organization
  booking        ResourceBooking
  actor          Person
}
```

- **Purpose**: Optional future audit trail for approval/denial actions.
- **Relationships**: Organization, ResourceBooking, Person.

## Proposed Enums

```prisma
enum FacilityStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

enum ResourceStatus {
  ACTIVE
  INACTIVE
  MAINTENANCE
  ARCHIVED
}

enum ResourceType {
  FIELD
  RANGE
  BAY
  ROOM
  COURT
  EQUIPMENT_AREA
  OTHER
}

enum BookingStatus {
  DRAFT
  REQUESTED
  PRECHECK_PASSED
  CONFLICT_FOUND
  RECOMMENDED
  APPROVED
  DENIED
  CANCELED
  COMPLETED
}

enum PrecheckStatus {
  NOT_RUN
  PASSED
  WARNING
  FAILED
}

enum ApprovalStatus {
  NOT_REQUIRED
  PENDING
  APPROVED
  DENIED
}

enum ConflictType {
  RESOURCE_TIME_OVERLAP
  FACILITY_BLACKOUT
  EVENT_OVERLAP
  MISSING_REQUIRED_STAFF
  RESOURCE_UNAVAILABLE
  CAPACITY_EXCEEDED
  POLICY_WARNING
}

enum ConflictSeverity {
  INFO
  WARNING
  BLOCKING
}

enum BookingApprovalAction {
  REQUESTED
  APPROVED
  DENIED
  CANCELED
  COMMENTED
}
```

## Conflict Detection Rules

### MVP rules

- same resource cannot have overlapping approved bookings
- requested booking should detect overlap with approved or pending bookings
- booking end must be after start
- resource must be active
- facility must be active

### Later rules

- blackout dates
- minimum required staff
- Safety Officer requirement
- capacity checks
- weather/status constraints
- recurring conflict handling
- equipment dependency conflicts

## Booking Lifecycle

### Simple MVP path

`DRAFT → REQUESTED → APPROVED → COMPLETED`

### With conflict path

`REQUESTED → CONFLICT_FOUND → RECOMMENDED → APPROVED` or `DENIED`

### Canceled path

`REQUESTED → CANCELED` or `APPROVED → CANCELED`

## Event Relationship

### Design answers

- **Can an Event exist without a Booking?** Yes.
- **Can a Booking exist without an Event?** Yes.
- **Should booking approval create or update an Event?** Not required in MVP.
- **Should Event creation optionally request a Booking?** Yes, as a future optional flow.

### Recommended MVP position

- Event can exist without Booking.
- Booking can optionally link to Event.
- Do not require every Event to have a Booking yet.
- Future FieldOps may allow creating Event from approved Booking.

## Authorization Assumptions

Use current auth path:

`Clerk User → UserAccount → Person → RoleAssignments → Scoped Authorization`

Suggested MVP rules:

- ORGANIZATION_ADMIN can manage all FieldOps records.
- PROGRAM_DIRECTOR can request/manage bookings for their program.
- COACH can request bookings for their team/program.
- ASSISTANT_COACH may view bookings and may request later by policy.
- PARENT_GUARDIAN and ATHLETE do not manage FieldOps in MVP.

## Indexing / Constraints (Conceptual)

- index `organizationId` on all FieldOps entities
- index `facilityId` for facility-resource and booking access patterns
- index `resourceId, startsAt` and `resourceId, endsAt` for conflict queries
- optional index `eventId` on `ResourceBooking`
- index status fields used in queues/lists (`status`, `precheckStatus`, `approvalStatus`)
- no hard DB-level overlap exclusion for MVP unless safely supported in target DB
- conflict enforcement initially handled in application logic

## Migration Risks

- time zone handling for starts/ends and display consistency
- robust overlap enforcement under concurrent booking requests
- recurring booking complexity and exception handling
- Event/Booking duplication or drift between linked records
- approval audit growth and query complexity over time
- status model inflation too early in MVP
- resource type overfitting to shooting-sports-only language

## Recommended Implementation Path

- **Phase 6C**: Add Prisma schema for `Facility`, `FacilityResource`, `ResourceBooking`, `BookingConflict`
- **Phase 6D**: Manual DB migration / db push and seed demo FieldOps data
- **Phase 6E**: Read-only Facility/Resource/Booking views
- **Phase 6F**: Create booking request workflow
- **Phase 6G**: Basic conflict detection
- **Phase 6H**: Approval workflow

## Open Decisions

- Should resource bookings support recurrence in MVP?
- Should approval be required for all bookings?
- Should resources be hierarchical beyond Facility → Resource?
- Should GearOps resources be separate from FieldOps resources?
- Should bookings be linked to Events at creation or after approval?
- Should FieldOps support public calendar sharing?
- How should time zones be stored/displayed?

## Output

1. **Files changed**
   - `planning/PHASE_6B_FIELDOPS_SCHEMA_DRAFT.md`
   - `planning/README.md`
2. **Proposed FieldOps models**
   - `Facility`
   - `FacilityResource`
   - `ResourceBooking`
   - `BookingConflict`
   - `BookingApprovalHistory` (optional future audit trail)
3. **Proposed enums**
   - `FacilityStatus`, `ResourceStatus`, `ResourceType`
   - `BookingStatus`, `PrecheckStatus`, `ApprovalStatus`
   - `ConflictType`, `ConflictSeverity`, `BookingApprovalAction`
4. **Key open decisions**
   - recurrence, approval requirement, hierarchy depth, GearOps split, Event link timing, public calendar sharing, timezone strategy
5. **Recommended next phase**
   - **Phase 6C**: Prisma schema addition for core FieldOps entities
