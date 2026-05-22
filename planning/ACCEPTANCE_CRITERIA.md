# CadreOS MVP Acceptance Criteria

## Scope Tiers
### MVP
- People, roles, relationships
- Teams, seasons, rosters
- Observation notes (staff-only default)
- Events, RSVP, attendance
- Follow-up tasks
- Audit log
- Inbox routing metadata workflow (no chat)

### Phase 2
- Controlled note-sharing workflow for parent/guardian visibility
- Enhanced notification/routing automation

### Later
- Full messaging/chat
- Inventory/compliance/development planning
- Advanced analytics/AI

---

## Workflow Acceptance Criteria (Given/When/Then)

### 1) Authentication and Access Bootstrap (Clerk)
- **Given** a valid Clerk-authenticated user with an active organization membership  
  **When** they access protected CadreOS routes  
  **Then** server-side authorization resolves role and scope before data is returned.
- **Given** an authenticated user without required scope  
  **When** they call a protected operation  
  **Then** the system returns a forbidden response and writes an audit event for denied write attempts.

### 2) People Management
- **Given** an Organization Admin or Program Director in scope  
  **When** they create a person record with required MVP fields  
  **Then** the person is created under the correct organization and appears in scoped people lists.
- **Given** a Coach assigned to Team A only  
  **When** they query people in Team B  
  **Then** Team B data is not returned.

### 3) Role Assignment and Scope
- **Given** a person with one existing scoped role assignment  
  **When** a staff user adds a second valid scoped role  
  **Then** both assignments are active without duplicating the same role/scope combination.
- **Given** a role assignment outside requester scope  
  **When** requester attempts update/delete  
  **Then** the operation is denied server-side.

### 4) Parent/Guardian Relationship Management
- **Given** staff with scope permission  
  **When** they link a guardian to an athlete  
  **Then** the relationship is created once and available for visibility checks.
- **Given** a guardian not linked to an athlete  
  **When** that guardian requests athlete schedule, attendance, or notes  
  **Then** access is denied.

### 5) Team and Season Management
- **Given** Admin/Director in scope  
  **When** they create/update a team and season  
  **Then** records are stored with organization/program references and become available to authorized staff.
- **Given** a Coach outside the team scope  
  **When** they attempt team edits  
  **Then** edits are denied.

### 6) Roster Membership
- **Given** authorized staff  
  **When** they add an athlete to a team-season roster  
  **Then** a unique membership record is created.
- **Given** an existing roster membership for the same team-season-person  
  **When** staff attempts duplicate add  
  **Then** the system rejects the request with a conflict error.

### 7) Observation Notes (Staff-Only Default)
- **Given** an authorized coach  
  **When** they create an observation note linked to athlete/team/event context  
  **Then** note visibility defaults to `STAFF_ONLY`.
- **Given** a linked parent/guardian  
  **When** they request observation notes in MVP  
  **Then** staff-only notes are not returned.
- **Given** note creation succeeds  
  **When** save completes  
  **Then** an audit event is written with actor, scope, entity, and timestamp.

### 8) Event Scheduling
- **Given** authorized staff in team/program scope  
  **When** they create and publish an event  
  **Then** the event appears in scoped event lists with lifecycle status.
- **Given** a guardian linked to an athlete on the roster  
  **When** they list events  
  **Then** they see only relevant linked-athlete events.

### 9) RSVP / Availability
- **Given** an athlete or linked guardian  
  **When** they submit RSVP for an event participant  
  **Then** one RSVP record exists per event/person and can be updated.
- **Given** an unrelated guardian  
  **When** they submit RSVP for a non-linked athlete  
  **Then** the request is denied.

### 10) Attendance
- **Given** authorized staff  
  **When** they record attendance statuses for event participants  
  **Then** one attendance record per event/person is stored with optional reason code.
- **Given** a guardian or athlete  
  **When** they request attendance  
  **Then** only linked/self attendance summary data is returned.

### 11) Follow-up Tasks
- **Given** authorized staff  
  **When** they create a follow-up task from note/event/inbox routing metadata  
  **Then** task source references are stored and task appears in assignee queue.
- **Given** a non-assignee without manager rights  
  **When** they change task status  
  **Then** update is denied.

### 12) Inbox/Communication Routing (Metadata-Only MVP)
- **Given** authorized staff  
  **When** they create an inbox routing item  
  **Then** metadata fields (category, priority, owner, subject ref) are stored without requiring chat/message bodies.
- **Given** MVP scope rules  
  **When** users request messaging thread behavior  
  **Then** system documents this as non-MVP and does not expose full chat operations.

### 13) Audit Log
- **Given** any successful protected write operation  
  **When** operation commits  
  **Then** an immutable audit event is appended.
- **Given** an admin/director in scope  
  **When** they query audit history by entity or date range  
  **Then** results are filtered to allowed organization/program/team boundaries.

### 14) Sensitive Data and Privacy Boundaries
- **Given** MVP person profile schema  
  **When** data fields are reviewed  
  **Then** only minimal PII is present (no medical/health records).
- **Given** any request with client-side role claims only  
  **When** server authorization runs  
  **Then** server-side scope checks are authoritative and required for access.

---

## Definition of MVP Acceptance Completeness
- All workflows above have corresponding operations in `API_CONTRACT.md`.
- All workflow entities and constraints are represented in `PRISMA_MODEL_DRAFT.md`.
- All scoped writes emit audit events.
- All note visibility and relationship rules honor staff-only default for observation notes.
