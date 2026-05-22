# CadreOS Prisma Model Draft (MVP-First, Multi-Org-Ready)

## Modeling Principles
- Multi-org-ready from day one (tenant key on scoped records).
- MVP pilot UX can run one organization while preserving tenant-safe schema.
- Coach-centered operational workflows first.
- Observation notes staff-only by default.
- Inbox routing is metadata workflow only in MVP.
- Minimal PII and no medical/health records.

## MVP vs Phase Scope
### MVP models
- Organization, Program, Team, Season
- UserAccount, Person
- RoleAssignment
- AthleteGuardianRelationship
- RosterMembership
- ObservationNote
- Event, RSVP, AttendanceRecord
- FollowUpTask
- InboxRoutingItem
- AuditEvent

### Phase 2 models/extensions
- NoteVisibilityGrant (explicit controlled parent/guardian sharing)
- Notification delivery state expansions

### Later
- Messaging threads/messages
- Inventory/compliance/development modules

---

## Prisma Draft (Planning)
```prisma
enum OrgStatus {
  ACTIVE
  INACTIVE
}

enum RoleType {
  ORGANIZATION_ADMIN
  PROGRAM_DIRECTOR
  COACH
  ASSISTANT_COACH
  PARENT_GUARDIAN
  ATHLETE
}

enum NoteVisibility {
  STAFF_ONLY
  // Future Phase 2 controlled visibility states can be added here
}

enum EventType {
  PRACTICE
  GAME
  MATCH
  MEETING
  TRAVEL
}

enum EventStatus {
  DRAFT
  PUBLISHED
  COMPLETED
  ARCHIVED
}

enum RSVPStatus {
  GOING
  NOT_GOING
  MAYBE
}

enum AttendanceStatus {
  PRESENT
  LATE
  EXCUSED_ABSENT
  UNEXCUSED_ABSENT
}

enum TaskStatus {
  OPEN
  IN_PROGRESS
  BLOCKED
  DONE
  CANCELLED
}

enum InboxItemStatus {
  OPEN
  TRIAGED
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum ScopeType {
  ORGANIZATION
  PROGRAM
  TEAM
}

enum RelationshipType {
  PARENT
  GUARDIAN
}

model Organization {
  id          String   @id @default(cuid())
  name        String
  status      OrgStatus @default(ACTIVE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  programs    Program[]
  people      Person[]
  users       UserAccount[]
  teams       Team[]
  seasons     Season[]
}

model Program {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  teams        Team[]
  seasons      Season[]

  @@index([organizationId])
  @@unique([organizationId, name])
}

model Team {
  id             String   @id @default(cuid())
  organizationId String
  programId      String
  name           String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  program      Program      @relation(fields: [programId], references: [id], onDelete: Restrict)
  roster       RosterMembership[]
  events       Event[]

  @@index([organizationId, programId])
  @@unique([programId, name])
}

model Season {
  id             String   @id @default(cuid())
  organizationId String
  programId      String
  name           String
  startDate      DateTime?
  endDate        DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  program      Program      @relation(fields: [programId], references: [id], onDelete: Restrict)
  roster       RosterMembership[]

  @@index([organizationId, programId])
  @@unique([programId, name])
}

model UserAccount {
  id             String   @id @default(cuid())
  organizationId String
  clerkUserId    String   @unique
  personId       String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  person       Person?      @relation(fields: [personId], references: [id], onDelete: SetNull)

  @@index([organizationId])
}

model Person {
  id             String   @id @default(cuid())
  organizationId String
  firstName      String
  lastName       String
  email          String?
  phone          String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  roles        RoleAssignment[]
  roster       RosterMembership[]
  authoredNotes ObservationNote[] @relation("NoteAuthor")
  eventRsvps   RSVP[]
  attendance   AttendanceRecord[]
  assignedTasks FollowUpTask[] @relation("TaskAssignee")
  createdTasks  FollowUpTask[] @relation("TaskCreator")

  guardianLinks AthleteGuardianRelationship[] @relation("GuardianSide")
  athleteLinks  AthleteGuardianRelationship[] @relation("AthleteSide")

  @@index([organizationId])
  @@index([organizationId, lastName, firstName])
}

model RoleAssignment {
  id             String    @id @default(cuid())
  organizationId String
  personId       String
  roleType       RoleType
  scopeType      ScopeType
  programId      String?
  teamId         String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  person       Person       @relation(fields: [personId], references: [id], onDelete: Cascade)
  program      Program?     @relation(fields: [programId], references: [id], onDelete: Restrict)
  team         Team?        @relation(fields: [teamId], references: [id], onDelete: Restrict)

  @@index([organizationId, personId])
  @@index([organizationId, roleType, scopeType])
  @@unique([personId, roleType, scopeType, programId, teamId])
}

model AthleteGuardianRelationship {
  id             String           @id @default(cuid())
  organizationId String
  athletePersonId String
  guardianPersonId String
  relationshipType RelationshipType
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  athlete      Person       @relation("AthleteSide", fields: [athletePersonId], references: [id], onDelete: Cascade)
  guardian     Person       @relation("GuardianSide", fields: [guardianPersonId], references: [id], onDelete: Cascade)

  @@index([organizationId, athletePersonId])
  @@index([organizationId, guardianPersonId])
  @@unique([organizationId, athletePersonId, guardianPersonId, relationshipType])
}

model RosterMembership {
  id             String   @id @default(cuid())
  organizationId String
  teamId         String
  seasonId       String
  personId       String
  rosterRole     RoleType
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  team         Team         @relation(fields: [teamId], references: [id], onDelete: Cascade)
  season       Season       @relation(fields: [seasonId], references: [id], onDelete: Restrict)
  person       Person       @relation(fields: [personId], references: [id], onDelete: Restrict)

  @@index([organizationId, teamId, seasonId])
  @@index([organizationId, personId])
  @@unique([teamId, seasonId, personId])
}

model ObservationNote {
  id             String         @id @default(cuid())
  organizationId String
  authorPersonId String
  athletePersonId String?
  teamId         String?
  eventId        String?
  body           String
  visibility     NoteVisibility @default(STAFF_ONLY)
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  author       Person       @relation("NoteAuthor", fields: [authorPersonId], references: [id], onDelete: Restrict)
  athlete      Person?      @relation(fields: [athletePersonId], references: [id], onDelete: SetNull)
  team         Team?        @relation(fields: [teamId], references: [id], onDelete: SetNull)
  event        Event?       @relation(fields: [eventId], references: [id], onDelete: SetNull)

  tasks        FollowUpTask[]

  @@index([organizationId, createdAt])
  @@index([organizationId, athletePersonId, createdAt])
  @@index([organizationId, teamId, createdAt])
}

model Event {
  id             String      @id @default(cuid())
  organizationId String
  programId      String
  teamId         String?
  title          String
  eventType      EventType
  status         EventStatus @default(DRAFT)
  startsAt       DateTime
  endsAt         DateTime?
  location       String?
  createdByPersonId String
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  program      Program      @relation(fields: [programId], references: [id], onDelete: Restrict)
  team         Team?        @relation(fields: [teamId], references: [id], onDelete: SetNull)
  createdBy    Person       @relation(fields: [createdByPersonId], references: [id], onDelete: Restrict)

  rsvps        RSVP[]
  attendance   AttendanceRecord[]
  notes        ObservationNote[]
  tasks        FollowUpTask[]

  @@index([organizationId, startsAt])
  @@index([organizationId, teamId, startsAt])
}

model RSVP {
  id             String     @id @default(cuid())
  organizationId String
  eventId        String
  personId       String
  status         RSVPStatus
  reason         String?
  respondedAt    DateTime   @default(now())
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  event        Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)
  person       Person       @relation(fields: [personId], references: [id], onDelete: Restrict)

  @@index([organizationId, eventId])
  @@index([organizationId, personId])
  @@unique([eventId, personId])
}

model AttendanceRecord {
  id             String           @id @default(cuid())
  organizationId String
  eventId        String
  personId       String
  status         AttendanceStatus
  reasonCode     String?
  markedByPersonId String
  markedAt       DateTime         @default(now())
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  event        Event        @relation(fields: [eventId], references: [id], onDelete: Cascade)
  person       Person       @relation(fields: [personId], references: [id], onDelete: Restrict)
  markedBy     Person       @relation(fields: [markedByPersonId], references: [id], onDelete: Restrict)

  @@index([organizationId, eventId])
  @@index([organizationId, personId])
  @@unique([eventId, personId])
}

model FollowUpTask {
  id             String     @id @default(cuid())
  organizationId String
  title          String
  description    String?
  status         TaskStatus @default(OPEN)
  assigneePersonId String
  createdByPersonId String
  dueAt          DateTime?
  sourceNoteId   String?
  sourceEventId  String?
  sourceInboxItemId String?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  assignee     Person          @relation("TaskAssignee", fields: [assigneePersonId], references: [id], onDelete: Restrict)
  createdBy    Person          @relation("TaskCreator", fields: [createdByPersonId], references: [id], onDelete: Restrict)
  sourceNote   ObservationNote? @relation(fields: [sourceNoteId], references: [id], onDelete: SetNull)
  sourceEvent  Event?          @relation(fields: [sourceEventId], references: [id], onDelete: SetNull)
  sourceInboxItem InboxRoutingItem? @relation(fields: [sourceInboxItemId], references: [id], onDelete: SetNull)

  @@index([organizationId, assigneePersonId, status, dueAt])
}

model InboxRoutingItem {
  id             String          @id @default(cuid())
  organizationId String
  category       String
  subjectRefType String
  subjectRefId   String
  priority       Int             @default(0)
  status         InboxItemStatus @default(OPEN)
  ownerPersonId  String?
  createdByPersonId String
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  owner        Person?      @relation(fields: [ownerPersonId], references: [id], onDelete: SetNull)
  createdBy    Person       @relation(fields: [createdByPersonId], references: [id], onDelete: Restrict)
  tasks        FollowUpTask[]

  @@index([organizationId, status, priority])
  @@index([organizationId, subjectRefType, subjectRefId])
}

model AuditEvent {
  id             String   @id @default(cuid())
  organizationId String
  programId      String?
  teamId         String?
  actorPersonId  String?
  action         String
  entityType     String
  entityId       String
  beforeJson     String?
  afterJson      String?
  metadataJson   String?
  createdAt      DateTime @default(now())

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  actor        Person?      @relation(fields: [actorPersonId], references: [id], onDelete: SetNull)
  program      Program?     @relation(fields: [programId], references: [id], onDelete: SetNull)
  team         Team?        @relation(fields: [teamId], references: [id], onDelete: SetNull)

  @@index([organizationId, createdAt])
  @@index([organizationId, entityType, entityId, createdAt])
  @@index([organizationId, actorPersonId, createdAt])
}
```

---

## Authorization/Data Integrity Notes
- Enforce tenant (`organizationId`) checks in every server-side read/write.
- Validate program/team ownership against organization before writes.
- RoleAssignment scope validity rules (application-level checks):
  - `ORGANIZATION` scope -> `programId` and `teamId` null
  - `PROGRAM` scope -> `programId` required, `teamId` null
  - `TEAM` scope -> `teamId` required, `programId` inferred/validated
- Observation notes remain `STAFF_ONLY` in MVP.

## Required MVP Indexes (Summary)
- Tenant indexes on all scoped tables: `organizationId`.
- Composite uniqueness:
  - roster membership: `(teamId, seasonId, personId)`
  - RSVP: `(eventId, personId)`
  - attendance: `(eventId, personId)`
  - role assignment: `(personId, roleType, scopeType, programId, teamId)`
- Query indexes:
  - tasks by assignee/status/due date
  - audit events by entity and time
  - notes timelines by athlete/team and time

## Deferred Schema Items
- Message threads/messages for full communications.
- Medical/safety compliance models.
- Development plans/goals.
- Inventory/assets.
