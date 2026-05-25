# Phase 17A — Roster and Member Lifecycle Architecture Boundaries

## Goal

Establish the Arc 17A planning foundation for roster and member lifecycle management before any schema changes or runtime workflow implementation.

This phase is architecture and scope definition only: no Prisma schema updates, no runtime feature delivery, and no expansion into deferred operational domains.

## Scope Guardrails (enforced)

- Do not change runtime code.
- Do not change Prisma schema.
- Do not add lifecycle workflows in this phase.
- Do not add reporting pages or dashboards in this phase.
- Do not add messaging or notifications.
- Do not begin communications implementation.
- Preserve Core, FieldOps, and GearOps runtime behavior without modification.
- Preserve organization-scoped authorization and identity attribution patterns.

---

## Arc 17 Purpose

Arc 17 matures the lifecycle of people, members, athletes, guardians, teams, seasons, and roster membership in CadreOS.

The arc makes the following workflows explicit and operationally safe:

1. **Join** — a person joins a team or program as a member or athlete.
2. **Activate** — a member or athlete becomes operationally active for a season.
3. **Move** — a member changes team, program, or role assignment.
4. **Inactive / Archive** — a member or person is placed into an inactive or archived state without data loss.
5. **Season rollover** — roster memberships are carried forward or restructured across season transitions.

Arc 17 also improves **roster readiness** visibility and **operational clarity** for staff, and introduces explicit **staff-only lifecycle controls** with clear authorization expectations.

Arc 17 must **preserve existing Core, FieldOps, and GearOps behavior** in all phases. No prior module runtime behavior is modified.

---

## In-Scope Lifecycle Areas

### 1. Member / Person Lifecycle Status

- Define what lifecycle states a `Person` can be in relative to team, program, and organizational membership.
- Identify the lifecycle signals already implicit in the current data model (e.g., presence/absence of `RoleAssignment`, `RosterMembership` records).
- Propose lifecycle status derivation semantics for staff-facing displays.

### 2. Athlete / Member Activation

- Define what it means for a member to be "active" in a given season.
- Clarify the relationship between `RosterMembership`, `Season`, and active operational status.
- Define how activation is recorded and queried without breaking existing roster workflows.

### 3. Team / Program Assignment Changes

- Define how a member moves between teams or programs (move workflow).
- Clarify role assignment lifecycle expectations when a move occurs.
- Define what state transitions are required vs. optional to maintain data integrity.

### 4. Roster Membership Status Changes

- Define how `RosterMembership` records express member state across seasons.
- Identify whether a status field is needed on `RosterMembership` or whether status is always derived from related records.
- Define safe update and archive patterns that do not break existing team/event/attendance lookups.

### 5. Inactive / Archive Handling

- Define what "inactive" and "archived" mean for a `Person`, `RosterMembership`, `RoleAssignment`, and `Team`.
- Establish soft-delete or status-flag semantics that preserve referential integrity for existing notes, tasks, attendance, GearAssignment, and GearCheckout records.
- Confirm that inactive/archived persons remain visible in their historical operational context.

### 6. Season Rollover Planning

- Define a safe season rollover workflow that carries forward or restructures `RosterMembership` records across `Season` transitions.
- Identify which entities require rollover logic: `RosterMembership`, `RoleAssignment`, and related operational context.
- Define what auto-carry, manual-copy, and lapse semantics are appropriate for MVP.
- Ensure GearAssignment and GearCheckout references to people and teams are not disrupted by rollover.

### 7. Guardian Relationship Maintenance

- Define how `AthleteGuardianRelationship` records are maintained across lifecycle changes (member activation, move, inactive, archive).
- Clarify what happens to guardian relationship visibility when an athlete is moved or archived.
- Define staff-only create/edit/delete workflow boundaries for guardian relationship records.

### 8. Roster Readiness Visibility

- Define what "roster readiness" means operationally: members are active, roles are assigned, guardian relationships are linked, and seasonal continuity is confirmed.
- Identify the readiness signals that can be derived from the current data model without schema changes.
- Propose a lightweight roster readiness summary model for use in Arc 17H.

### 9. Staff-Only Lifecycle Controls

- All lifecycle control actions (activate, deactivate, move, archive, rollover) are restricted to staff roles.
- Staff roles with lifecycle write access: `ORGANIZATION_ADMIN`, `PROGRAM_DIRECTOR`, `COACH` (team-scoped where appropriate).
- `ASSISTANT_COACH`, `ATHLETE`, and `PARENT_GUARDIAN` roles must not receive lifecycle write access.
- Guardian/parent-facing lifecycle visibility remains entirely deferred.

---

## Out-of-Scope Boundaries

The following areas are explicitly not included in Arc 17:

| Area | Status |
|------|--------|
| Parent-facing portal or guardian self-service | 🔲 Deferred |
| Messaging, notifications, or automated communications | 🔲 Deferred |
| Payment, dues, or billing workflows | 🔲 Deferred |
| Automated communications triggered by lifecycle events | 🔲 Deferred |
| Advanced reporting runtime or analytics | 🔲 Deferred |
| Bulk import or bulk migration tooling | 🔲 Deferred |
| External integrations (SSO sync, third-party rostering) | 🔲 Deferred |
| AI-driven automation or autonomous lifecycle decisions | 🔲 Deferred |
| Consent policy / opt-out infrastructure | 🔲 Deferred |
| FieldOps booking or facility behavior | 🔲 Deferred (FieldOps-owned) |
| GearOps inventory or assignment behavior | 🔲 Deferred (GearOps-owned) |

---

## Current Model Fit and Likely Gaps

### Person

**Current fit:**
- `Person` is the canonical identity record for all human actors in the system.
- Stores first name, last name, optional email, optional phone, and timestamps.
- Organization-scoped and linked to `UserAccount` optionally.

**Gaps:**
- No explicit lifecycle status field (e.g., `ACTIVE`, `INACTIVE`, `ARCHIVED`).
- No `isActive` flag or `archivedAt` timestamp.
- Derived status must currently be inferred from the presence of active `RoleAssignment` and `RosterMembership` records.
- Requires lifecycle state design decision in Arc 17B.

---

### UserAccount

**Current fit:**
- `UserAccount` is optionally linked to a `Person` via `personId`.
- Clerk-managed authentication; `clerkUserId` is the external identity reference.
- Organization-scoped.

**Gaps:**
- No lifecycle status field on `UserAccount` that mirrors `Person` lifecycle state.
- Deactivating a person does not automatically revoke Clerk session or `UserAccount` access.
- Account-link diagnostics exist (Phase 8A) but formal lifecycle-aware account suspension is deferred.

---

### RoleAssignment

**Current fit:**
- Assigns a `RoleType` to a `Person` at a given scope (`ORGANIZATION`, `PROGRAM`, `TEAM`).
- Supports create/delete workflows gated by staff permissions.
- Unique constraint prevents duplicate role+scope combos per person.

**Gaps:**
- No explicit active/inactive/ended status field on `RoleAssignment`.
- Role assignment removal is a hard delete; no soft-archive or end-dated record exists.
- No role assignment history retention.
- Lifecycle transitions (e.g., coach leaves team, athlete changes program) require delete + re-create today.
- Requires lifecycle state and audit design decision in Arc 17B/17C/17D.

---

### Program

**Current fit:**
- Contains teams and seasons; organization-scoped.
- No explicit program lifecycle status beyond what is implied by the absence of active teams/seasons.

**Gaps:**
- No program active/inactive/archived status field.
- Program archiving behavior is not defined; referenced entities (teams, seasons, people) need cascade/retain semantics defined before any archive workflow can be built.

---

### Team

**Current fit:**
- Contains roster memberships and role assignments; program-scoped and organization-scoped.
- Existing remove-roster-member and remove-role-assignment workflows exist.

**Gaps:**
- No team-level lifecycle status (e.g., `ACTIVE`, `INACTIVE`, `ARCHIVED`).
- No team deactivation or archival workflow.
- GearAssignment references teams; archiving a team with active gear assignments requires cascade or retain semantics to be defined.

---

### Season

**Current fit:**
- Has `startDate` and `endDate` with optional values.
- `RosterMembership` is always tied to a `Season`.
- Multiple seasons can exist per program.

**Gaps:**
- No explicit season lifecycle status (`PLANNED`, `ACTIVE`, `COMPLETED`, `ARCHIVED`) beyond the date range model.
- No mechanism to "close" a season and signal that its roster memberships are historical.
- Season rollover from a completed season to a new season has no guided workflow yet.
- Requires season lifecycle state and rollover design in Arc 17B/17F.

---

### RosterMembership

**Current fit:**
- Links a `Person` to a `Team` and `Season` with a `rosterRole`.
- Supports add (create) and remove (delete) workflows.
- Organization-scoped with unique constraint on `(teamId, seasonId, personId)`.

**Gaps:**
- No `status` field on `RosterMembership` (e.g., `ACTIVE`, `INACTIVE`, `PENDING`).
- Removal is a hard delete; no soft-inactive or historical retention currently.
- No cross-season membership continuity model.
- A member removed mid-season loses their historical membership context.
- Requires lifecycle status design decision in Arc 17B.

---

### AthleteGuardianRelationship

**Current fit:**
- Links an athlete `Person` to a guardian `Person` with a `RelationshipType` (`PARENT` or `GUARDIAN`).
- Staff-only diagnostics gate visibility (Phase 8A, 7E).
- Organization-scoped with unique constraint on `(organizationId, athletePersonId, guardianPersonId, relationshipType)`.

**Gaps:**
- No relationship lifecycle status (e.g., `ACTIVE`, `INACTIVE`, `ENDED`).
- No create/edit/delete workflow UI exists yet; relationship management is deferred.
- No guardian relationship history or audit trail.
- No mechanism to mark a guardian relationship as ended when an athlete is archived or moved.
- Requires guardian relationship maintenance workflow in Arc 17G.

---

### AttendanceRecord

**Current fit:**
- Links a `Person` to an `Event` with an `AttendanceStatus`.
- Organization-scoped; person and event references use `Restrict` and `Cascade` delete behaviors respectively.

**Gaps:**
- No impact from lifecycle state changes today; attendance records persist after person deactivation.
- Deactivated/archived persons must continue to appear correctly in historical attendance views.
- Requires lifecycle continuity design in Arc 17E (inactive/archive workflow).

---

### ObservationNote

**Current fit:**
- Links to `Person` (author), optional `Person` (athlete subject), optional `Team`, optional `Event`.
- Staff-only visibility enforced via `NoteVisibility`.

**Gaps:**
- No explicit behavior for notes authored by or about a deactivated/archived person.
- Staff notes about archived athletes must remain accessible to authorized staff.
- Requires archive continuity design in Arc 17E.

---

### FollowUpTask

**Current fit:**
- Links to assignee `Person` and creator `Person`; optional source note/event/inbox item.
- Has `TaskStatus` lifecycle (`OPEN`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `CANCELLED`).

**Gaps:**
- No explicit behavior when assignee person is deactivated/archived.
- Open tasks assigned to an archived person need a reassignment or cancellation policy.
- Requires lifecycle continuity design in Arc 17E.

---

### GearAssignment / GearCheckout (cross-domain dependency)

**Current fit:**
- `GearAssignment` references `Person` (assignedToPerson), `Team` (assignedToTeam), `Event` (assignedToEvent), and creator `Person`.
- `GearCheckout` references multiple `Person` relations (checkedOutBy, issuedBy, returnedBy, receivedBy).
- Both are GearOps-owned; CadreOS lifecycle changes must not break these references.

**Gaps:**
- If a `Person` is archived, their gear assignment and checkout history must remain intact.
- Cascading delete or status change must not corrupt GearOps accountability records.
- Requires explicit retain-on-archive semantics in lifecycle design.
- Arc 17 must define referential safety guarantees before any person archive workflow is implemented.

---

## Arc 17 Phase Sequence

| Phase | Description |
|-------|-------------|
| **17A** | Architecture and boundaries (this document) |
| **17B** | Member status and lifecycle model — define lifecycle state fields, derivation rules, and schema proposals |
| **17C** | Join / activate workflow — implement controlled join and activation with status transitions |
| **17D** | Move team / program workflow — implement team/program move with role reassignment |
| **17E** | Inactive / archive workflow — implement soft-inactive and archive patterns with referential safety |
| **17F** | Season rollover workflow — implement guided season rollover with roster continuity checks |
| **17G** | Guardian relationship maintenance — implement staff-only create/edit/delete for `AthleteGuardianRelationship` |
| **17H** | Roster lifecycle dashboard / readiness integration — expose roster readiness signals in team and dashboard surfaces |
| **17I** | Roster / Member Lifecycle closeout — validate outcomes, confirm deferred scope, and hand off to next arc |

---

## Authorization and Privacy Expectations

### Organization-scoped lifecycle changes

- All lifecycle mutations are organization-scoped and must go through `getOrganizationScope()`.
- No lifecycle change may cross organization boundaries.
- Person, team, season, roster membership, and role assignment records must all be validated as same-organization before any write.

### Staff-only lifecycle controls

| Action | ORGANIZATION_ADMIN | PROGRAM_DIRECTOR | COACH | ASSISTANT_COACH | ATHLETE | PARENT_GUARDIAN |
|--------|--------------------|------------------|-------|-----------------|---------|-----------------|
| Activate member | ✅ | ✅ | ✅ (team-scoped) | ❌ | ❌ | ❌ |
| Deactivate / archive member | ✅ | ✅ | ✅ (team-scoped) | ❌ | ❌ | ❌ |
| Move team / program | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Season rollover | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage guardian relationship | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View roster readiness | ✅ | ✅ | ✅ (team-scoped) | ✅ (read-only, team-scoped) | ❌ | ❌ |

### Guardian / parent visibility remains deferred

- Guardian and parent-facing lifecycle visibility is not implemented in Arc 17.
- `PARENT_GUARDIAN` role holders must not receive access to lifecycle write surfaces.
- Guardian relationship diagnostics remain staff-only, as established in Phases 8A and 7E.

### No exposure of staff notes to guardians

- `ObservationNote` records with `NoteVisibility.STAFF_ONLY` must remain inaccessible to guardian users after any lifecycle transition.
- Archiving a person must not change the visibility class of existing notes about that person.

### Preserve existing role/scope patterns

- Arc 17 must reuse `requirePhase1CMutationPermission` and existing permission helpers for all new write routes.
- No parallel authorization model may be introduced.
- Actor attribution must resolve through `resolveActorPersonId` for all accountable lifecycle writes.

---

## Rollback and Continuity Boundaries

The following boundaries are required before any Arc 17B+ implementation work begins:

1. Confirm Arc 17 remains additive and reference-safe (no ownership takeover of FieldOps or GearOps domains).
2. Confirm no runtime writes are introduced in Arc 17A.
3. Confirm that any schema additions in Arc 17B are backwards-compatible and non-destructive.
4. Define retain-on-archive semantics for GearAssignment/GearCheckout, AttendanceRecord, ObservationNote, and FollowUpTask before any archive route is built.
5. Require explicit rollback safety: if Arc 17B+ stalls, current Core, FieldOps, and GearOps runtime remains unaffected.
6. Lock lifecycle state definitions and phase sequence before drafting schema in Arc 17B.

---

## Validation and Compliance Confirmation

- This phase is documentation-only.
- Runtime code was not changed.
- Prisma schema was not changed.
- Lifecycle workflow implementation is intentionally deferred to later Arc 17 phases.

---

## Source References

- `planning/ROADMAP_POST_GEAROPS_DECISION.md`
- `planning/ROADMAP_POST_15A_GEAROPS_NEXT.md`
- `planning/DOMAIN_MODEL.md`
- `planning/PHASE_7B_TEAM_MEMBER_MANAGEMENT_HARDENING.md`
- `planning/PHASE_7C_TEAM_MEMBER_ROSTER_USABILITY.md`
- `planning/PHASE_7D_TEAM_MEMBER_ASSIGNMENT_WORKFLOW.md`
- `planning/PHASE_7E_GUARDIAN_RELATIONSHIP_VISIBILITY_AND_ROADMAP_REALIGNMENT.md`
- `planning/PHASE_8A_GUARDIAN_WORKFLOW_FOUNDATION.md`
- `planning/PHASE_16A_GEAROPS_ARCHITECTURE_BOUNDARIES.md`
- `prisma/schema.prisma`

---

## Phase 17A Output Summary

Phase 17A defines Arc 17 purpose, confirms in-scope lifecycle areas (member/person status, activation, team/program moves, roster membership status, inactive/archive handling, season rollover, guardian relationship maintenance, roster readiness, and staff-only controls), establishes explicit out-of-scope boundaries, analyzes current model fit and identified gaps for all relevant entities, proposes the Arc 17 phase sequence (17A–17I), and sets authorization, privacy, and rollback expectations before any schema or runtime work begins in subsequent Arc 17 phases.
