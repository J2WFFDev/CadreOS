# CadreOS *Ops Domain Architecture
## Naming System, FieldOps & ResourceOps Separation, Platform Primitives

> **Document type:** Architecture reference — not phase-bound. No schema or runtime changes.  
> **Audience:** Platform architects, Copilot agents, PRD authors, API designers, schema planners.

---

## Context and Purpose

CadreOS is not a team management app.  
It is an **operational operating system** for sports organizations, training academies, volunteer corps, ranges, clubs, and multi-role organizations.

Every major capability in CadreOS is expressed as an `*Ops` domain — a bounded, event-driven, permission-aware module with clear ownership, defined APIs, and explicit relationships to adjacent domains.

This document:

1. Formalizes the `*Ops` naming system.
2. Defines every domain's purpose, ownership, and boundaries.
3. Separates **ResourceOps** from **FieldOps** with a complete comparison matrix.
4. Provides detailed design for both ResourceOps and FieldOps.
5. Defines shared platform primitives.
6. Specifies event naming, database strategy, UI naming, and phased rollout guidance.

---

## A Note on Existing FieldOps Implementation (Phases 6A–6K)

> **IMPORTANT:** The FieldOps module built in Phases 6A–6K implements what this document formally names **ResourceOps** — facility management, booking requests, conflict detection, and approval workflows.
>
> Going forward:
> - The Phase 6A–6K implementation is **ResourceOps infrastructure**.
> - A new **FieldOps** module will own live operational execution: practices, athlete check-in, drill rotations, and game-day workflows.
> - Existing route paths, model names, and UI labels should be migrated in a future refactor phase. No immediate runtime changes are required.

---

## Section 1 — CadreOS Domain Architecture

### 1.1 Why `*Ops` Naming Exists

The `*Ops` convention signals:

- **Operational clarity** — each module name communicates what it manages, not how it looks.
- **Domain ownership** — one module owns one operational concern completely.
- **AI-agent readiness** — agents can reason about which `*Ops` module handles a task without ambiguity.
- **Extensibility** — new domains follow the pattern without breaking existing contracts.
- **Internal vs user-facing separation** — `*Ops` names are internal architecture names; the UI uses plain language.

### 1.2 Naming Standards

| Context | Convention | Example |
|---------|-----------|---------|
| Module internal name | `PascalCase + Ops` | `ResourceOps`, `FieldOps` |
| API route prefix | `kebab-case` | `/api/resource-ops/`, `/api/field-ops/` |
| Database table prefix | `snake_case` | `resource_reservation`, `field_session` |
| Prisma model prefix | `PascalCase` | `ResourceReservation`, `FieldSession` |
| Event name | `domain.noun.verb` | `resource.reservation.created` |
| Package/folder name | `kebab-case` | `lib/resource-ops/`, `app/(dashboard)/field-ops/` |
| UI label (sidebar/nav) | Plain language | `Facilities`, `Field Operations` |

### 1.3 Full Domain Architecture Table

| Domain | Purpose | Owns | Depends On |
|--------|---------|------|------------|
| **IdentityOps** | Authentication, user accounts, person linkage, session management | `UserAccount`, `Person` (identity layer), `Session`, `OrgMembership` | — (foundation layer) |
| **TeamOps** | Roster, teams, programs, seasons, member lifecycle, role assignments | `Team`, `Program`, `Season`, `RoleAssignment`, `AthleteProfile`, `MemberStatus` | IdentityOps |
| **ResourceOps** | Facilities, reservable spaces, scheduling, reservation management, access governance | `Resource`, `ResourceGroup`, `Reservation`, `ReservationPolicy`, `ResourceAvailability`, `OccupancyEvent` | IdentityOps, TeamOps |
| **FieldOps** | Live operational execution: practices, game-day, athlete check-in, drills, incidents | `PracticeSession`, `DrillRotation`, `AthleteAssignment`, `CoachAssignment`, `CheckIn`, `Incident`, `Stage`, `Squad` | TeamOps, ResourceOps, GearOps, CommOps |
| **GearOps** | Portable asset accountability, equipment inventory, consumables, custody tracking | `GearItem`, `GearCategory`, `GearAssignment`, `CustodyRecord`, `ConsumableTransaction`, `MaintenanceLog` | IdentityOps, TeamOps |
| **WorkflowOps** | Approval engines, workflow templates, state machines, assignment queues | `Workflow`, `WorkflowStep`, `ApprovalRequest`, `ApprovalDecision`, `WorkflowAssignment` | All domains (shared primitive provider) |
| **CommOps** | Notifications, messaging, announcements, delivery channels | `Message`, `Notification`, `NotificationChannel`, `Announcement`, `MessageThread` | IdentityOps, TeamOps |
| **ComplianceOps** | Consent documents, qualifications, certifications, waivers, audit trails | `ConsentDocument`, `Qualification`, `Certification`, `ComplianceRecord`, `AuditEvent` | IdentityOps, TeamOps, WorkflowOps |
| **EventOps** | Scheduled events, RSVP, availability, event attendance, event lifecycle | `Event`, `EventRSVP`, `AttendanceRecord`, `EventStatus` | TeamOps, ResourceOps, CommOps |
| **AnalyticsOps** | Operational metrics, dashboards, trend analysis, readiness scoring, reporting | `MetricSnapshot`, `Dashboard`, `Report`, `ReadinessScore` | All domains (read-only consumer) |

---

## Section 2 — FieldOps vs ResourceOps Comparison Matrix

> These are NOT the same module. They share a boundary but own entirely separate concerns.

| Capability | ResourceOps | FieldOps | Shared | Notes |
|------------|-------------|----------|--------|-------|
| Facility record management | ✅ Owns | ❌ | — | ResourceOps creates/edits facilities |
| Space/bay/field record management | ✅ Owns | ❌ | — | ResourceOps manages the physical asset |
| Reservation creation | ✅ Owns | ❌ | — | FieldOps requests/consumes a reservation |
| Reservation scheduling | ✅ Owns | ❌ | — | Time-slots, availability windows |
| Reservation approval workflow | ✅ Owns (via WorkflowOps) | ❌ | — | ResourceOps drives approval policy |
| Conflict detection | ✅ Owns | ❌ | — | Resource-level time conflict logic |
| Occupancy tracking | ✅ Owns | ❌ | — | Current headcount vs capacity |
| Access governance / qualification rules | ✅ Owns | ❌ | — | Who may reserve a bay |
| Recurring reservation management | ✅ Owns | ❌ | — | Season schedules, standing reservations |
| Resource availability windows | ✅ Owns | ❌ | — | Operating hours, blackout dates |
| Calendar / booking view | ✅ Owns | 📖 Reads | — | FieldOps reads the calendar, doesn't own it |
| Practice session creation | ❌ | ✅ Owns | — | FieldOps creates and manages sessions |
| Game-day / match operations | ❌ | ✅ Owns | — | Live event coordination |
| Athlete check-in | ❌ | ✅ Owns | — | Arrival confirmation per session |
| Coach attendance | ❌ | ✅ Owns | — | Coach sign-in and assignment |
| Drill rotation management | ❌ | ✅ Owns | — | Station/stage progression logic |
| Station / stage assignments | ❌ | ✅ Owns | — | Athlete-to-station mapping |
| Squad management | ❌ | ✅ Owns | — | Intra-practice groupings |
| Safety briefing completion | ❌ | ✅ Owns | — | Documented pre-event safety checks |
| Incident tracking | ❌ | ✅ Owns | — | On-site incidents during operations |
| Incident escalation | ❌ | ✅ Owns (via WorkflowOps) | — | Escalation to compliance/admin |
| Attendance record creation | ❌ | ✅ Owns | 🔗 EventOps reads | FieldOps writes operational attendance |
| Live scoring support | ❌ | ✅ Owns | — | Score entry, stage results |
| Operational notes | ❌ | ✅ Owns | — | Real-time field notes |
| Qualification check before entry | 📖 Reads | 📖 Reads | ✅ ComplianceOps owns | Both modules enforce, neither owns |
| Role-based permissions | 📖 Reads | 📖 Reads | ✅ IdentityOps owns | Permissions enforced by WorkflowOps/IdentityOps |
| Notifications on booking / session events | 📤 Emits | 📤 Emits | ✅ CommOps delivers | Both emit events; CommOps delivers |
| Audit logging | 📤 Emits | 📤 Emits | ✅ ComplianceOps owns | All actions emit audit events |
| Calendar display (UI) | ✅ Provides | 📖 Reads | — | ResourceOps is the canonical calendar source |

---

## Section 3 — ResourceOps Detailed Design

### 3.1 Purpose

ResourceOps is the **infrastructure scheduling and reservation management** domain.

It governs every physical or logical resource that can be reserved, scheduled, or occupied. It does not execute operational activity — it provides the infrastructure that operational modules (FieldOps, EventOps) consume.

### 3.2 Core Features

- Facility and resource catalog management (CRUD)
- Resource availability window configuration
- Reservation request creation and lifecycle
- Conflict detection and resolution
- Recurring reservation support
- Approval workflow integration (via WorkflowOps)
- Occupancy tracking and capacity enforcement
- Qualification requirement enforcement before reservation
- Resource access governance (who can reserve what)
- Audit trail for all reservation state changes
- Mobile-first reservation management

### 3.3 Technical Architecture

```
ResourceOps
├── lib/resource-ops/
│   ├── availability.ts         # Availability window logic
│   ├── conflict-detection.ts   # Time-overlap conflict engine
│   ├── reservation-policy.ts   # Policy evaluation
│   ├── qualification-check.ts  # Pre-reservation qualification gate
│   ├── recurrence.ts           # Recurring reservation expansion
│   └── occupancy.ts            # Real-time occupancy tracking
├── app/(dashboard)/resource-ops/
│   ├── page.tsx                # Resource catalog overview
│   ├── [resourceId]/page.tsx   # Resource detail + calendar
│   ├── reservations/
│   │   ├── page.tsx            # Reservation list
│   │   ├── create/route.ts     # Create reservation
│   │   └── [reservationId]/    # Reservation detail + state
│   └── admin/
│       ├── resources/          # Resource CRUD (admin only)
│       └── policies/           # Policy configuration
└── app/api/resource-ops/
    ├── resources/route.ts
    ├── reservations/route.ts
    └── availability/route.ts
```

### 3.4 Data Models

```prisma
// Core resource entity
model Resource {
  id               String           @id @default(cuid())
  organizationId   String
  groupId          String?
  name             String
  type             ResourceType     // FIELD, BAY, COURT, RANGE, ROOM, VEHICLE, STORAGE, OTHER
  description      String?
  capacity         Int?
  location         String?
  status           ResourceStatus   // ACTIVE, MAINTENANCE, INACTIVE, RETIRED
  requiresApproval Boolean          @default(false)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  organization     Organization     @relation(fields: [organizationId], references: [id])
  group            ResourceGroup?   @relation(fields: [groupId], references: [id])
  availability     ResourceAvailability[]
  reservations     Reservation[]
  qualificationRules ResourceQualificationRule[]
  occupancyEvents  OccupancyEvent[]
  policies         ReservationPolicy[]
}

model ResourceGroup {
  id             String     @id @default(cuid())
  organizationId String
  name           String
  description    String?
  createdAt      DateTime   @default(now())
  resources      Resource[]
}

model Reservation {
  id               String              @id @default(cuid())
  organizationId   String
  resourceId       String
  requestedById    String              // Person who requested
  approvedById     String?
  teamId           String?
  eventId          String?             // Optional link to EventOps
  title            String
  purpose          String?
  startTime        DateTime
  endTime          DateTime
  status           ReservationStatus   // PENDING, APPROVED, DENIED, CANCELLED, EXPIRED, ACTIVE, COMPLETED
  recurrenceRuleId String?
  notes            String?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  resource         Resource            @relation(fields: [resourceId], references: [id])
  requestedBy      Person              @relation("ReservationRequester", fields: [requestedById], references: [id])
  approvedBy       Person?             @relation("ReservationApprover", fields: [approvedById], references: [id])
  recurrenceRule   ReservationRecurrenceRule? @relation(fields: [recurrenceRuleId], references: [id])
  conflicts        ReservationConflict[]
}

model ReservationPolicy {
  id                  String   @id @default(cuid())
  resourceId          String
  name                String
  minAdvanceNoticeHrs Int      @default(0)
  maxAdvanceBookingDays Int    @default(365)
  maxDurationMinutes  Int?
  allowRecurring      Boolean  @default(false)
  requiresApproval    Boolean  @default(false)
  allowedRoles        String[] // Role names that may reserve
  createdAt           DateTime @default(now())

  resource            Resource @relation(fields: [resourceId], references: [id])
}

model ResourceAvailability {
  id          String   @id @default(cuid())
  resourceId  String
  dayOfWeek   Int?     // 0 = Sunday … 6 = Saturday; null = one-off
  date        DateTime?
  openTime    String   // HH:MM
  closeTime   String   // HH:MM
  isBlackout  Boolean  @default(false)
  note        String?

  resource    Resource @relation(fields: [resourceId], references: [id])
}

model ResourceQualificationRule {
  id                  String   @id @default(cuid())
  resourceId          String
  qualificationTypeId String
  required            Boolean  @default(true)
  description         String?

  resource            Resource @relation(fields: [resourceId], references: [id])
}

model OccupancyEvent {
  id           String   @id @default(cuid())
  resourceId   String
  reservationId String?
  personId     String?
  type         OccupancyEventType  // CHECK_IN, CHECK_OUT, CAPACITY_EXCEEDED
  timestamp    DateTime @default(now())
  headcount    Int?

  resource     Resource   @relation(fields: [resourceId], references: [id])
}

model ReservationConflict {
  id              String   @id @default(cuid())
  reservationId   String
  conflictingId   String
  detectedAt      DateTime @default(now())
  resolution      ConflictResolution? // ACCEPTED, OVERRIDDEN, RESCHEDULED

  reservation     Reservation @relation(fields: [reservationId], references: [id])
}

model ReservationRecurrenceRule {
  id           String   @id @default(cuid())
  rrule        String   // iCalendar RRULE string
  until        DateTime?
  count        Int?
  reservations Reservation[]
}
```

### 3.5 APIs

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/resource-ops/resources` | List resources (org-scoped) | Staff |
| POST | `/api/resource-ops/resources` | Create resource | Admin |
| GET | `/api/resource-ops/resources/[id]` | Resource detail | Staff |
| PATCH | `/api/resource-ops/resources/[id]` | Update resource | Admin |
| GET | `/api/resource-ops/resources/[id]/availability` | Availability windows | Staff |
| GET | `/api/resource-ops/reservations` | List reservations | Staff |
| POST | `/api/resource-ops/reservations` | Create reservation request | Staff |
| GET | `/api/resource-ops/reservations/[id]` | Reservation detail | Staff |
| PATCH | `/api/resource-ops/reservations/[id]/status` | Approve / deny / cancel | Admin/Approver |
| GET | `/api/resource-ops/availability` | Check availability for time range | Staff |
| POST | `/api/resource-ops/conflict-check` | Run conflict detection | Staff |

### 3.6 Events

```
resource.created
resource.updated
resource.status.changed
resource.availability.updated
resource.qualification_rule.added
resource.reservation.created
resource.reservation.approved
resource.reservation.denied
resource.reservation.cancelled
resource.reservation.expired
resource.reservation.completed
resource.conflict.detected
resource.conflict.resolved
resource.occupancy.check_in
resource.occupancy.check_out
resource.occupancy.capacity_exceeded
```

### 3.7 Permissions

| Action | Required Role |
|--------|--------------|
| View resource catalog | Staff, Coach |
| Create reservation request | Staff, Coach |
| Approve / deny reservation | Admin, ResourceManager |
| Edit resource record | Admin |
| Configure availability | Admin, ResourceManager |
| Configure policies | Admin |
| View occupancy | Staff, Coach |
| Override conflict | Admin |

### 3.8 State Machine — Reservation

```
PENDING
  → APPROVED   (by approver, no conflict OR override granted)
  → DENIED     (by approver)
  → CANCELLED  (by requester before approval)
  → EXPIRED    (approval window elapsed)

APPROVED
  → ACTIVE     (start time reached, auto-transition)
  → CANCELLED  (cancelled before start)

ACTIVE
  → COMPLETED  (end time reached, auto-transition)
  → CANCELLED  (emergency cancellation)
```

### 3.9 State Machine — Resource

```
ACTIVE
  → MAINTENANCE (admin places into maintenance)
  → INACTIVE    (admin deactivates)

MAINTENANCE
  → ACTIVE      (maintenance cleared)

INACTIVE
  → ACTIVE      (re-activated)
  → RETIRED     (permanently decommissioned)
```

### 3.10 Mobile Requirements

- Reservation request form optimized for thumb reach
- Calendar day/week view with swipe navigation
- Quick-check availability tap flow (select resource → pick time → confirm)
- Push notification for reservation approval / denial
- Offline: queue reservation request, sync on reconnect
- Coach view: see own team's upcoming reservations

### 3.11 Audit Requirements

Every state change on `Reservation` and `Resource` emits an `AuditEvent` record containing: actor person ID, entity type, entity ID, previous state, new state, timestamp, and IP/session context.

### 3.12 Automation Opportunities

- Auto-release reservation if no check-in within N minutes of start time
- Auto-notify requestor when reservation approaches start time
- Auto-detect and flag recurring conflicts at reservation creation
- Auto-deny if requestor lacks required qualification
- Auto-suggest alternative time slots when conflict detected

### 3.13 AI-Agent Opportunities

- "Find the next available bay for Team A on Tuesday afternoon" → agent queries availability API and returns options
- "Approve all pending reservations for next week" → agent iterates pending reservations and invokes approval API
- "Alert me if Range 3 is double-booked" → agent subscribes to `resource.conflict.detected` events
- "Create a recurring Saturday morning practice reservation for the entire season" → agent expands recurrence rule

### 3.14 Sample Workflows

**Reserve a bay:**
1. Staff selects resource and desired time slot.
2. System runs conflict detection via `conflict-detection.ts`.
3. System evaluates `ReservationPolicy` (advance notice, duration, role eligibility).
4. System checks `ResourceQualificationRule` against requestor's qualifications.
5. If `requiresApproval = true`, reservation enters `PENDING` state; `resource.reservation.created` event emitted.
6. If `requiresApproval = false`, reservation auto-approves; `resource.reservation.approved` emitted.
7. CommOps delivers notification to requestor.

**Approve reservation:**
1. Approver receives notification (via CommOps).
2. Approver reviews reservation detail.
3. Approver approves or denies; `resource.reservation.approved` or `resource.reservation.denied` emitted.
4. CommOps notifies requestor.

**Conflict detection:**
1. New reservation request arrives.
2. Engine queries existing `PENDING` or `APPROVED` reservations overlapping the same resource and time window.
3. If overlap found, `ReservationConflict` record created; `resource.conflict.detected` emitted.
4. Reservation may still proceed to `PENDING` (conflict surfaced to approver) or auto-deny based on policy.

**Auto-release unused resource:**
1. Scheduled job runs at `reservation.startTime + gracePeriodMinutes`.
2. If no `OccupancyEvent CHECK_IN` recorded, `resource.reservation.expired` emitted.
3. Reservation transitions to `EXPIRED`; resource becomes available.
4. CommOps notifies original requestor.

---

## Section 4 — FieldOps Detailed Design

### 4.1 Purpose

FieldOps is the **live operational execution** domain.

It manages what happens on the field, range, court, or training environment during a scheduled operational session. It consumes reservations from ResourceOps, rosters from TeamOps, and gear from GearOps — but it owns the execution layer completely.

### 4.2 Core Features

- Practice session creation and lifecycle management
- Game-day / match operations workflow
- Athlete check-in (arrival confirmation)
- Coach assignment and attendance
- Drill rotation and station assignment management
- Squad / grouping management within a session
- Safety briefing completion tracking
- Live operational notes
- Incident tracking and escalation
- Live scoring support (stage results)
- Session closeout and summary generation

### 4.3 Technical Architecture

```
FieldOps
├── lib/field-ops/
│   ├── session.ts              # Session lifecycle helpers
│   ├── check-in.ts             # Athlete check-in logic
│   ├── drill-rotation.ts       # Rotation sequencing engine
│   ├── station-assignment.ts   # Athlete-to-station mapping
│   ├── incident.ts             # Incident creation and escalation
│   ├── safety-briefing.ts      # Briefing completion tracking
│   └── session-closeout.ts     # End-of-session summary
├── app/(dashboard)/field-ops/
│   ├── page.tsx                # FieldOps dashboard (upcoming/active sessions)
│   ├── sessions/
│   │   ├── page.tsx            # Session list
│   │   ├── create/route.ts     # Create session (consumes reservation)
│   │   └── [sessionId]/
│   │       ├── page.tsx        # Live session view
│   │       ├── check-in/       # Athlete check-in flow
│   │       ├── rotations/      # Drill rotation management
│   │       ├── incidents/      # Incident reporting
│   │       └── closeout/       # Session closeout
│   └── admin/
│       ├── squads/             # Squad template management
│       └── stages/             # Stage/station configuration
└── app/api/field-ops/
    ├── sessions/route.ts
    ├── check-ins/route.ts
    ├── assignments/route.ts
    └── incidents/route.ts
```

### 4.4 Data Models

```prisma
model PracticeSession {
  id              String          @id @default(cuid())
  organizationId  String
  teamId          String
  reservationId   String?         // Optional link to ResourceOps reservation
  createdById     String
  title           String
  type            SessionType     // PRACTICE, MATCH, TRAINING, GAME_DAY, SCRIMMAGE
  status          SessionStatus   // DRAFT, SCHEDULED, BRIEFING, ACTIVE, PAUSED, COMPLETED, CANCELLED
  scheduledStart  DateTime
  scheduledEnd    DateTime
  actualStart     DateTime?
  actualEnd       DateTime?
  location        String?
  notes           String?
  safetyBriefingComplete Boolean @default(false)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  organization    Organization    @relation(fields: [organizationId], references: [id])
  team            Team            @relation(fields: [teamId], references: [id])
  createdBy       Person          @relation("SessionCreator", fields: [createdById], references: [id])
  drillRotations  DrillRotation[]
  athleteAssignments AthleteAssignment[]
  coachAssignments   CoachAssignment[]
  checkIns        CheckIn[]
  incidents       Incident[]
  stages          Stage[]
  squads          Squad[]
}

model DrillRotation {
  id               String   @id @default(cuid())
  sessionId        String
  sequence         Int
  name             String
  durationMinutes  Int
  startedAt        DateTime?
  completedAt      DateTime?
  status           RotationStatus // PENDING, ACTIVE, COMPLETED, SKIPPED

  session          PracticeSession @relation(fields: [sessionId], references: [id])
  stageAssignments DrillStageAssignment[]
}

model Stage {
  id             String   @id @default(cuid())
  sessionId      String
  name           String
  stationNumber  Int
  description    String?
  gearItemId     String?  // Optional GearOps link

  session        PracticeSession  @relation(fields: [sessionId], references: [id])
  athleteSlots   DrillStageAssignment[]
}

model DrillStageAssignment {
  id          String   @id @default(cuid())
  rotationId  String
  stageId     String
  squadId     String?
  personId    String?

  rotation    DrillRotation @relation(fields: [rotationId], references: [id])
  stage       Stage         @relation(fields: [stageId], references: [id])
  person      Person?       @relation(fields: [personId], references: [id])
}

model AthleteAssignment {
  id         String   @id @default(cuid())
  sessionId  String
  personId   String
  squadId    String?
  role       String?
  status     AssignmentStatus // ASSIGNED, CHECKED_IN, ABSENT, EXCUSED

  session    PracticeSession @relation(fields: [sessionId], references: [id])
  person     Person          @relation(fields: [personId], references: [id])
}

model CoachAssignment {
  id         String   @id @default(cuid())
  sessionId  String
  personId   String
  role       CoachSessionRole // LEAD, ASSISTANT, SAFETY_OFFICER, OBSERVER
  checkedIn  Boolean          @default(false)
  checkedInAt DateTime?

  session    PracticeSession @relation(fields: [sessionId], references: [id])
  person     Person          @relation(fields: [personId], references: [id])
}

model CheckIn {
  id          String    @id @default(cuid())
  sessionId   String
  personId    String
  checkedInAt DateTime  @default(now())
  method      CheckInMethod // SELF, COACH, SCAN, AUTO
  notes       String?
  late        Boolean   @default(false)

  session     PracticeSession @relation(fields: [sessionId], references: [id])
  person      Person          @relation(fields: [personId], references: [id])
}

model Squad {
  id          String   @id @default(cuid())
  sessionId   String
  name        String
  color       String?
  description String?

  session     PracticeSession   @relation(fields: [sessionId], references: [id])
  members     AthleteAssignment[]
}

model Incident {
  id              String           @id @default(cuid())
  sessionId       String
  reportedById    String
  personId        String?          // Involved person (if applicable)
  type            IncidentType     // INJURY, SAFETY_VIOLATION, EQUIPMENT_FAILURE, BEHAVIORAL, NEAR_MISS, OTHER
  severity        IncidentSeverity // LOW, MEDIUM, HIGH, CRITICAL
  description     String
  status          IncidentStatus   // OPEN, UNDER_REVIEW, ESCALATED, RESOLVED, CLOSED
  escalatedAt     DateTime?
  resolvedAt      DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  session         PracticeSession  @relation(fields: [sessionId], references: [id])
  reportedBy      Person           @relation("IncidentReporter", fields: [reportedById], references: [id])
  involvedPerson  Person?          @relation("IncidentSubject", fields: [personId], references: [id])
}
```

### 4.5 APIs

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/field-ops/sessions` | List sessions (org/team scoped) | Staff, Coach |
| POST | `/api/field-ops/sessions` | Create session | Staff, Coach |
| GET | `/api/field-ops/sessions/[id]` | Session detail | Staff, Coach |
| PATCH | `/api/field-ops/sessions/[id]/status` | Advance session status | Staff, Coach |
| POST | `/api/field-ops/sessions/[id]/check-in` | Record athlete check-in | Staff, Coach |
| GET | `/api/field-ops/sessions/[id]/check-ins` | List check-ins | Staff, Coach |
| POST | `/api/field-ops/sessions/[id]/rotations` | Create drill rotation | Staff, Coach |
| PATCH | `/api/field-ops/sessions/[id]/rotations/[rid]/advance` | Advance to next rotation | Staff, Coach |
| POST | `/api/field-ops/sessions/[id]/incidents` | Report incident | Staff, Coach |
| PATCH | `/api/field-ops/sessions/[id]/incidents/[iid]/escalate` | Escalate incident | Admin, Staff |
| POST | `/api/field-ops/sessions/[id]/closeout` | Close session + generate summary | Staff, Coach |

### 4.6 Events

```
field.session.created
field.session.scheduled
field.session.briefing_started
field.session.started
field.session.paused
field.session.completed
field.session.cancelled
field.checkin.completed
field.checkin.late
field.rotation.started
field.rotation.completed
field.assignment.updated
field.safety_briefing.completed
field.incident.created
field.incident.escalated
field.incident.resolved
field.squad.created
field.closeout.completed
```

### 4.7 Permissions

| Action | Required Role |
|--------|--------------|
| View sessions | Staff, Coach, Athlete (own sessions) |
| Create session | Staff, Coach |
| Advance session status | Lead Coach, Staff |
| Check in athletes | Coach, Staff |
| Manage drill rotations | Lead Coach |
| Report incident | Any session participant |
| Escalate incident | Admin, Staff |
| Close session | Lead Coach, Staff |
| View incident details | Admin, Staff |

### 4.8 State Machine — PracticeSession

```
DRAFT
  → SCHEDULED   (session confirmed with time/location)

SCHEDULED
  → BRIEFING    (safety briefing started)
  → CANCELLED   (cancelled before start)

BRIEFING
  → ACTIVE      (all briefing requirements met; session live)

ACTIVE
  → PAUSED      (operational pause, weather hold, etc.)
  → COMPLETED   (closeout workflow finished)
  → CANCELLED   (emergency stop)

PAUSED
  → ACTIVE      (resume)
  → CANCELLED   (abort after pause)

COMPLETED     (terminal)
CANCELLED     (terminal)
```

### 4.9 State Machine — Incident

```
OPEN
  → UNDER_REVIEW   (staff acknowledges)
  → ESCALATED      (immediately critical)

UNDER_REVIEW
  → ESCALATED      (elevated severity)
  → RESOLVED       (issue addressed)

ESCALATED
  → RESOLVED       (resolved post-escalation)

RESOLVED
  → CLOSED         (after review period)

CLOSED           (terminal)
```

### 4.10 Mobile Requirements

- One-tap athlete check-in from session roster
- Swipe-to-advance drill rotation
- Incident report accessible from every session screen
- Safety briefing completion requires explicit tap confirmation per coach
- Offline-capable check-in queue (sync on reconnect)
- Coach view: at-a-glance attendance count and rotation timer
- Athlete view (future): self check-in QR or PIN

### 4.11 Audit Requirements

All session state transitions, check-in events, and incidents emit `AuditEvent` records. Incidents additionally require a reason string for any status transition. Session closeout generates a sealed `SessionSummary` record that cannot be edited after creation.

### 4.12 Automation Opportunities

- Auto-advance rotation when timer expires (with coach confirmation)
- Auto-flag late arrivals after configurable grace period
- Auto-notify coach when athlete attendance falls below threshold
- Auto-escalate `CRITICAL` severity incidents to org admin
- Auto-generate session summary from check-in and rotation data

### 4.13 AI-Agent Opportunities

- "Start check-in for today's practice" → agent retrieves today's session and initiates check-in flow
- "How many athletes have checked in?" → agent queries check-in count for active session
- "Advance to the next drill rotation" → agent calls rotation advance API
- "Flag an incident for athlete [name]" → agent creates incident record with voice-dictated description
- "Generate a practice summary" → agent collects session data and drafts closeout summary

### 4.14 Sample Workflows

**Athlete check-in:**
1. Coach opens session on mobile.
2. Coach taps athlete name from roster list; `CheckIn` record created; `field.checkin.completed` emitted.
3. If past grace period: `late = true`; CommOps notifies team admin.
4. Attendance counter on session dashboard updates live.

**Coach attendance:**
1. Coach opens session and taps "I'm Here".
2. `CoachAssignment.checkedIn = true`, `checkedInAt` recorded.
3. If Lead Coach is absent past N minutes: `field.checkin.late` emitted; admin notified via CommOps.

**Practice execution:**
1. Lead Coach taps "Start Briefing" → session → `BRIEFING`.
2. Coach marks safety briefing complete → session → `ACTIVE`; `field.session.started` emitted.
3. First `DrillRotation` auto-activates; timer starts.
4. At rotation end: Coach taps "Next Rotation"; rotation transitions `COMPLETED`; next activates.
5. After final rotation: Coach taps "Close Session" → closeout workflow.

**Drill rotation:**
1. Session enters `ACTIVE` state.
2. Active rotation's stage assignments determine which squad is at which station.
3. Coach advances rotation manually (or automation triggers after timer).
4. Assignments are re-resolved for the new rotation sequence.

**Safety briefing completion:**
1. Session enters `BRIEFING` state.
2. Each assigned `CoachAssignment` with role `SAFETY_OFFICER` must tap confirm.
3. When all required confirmations received: `field.safety_briefing.completed` emitted.
4. Session eligible to transition to `ACTIVE`.

**Incident escalation:**
1. Coach files incident via incident form; `Incident` created in `OPEN` state; `field.incident.created` emitted.
2. If severity is `CRITICAL`: auto-transition to `ESCALATED`; `field.incident.escalated` emitted.
3. CommOps delivers urgent notification to org admin.
4. Admin reviews, adds resolution notes, closes: `field.incident.resolved` emitted.

---

## Section 5 — Shared Platform Primitives

These primitives are owned by specific foundation domains and consumed by all `*Ops` modules. No operational domain should re-implement them.

| Primitive | Owner | Description | Lifecycle |
|-----------|-------|-------------|-----------|
| `Role` | IdentityOps | Named role within org scope (ADMIN, COACH, ATHLETE, etc.) | Created at org setup; referenced by all modules |
| `Permission` | IdentityOps | Named capability gate (can_approve_reservation, can_check_in_athlete) | Defined at deploy time; evaluated at runtime |
| `Policy` | WorkflowOps | Named rule set attached to a resource or workflow (approval_required, min_advance_hours) | CRUD by Admin |
| `Workflow` | WorkflowOps | Ordered step sequence with state machine; reusable across domains | Created by Admin; triggered by domain events |
| `ApprovalRequest` | WorkflowOps | Approval task associated with any entity needing human sign-off | PENDING → APPROVED / DENIED |
| `Assignment` | Domain-specific | A link between a Person and an operational entity (session, gear item, etc.) | Created per domain; standardized shape |
| `Notification` | CommOps | A message delivered to one or more recipients via channel | PENDING → DELIVERED / FAILED |
| `AuditEvent` | ComplianceOps | Immutable record of actor/action/entity/timestamp | Write-once; never edited or deleted |
| `Qualification` | ComplianceOps | A named certification or credential attached to a Person | Active / Expired / Revoked |
| `StateMachine` | WorkflowOps | Reusable state transition graph; parameterized per entity type | Defined in code; driven at runtime |
| `Comment` | Domain-agnostic | Free-text annotation attached to any entity | CRUD by author; visibility-scoped |
| `Attachment` | Domain-agnostic | File or document linked to any entity | Created on upload; referenced by URL |
| `Tag` | Domain-agnostic | Flexible label for filtering and grouping | CRUD by staff |

### Primitive Usage Rules

1. **Never reimplement** — if a primitive exists, reference it; do not create a domain-local duplicate.
2. **Eventing is inherited** — every primitive emits its own lifecycle events; domains subscribe rather than re-emit.
3. **Audit is mandatory** — every state-changing operation on a primitive must emit an `AuditEvent`.
4. **Permissions gate primitives** — access to create, read, update, and delete each primitive is governed by IdentityOps role/permission checks.

---

## Section 6 — Event-Driven Architecture

### 6.1 Event Naming Standard

Events follow the pattern: `domain.noun.verb` (past tense).

```
# IdentityOps
identity.user_account.created
identity.user_account.linked
identity.session.started

# TeamOps
team.member.added
team.member.status.changed
team.season.started
team.season.completed

# ResourceOps
resource.created
resource.reservation.created
resource.reservation.approved
resource.reservation.denied
resource.reservation.cancelled
resource.reservation.expired
resource.conflict.detected
resource.occupancy.check_in

# FieldOps
field.session.created
field.session.started
field.session.completed
field.checkin.completed
field.checkin.late
field.rotation.started
field.rotation.completed
field.incident.created
field.incident.escalated
field.incident.resolved
field.closeout.completed

# GearOps
gear.item.created
gear.checkout.created
gear.checkin.completed
gear.maintenance.logged
gear.consumable.stocked
gear.consumable.depleted

# WorkflowOps
workflow.approval.created
workflow.approval.completed
workflow.approval.denied
workflow.step.completed

# CommOps
comm.notification.sent
comm.notification.delivered
comm.message.created

# ComplianceOps
compliance.audit_event.created
compliance.qualification.granted
compliance.qualification.expired
compliance.consent.signed

# EventOps
event.created
event.published
event.attendance.recorded
event.completed
```

### 6.2 Event Transport Strategy

| Tier | Mechanism | Use Case |
|------|-----------|----------|
| **MVP** | PostgreSQL-backed event log + async server actions | Audit, notifications, workflow triggers |
| **Phase 2** | Background job queue (e.g. pg-boss, BullMQ) | Notification delivery, automation triggers |
| **Phase 3** | Redis pub/sub or Upstash | Low-latency live updates within a session |
| **Enterprise** | Event bus (e.g. Kafka, AWS EventBridge) | Cross-service fanout, microservice separation |

### 6.3 WebSocket / Live Update Strategy

Live FieldOps sessions (check-in feed, rotation timer, incident alert) require real-time updates.

- **MVP:** Server-Sent Events (SSE) via Next.js streaming routes; poll interval fallback.
- **Phase 2:** WebSocket connection per active session; session ID as channel key.
- **Channel naming:** `field-ops:session:{sessionId}`, `resource-ops:resource:{resourceId}`.

### 6.4 Audit Propagation

Every domain emits events that trigger `AuditEvent` creation in ComplianceOps. The audit pipeline:

1. Domain emits `*.*.created / *.*.updated / *.*.deleted` event.
2. Audit handler (background job) reads the event and writes an immutable `AuditEvent` record.
3. `AuditEvent` includes: `actorId`, `entityType`, `entityId`, `action`, `previousState`, `newState`, `timestamp`, `ipAddress`, `sessionId`.
4. Audit records are never updated or deleted (append-only table).

---

## Section 7 — Database & Schema Recommendations

### 7.1 Bounded Contexts

Each `*Ops` domain owns its own Prisma models. Cross-domain references use foreign keys to shared entities (`Person`, `Team`, `Organization`) but never import another domain's internal models directly.

```
Allowed:   ResourceOps.Reservation → TeamOps.Team (FK reference)
Allowed:   FieldOps.PracticeSession → ResourceOps.Reservation (FK reference)
Forbidden: FieldOps directly mutates ResourceOps.Resource
Forbidden: ResourceOps queries FieldOps.PracticeSession for capacity logic
```

### 7.2 Prisma Model Organization

```
prisma/
└── schema.prisma          # Single schema (MVP); split into sub-schemas in Phase 3+

Naming conventions:
  - Core entities: Organization, Person, Team, Program, Season
  - ResourceOps: Resource, ResourceGroup, Reservation, ReservationPolicy, ResourceAvailability, ...
  - FieldOps: PracticeSession, DrillRotation, Stage, CheckIn, Incident, Squad, ...
  - GearOps: GearItem, GearCategory, GearAssignment, CustodyRecord, ...
  - ComplianceOps: AuditEvent, Qualification, ConsentDocument, ...
  - WorkflowOps: Workflow, ApprovalRequest, ...
  - CommOps: Notification, Message, ...
```

### 7.3 Folder Structure

```
/
├── app/
│   └── (dashboard)/
│       ├── resource-ops/       # ResourceOps routes and pages
│       ├── field-ops/          # FieldOps routes and pages
│       ├── gear-ops/           # GearOps routes and pages
│       ├── events/             # EventOps routes and pages
│       ├── teams/              # TeamOps routes
│       └── people/             # IdentityOps / TeamOps people routes
├── lib/
│   ├── resource-ops/           # ResourceOps business logic helpers
│   ├── field-ops/              # FieldOps business logic helpers
│   ├── gear-ops/               # GearOps business logic helpers
│   ├── workflows/              # WorkflowOps shared primitives
│   ├── identity/               # IdentityOps helpers
│   └── audit/                  # AuditEvent emission helpers
├── prisma/
│   └── schema.prisma
└── planning/
    └── (architecture docs)
```

### 7.4 Background Jobs

| Job | Trigger | Domain |
|-----|---------|--------|
| Auto-release unused reservation | Cron: every 5 min | ResourceOps |
| Notification delivery | Event: `*.notification.*` | CommOps |
| Audit event write | Event: any state change | ComplianceOps |
| Session rotation timer | Cron: every 1 min during active session | FieldOps |
| Qualification expiry check | Cron: daily | ComplianceOps |

### 7.5 PostgreSQL Recommendations

- Use `cuid()` primary keys (not auto-increment integers) for portable IDs.
- All tables include `organizationId` for row-level multi-tenancy filtering.
- Add composite indexes on `(organizationId, status)` and `(resourceId, startTime, endTime)` for reservation queries.
- Use `TIMESTAMPTZ` for all time columns (UTC stored, displayed in user timezone).
- Append-only tables (`AuditEvent`) should use `INSERT`-only Postgres roles in production.

---

## Section 8 — UI/UX Naming Guidance

### 8.1 Internal Architecture vs User-Facing Labels

| Internal Name | UI Label (Default) | Notes |
|--------------|-------------------|-------|
| ResourceOps | **Facilities** | Org may customize (e.g. "Ranges", "Courts") |
| FieldOps | **Field Operations** | Or "Practice Ops" for training-focused orgs |
| GearOps | **Equipment** | Or "Gear", "Armory" depending on org type |
| WorkflowOps | **Approvals** | Users see "Approvals", not "WorkflowOps" |
| CommOps | **Messages** | Or "Notifications" / "Announcements" |
| ComplianceOps | **Compliance** | Or "Qualifications" / "Documents" |
| EventOps | **Schedule** | Or "Events" / "Calendar" |
| AnalyticsOps | **Reports** | Or "Insights" / "Dashboard" |
| TeamOps | **Teams** | Also "Roster" in athlete-facing views |
| IdentityOps | **Account** | User-facing: "My Account", "Members" |

### 8.2 Sidebar Organization (Staff/Admin View)

```
Dashboard
──────────
Teams          (TeamOps)
Schedule       (EventOps)
──────────
Field Ops      (FieldOps)   ← live execution
Facilities     (ResourceOps) ← scheduling/reservations
Equipment      (GearOps)
──────────
Approvals      (WorkflowOps)
Messages       (CommOps)
Compliance     (ComplianceOps)
──────────
Reports        (AnalyticsOps)
Settings       (Admin)
```

### 8.3 Mobile Navigation (Coach View)

```
Bottom Tab Bar:
[ Today ]  [ Team ]  [ Field ]  [ Gear ]  [ More ]
  ↓            ↓         ↓          ↓
EventOps    TeamOps   FieldOps  GearOps  (CommOps, Settings)
```

### 8.4 Admin vs Coach vs Athlete View Differences

| Feature | Admin | Coach | Athlete |
|---------|-------|-------|---------|
| Create / edit resources | ✅ | ❌ | ❌ |
| Request reservation | ✅ | ✅ | ❌ |
| Approve reservation | ✅ | ❌ | ❌ |
| Create session | ✅ | ✅ | ❌ |
| Check in athletes | ✅ | ✅ | Self only |
| View drill rotations | ✅ | ✅ | Own squad |
| File incident | ✅ | ✅ | ✅ |
| View all incidents | ✅ | Own sessions | ❌ |
| View reports | ✅ | Own team | ❌ |

---

## Section 9 — MVP vs Phase 2 vs Enterprise

### 9.1 Must Exist Now (MVP)

| Capability | Domain |
|------------|--------|
| Resource catalog (facilities/bays/fields) | ResourceOps |
| Reservation requests with conflict detection | ResourceOps |
| Basic reservation approval (manual) | ResourceOps + WorkflowOps |
| Practice session creation + scheduling | FieldOps |
| Athlete check-in (coach-driven) | FieldOps |
| Coach assignment and attendance | FieldOps |
| Basic incident reporting | FieldOps |
| Safety briefing completion tracking | FieldOps |
| Session status lifecycle (draft→active→complete) | FieldOps |
| Audit event logging for all state changes | ComplianceOps |
| Role-based permission enforcement | IdentityOps |

### 9.2 Operationally Important (Phase 2)

| Capability | Domain |
|------------|--------|
| Drill rotation engine with stage assignments | FieldOps |
| Squad management within sessions | FieldOps |
| Recurring reservations | ResourceOps |
| Qualification enforcement at reservation | ResourceOps + ComplianceOps |
| Auto-release unused reservations | ResourceOps |
| Push notifications for reservation events | CommOps |
| Live check-in feed (SSE/WebSocket) | FieldOps |
| Session closeout summary generation | FieldOps |
| Incident escalation workflow | FieldOps + WorkflowOps |
| Basic analytics dashboard | AnalyticsOps |

### 9.3 Enterprise Scale

| Capability | Domain |
|------------|--------|
| Multi-facility organization support | ResourceOps |
| Cross-team resource sharing governance | ResourceOps |
| Automated conflict resolution suggestions | ResourceOps (AI) |
| Aggregate session analytics + trends | AnalyticsOps |
| Compliance reporting (qualification coverage, incident rates) | ComplianceOps |
| Custom approval workflow builder | WorkflowOps |
| Multi-org federation | IdentityOps |
| API integrations (external calendars, scoring systems) | ResourceOps, FieldOps |
| Event bus / microservice separation | Platform |

### 9.4 Future AI-Agent Features

| Feature | Domain | Trigger |
|---------|--------|---------|
| Natural language reservation creation | ResourceOps | Voice/chat |
| AI-generated practice plans from team data | FieldOps | Scheduled |
| Automated conflict resolution | ResourceOps | Event-driven |
| Incident pattern detection | FieldOps + AnalyticsOps | Scheduled |
| Athlete readiness prediction from attendance trends | AnalyticsOps | Scheduled |
| Smart session closeout drafting | FieldOps | Post-session |
| "What should I know before today's practice?" briefing | FieldOps + ResourceOps | On-demand |

### 9.5 Abstract Early (Even in MVP)

These must be designed as shared abstractions from day one, even if the first implementation is simple:

| Abstraction | Why |
|-------------|-----|
| `AuditEvent` emission pattern | Adding audit later is expensive; it must be designed in |
| `StateMachine` pattern | Ad-hoc status strings become unmaintainable at scale |
| `WorkflowOps` approval delegate | Every domain needs approvals; central engine prevents duplication |
| `CommOps` notification emit | Hardcoded notification logic per domain is a maintenance trap |
| `organizationId` on every record | Multi-tenancy added late is a security and data-model crisis |
| Event naming convention | Renaming events after consumers are built is breaking change |

---

## Appendix — Relationship Diagram (Text Form)

```
IdentityOps (foundation)
    ↓ provides: Person, UserAccount, Role, Permission
    
TeamOps
    consumes: IdentityOps
    provides: Team, Program, Season, RoleAssignment, AthleteProfile
    
ResourceOps
    consumes: IdentityOps, TeamOps
    provides: Resource, Reservation, ResourceAvailability, OccupancyEvent
    
FieldOps
    consumes: TeamOps, ResourceOps (Reservation), GearOps (Stage gear), CommOps
    provides: PracticeSession, CheckIn, DrillRotation, Incident, Squad
    
GearOps
    consumes: IdentityOps, TeamOps
    provides: GearItem, GearAssignment, CustodyRecord, MaintenanceLog
    
EventOps
    consumes: TeamOps, ResourceOps (Reservation), CommOps
    provides: Event, EventRSVP, AttendanceRecord
    
WorkflowOps (shared primitive provider)
    consumes: IdentityOps
    provides: Workflow, ApprovalRequest, StateMachine
    ← consumed by: ResourceOps, FieldOps, GearOps, ComplianceOps, EventOps
    
CommOps (shared delivery layer)
    consumes: IdentityOps
    provides: Notification, Message
    ← consumed by: all domains (emit notifications, do not deliver themselves)
    
ComplianceOps (shared audit and qualification layer)
    consumes: IdentityOps
    provides: AuditEvent, Qualification, ConsentDocument
    ← consumed by: all domains (emit audit events, never write directly)
    
AnalyticsOps (read-only consumer)
    consumes: all domains (read-only)
    provides: Dashboard, Report, MetricSnapshot
```

---

*Last updated: 2026-05 | Status: Architecture reference — living document*
