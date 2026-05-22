# CadreOS API Contract (MVP)

## Purpose
Define the canonical MVP operation surface for CadreOS before implementation starts.  
This contract is coach-centered, multi-org-ready at the data/access layer, and pilot-focused on one organization in MVP UX.

## Scope Boundaries
### MVP
- People and role assignments
- Parent/guardian relationships
- Teams, seasons, rosters
- Observation notes (staff-only by default)
- Events, RSVP, attendance
- Follow-up tasks
- Audit log
- Inbox/communication routing metadata only (no chat)

### Phase 2
- Controlled parent/guardian note visibility workflow
- Richer notification routing
- Bulk import/export enhancements

### Later
- Full messaging/chat
- Inventory, compliance modules
- AI and advanced analytics

## Auth, Tenancy, and Security Rules
- MVP auth provider: **Clerk**.
- Future alternative: **Auth.js** if ownership/control is prioritized over speed.
- Every protected operation is server-side authorized by:
  - `organizationId` (required)
  - `programId` (optional by resource)
  - `teamId` (optional by resource)
  - role assignment + relationship checks
- Observation notes are **staff-only by default**.
- Parent/guardian note visibility is denied in MVP unless explicitly enabled by a future controlled workflow.
- No medical/health records in MVP.
- Minimize PII (name + contact essentials only).

## Role/Scope Authorization (MVP)
| Operation Area | Organization Admin | Program Director | Coach / Assistant Coach | Parent/Guardian | Athlete |
| --- | --- | --- | --- | --- | --- |
| People CRUD (staff/athlete/guardian) | Org scope | Program scope | Team-linked create/update limits | No | No |
| Guardian-athlete links | Yes | Program scope | Team-linked assist | Own linked athlete only (request flow) | No |
| Teams/Seasons/Rosters | Yes | Program scope | Assigned team scope | View linked context only | View own context only |
| Observation Notes | Full in scope | Full in scope | Assigned team scope | Not visible by default | Not visible by default |
| Events | Full in scope | Full in scope | Assigned team scope | View linked + RSVP | View own + RSVP |
| Attendance | Full in scope | Full in scope | Assigned team scope | View linked athlete summary | View own summary |
| Tasks | Full in scope | Full in scope | Assigned team scope | View assigned-to-self only (if ever assigned) | View assigned-to-self only |
| Audit Log | Full in scope | Program scope | Limited read (team scope, policy) | No | No |

## API Conventions
- Runtime: Next.js server actions + route handlers.
- Validation: Zod at all write/read filter boundaries.
- IDs: CUID/UUID strings.
- All write operations create audit events.
- Standard error envelope:
  - `error.code` (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`)
  - `error.message`
  - `error.details` (optional)

---

## Operations by Domain

### 1) People
#### `createPerson`
- **Type:** server action
- **Input:** `organizationId`, profile fields, optional `programId`
- **Auth:** Admin/Director/authorized Coach in scope
- **Output:** person summary

#### `updatePerson`
- **Type:** server action
- **Input:** `personId`, patch fields
- **Auth:** scoped role and tenant match
- **Output:** updated person summary

#### `listPeople`
- **Type:** route handler (`GET /api/people`)
- **Input filters:** `organizationId`, optional `programId`, `teamId`, `role`
- **Auth:** scope-limited query only
- **Output:** paginated people list

#### `getPersonProfile`
- **Type:** route handler (`GET /api/people/:personId`)
- **Auth:** scope + relationship aware

#### `linkGuardianToAthlete`
- **Type:** server action
- **Input:** `organizationId`, `guardianPersonId`, `athletePersonId`, `relationshipType`
- **Auth:** Admin/Director/authorized Coach in scope
- **Output:** relationship record

### 2) Teams and Seasons
#### `createTeam`
- **Input:** `organizationId`, `programId`, `name`
- **Auth:** Admin/Director

#### `updateTeam`
- **Input:** `teamId`, patch fields
- **Auth:** Admin/Director

#### `listTeams`
- **Type:** `GET /api/teams`
- **Auth:** role and scope constrained

#### `createSeason`
- **Input:** `programId`, season metadata
- **Auth:** Admin/Director

### 3) Roster Membership
#### `addRosterMember`
- **Input:** `teamId`, `seasonId`, `personId`, `rosterRole`
- **Auth:** Admin/Director/assigned Coach
- **Rules:** unique per `teamId + seasonId + personId`

#### `removeRosterMember`
- **Input:** `rosterMembershipId`
- **Auth:** Admin/Director/assigned Coach

#### `listRoster`
- **Type:** `GET /api/teams/:teamId/roster?seasonId=...`
- **Auth:** scoped access

### 4) Observation Notes
#### `createObservationNote`
- **Input:** `organizationId`, `authorPersonId`, `body`, context (`athleteId` and/or `teamId` and/or `eventId`)
- **Auth:** staff roles in scope
- **Default visibility:** `STAFF_ONLY`
- **Output:** note summary

#### `listObservationTimeline`
- **Type:** `GET /api/notes`
- **Filters:** `athleteId`, `teamId`, date range
- **Auth:** role + relationship + visibility enforced

#### `updateNoteVisibility` (future-controlled workflow)
- **Phase:** 2
- **Purpose:** explicit note sharing policy actions

### 5) Events
#### `createEvent`
- **Input:** `organizationId`, `programId`, optional `teamId`, `eventType`, schedule fields
- **Auth:** Admin/Director/assigned Coach

#### `publishEvent`
- **Input:** `eventId`
- **Auth:** Admin/Director/assigned Coach

#### `listEvents`
- **Type:** `GET /api/events`
- **Filters:** scope + date range

#### `getEventDetail`
- **Type:** `GET /api/events/:eventId`

### 6) RSVP
#### `submitRsvp`
- **Input:** `eventId`, `personId`, `availabilityStatus`, optional reason
- **Auth:** self/linked-athlete for guardian, or staff in scope
- **Rules:** unique per `eventId + personId`

#### `listEventRsvps`
- **Type:** `GET /api/events/:eventId/rsvps`
- **Auth:** staff in scope

### 7) Attendance
#### `recordAttendance`
- **Input:** `eventId`, `personId`, `attendanceStatus`, optional reasonCode
- **Auth:** Admin/Director/assigned Coach
- **Rules:** unique per `eventId + personId`

#### `bulkRecordAttendance`
- **Input:** `eventId`, list of person attendance updates
- **Auth:** Admin/Director/assigned Coach

#### `listAttendanceByEvent`
- **Type:** `GET /api/events/:eventId/attendance`
- **Auth:** staff in scope; guardian/athlete limited to linked/self summary

### 8) Follow-up Tasks
#### `createFollowUpTask`
- **Input:** `organizationId`, `title`, `assigneePersonId`, optional source refs (`noteId`, `eventId`, `inboxItemId`)
- **Auth:** Admin/Director/assigned Coach

#### `updateTaskStatus`
- **Input:** `taskId`, `status`
- **Auth:** assignee in scope or staff role with management rights

#### `listTasks`
- **Type:** `GET /api/tasks`
- **Filters:** `assigneePersonId`, `status`, due window, scope

### 9) Inbox/Communication Routing (Metadata Only in MVP)
#### `createInboxRoutingItem`
- **Input:** `organizationId`, `category`, `subjectRefType`, `subjectRefId`, `priority`, `assignedRole`
- **Auth:** staff roles in scope
- **Rules:** no message-thread body required; metadata/workflow only

#### `updateInboxRoutingStatus`
- **Input:** `inboxItemId`, `status`, `ownerPersonId`
- **Auth:** staff in scope

#### `listInboxRoutingQueue`
- **Type:** `GET /api/inbox-routing`
- **Auth:** staff in scope

### 10) Audit Log
#### `listAuditEvents`
- **Type:** `GET /api/audit-events`
- **Filters:** `organizationId`, optional `programId`, `teamId`, `entityType`, date range
- **Auth:** Admin/Director (coach-limited policy optional)

#### `getEntityAuditTrail`
- **Type:** `GET /api/audit-events/entity/:entityType/:entityId`
- **Auth:** scoped and role constrained

---

## Dependency Notes
- Depends on `PRISMA_MODEL_DRAFT.md` for table-level constraints and indexes.
- Depends on `ACCEPTANCE_CRITERIA.md` for testable Given/When/Then behavior expectations.
