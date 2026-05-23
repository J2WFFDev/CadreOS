# Phase 9D — Per-Record Visibility and Access Policy Architecture

## Purpose

This document designs and documents the per-record visibility and access evaluation policy required before any unified `Entry` model can be safely implemented.

Phase 9D is documentation and architecture only:

- No `Entry` model is implemented in this phase.
- No `ObservationNote` or `FollowUpTask` migration is performed in this phase.
- No Feed, Inbox, Journal, messaging, notifications, or workflow automation runtime behavior is added in this phase.
- No schema redesign is performed in this phase.
- No new major dependencies are introduced in this phase.

This document is the prerequisite gate for Entry Track E1 (Entry schema implementation planning checkpoint).

---

## 1. Current Authorization Behavior Review

### 1.1 ObservationNote

**Current auth behavior:**
- All note read surfaces are behind organization-scoped route protection (middleware enforces Clerk authentication for all `/dashboard/**` routes).
- Note list/detail queries are always filtered by `organizationId` — no notes from other organizations are ever returned.
- No per-record visibility evaluation occurs at query time. The `NoteVisibility` enum exists in the schema with a single current value (`STAFF_ONLY`), but this value is displayed in the UI as a label only — it is not evaluated by any read-path filter or access rule.
- Note create and edit routes call `requirePhase1CMutationPermission()` / `requirePermission()`, which enforces that the actor has a staff role assignment (at minimum, a scoped role matching the note's team/program context).
- Guardian users (`PARENT_GUARDIAN` role) have zero write permissions for notes — `STAFF_ACTIONS_BY_ROLE[RoleType.PARENT_GUARDIAN]` is an empty `Set`.
- Athlete users (`ATHLETE` role) have zero write permissions for notes — same pattern.
- Guardian-context filters on the note list (`guardianContext=missing_guardian_linkage`, etc.) only activate when `resolveGuardianRelationshipAccess()` confirms the actor holds a staff role (`ORGANIZATION_ADMIN`, `PROGRAM_DIRECTOR`, `COACH`, or `ASSISTANT_COACH`).

**Current gaps:**
- `NoteVisibility.STAFF_ONLY` is a schema label, not an enforced policy. Any staff user who reaches the notes route can read any note in the organization, regardless of note visibility value.
- No per-record rule prevents a future `PRIVATE` note from appearing in a shared dashboard.
- No guardian-facing read path exists. If one were added today without authorization hardening, all notes would be visible to any authenticated user.

### 1.2 FollowUpTask

**Current auth behavior:**
- All task read surfaces are behind organization-scoped route protection.
- Task list/detail queries are filtered by `organizationId`.
- Task list accepts a `assigneePersonId` URL filter; dashboard surfaces also use `assigneePersonId` filtering as a "my tasks" scoping shortcut.
- Task create and edit routes enforce staff role permission checks via `requirePermission()`.
- Task permission scope is derived from `sourceEventId` → `event.programId`/`event.teamId`, then `sourceNoteId` → `note.teamId`/`note.event.programId`/`note.event.teamId` — scope resolution cascades across FKs.
- Guardian and Athlete roles have no write permissions.

**Current gaps:**
- Tasks have no `visibility` field at all. Every staff user who reaches the task route can read every task in the organization.
- Assignee identity is always shown. No explicit rule exists for whether a guardian-linked user or a limited staff role should see another staff member's task assignments.
- Creator identity (`createdByPersonId`) is always shown where present. No author-privacy concept exists.

### 1.3 Event

**Current auth behavior:**
- Event list/detail queries are filtered by `organizationId`.
- Event create/update routes call `requirePermission({ action: "event.create" / "event.update", ... })`.
- Event permission scope is derived directly from `eventId` → `programId` / `teamId`.
- `EventStatus` lifecycle (`DRAFT` → `PUBLISHED` → `COMPLETED` → `ARCHIVED`) governs display; draft events are not explicitly hidden from any staff viewer.

**Current gaps:**
- No per-record visibility field on `Event`. A future Entry migration of Event would require a visibility decision that currently does not exist.
- `DRAFT` events are visible to all staff users in the organization who reach the events route — no draft-access restriction exists.
- No guardian-facing event read path exists. RSVP writes (`rsvp.upsert`) are an action type in the permission system, but guardian RSVP paths are not implemented.

### 1.4 Attendance

**Current auth behavior:**
- Attendance records are created and updated via `attendance.upsert` — a staff-role-gated write action.
- Attendance reads are via event detail pages and team/person review pages, all of which are staff-route-protected.
- `AttendanceRecord` has no visibility field.

**Current gaps:**
- No attendance read-level authorization beyond organization scope and staff route protection.
- No explicit rule for whether an athlete can view their own attendance, or whether a guardian can view a linked athlete's attendance.
- Attendance detail (status code, reason) is sensitive in some operational contexts (e.g., `UNEXCUSED_ABSENT` with a reason code). No partial-disclosure rule exists.

### 1.5 Guardian visibility workflows

**Current auth behavior:**
- `resolveGuardianRelationshipAccess()` in `lib/guardian-relationship-access.ts` gates all guardian diagnostic indicators: only `ORGANIZATION_ADMIN`, `PROGRAM_DIRECTOR`, `COACH`, and `ASSISTANT_COACH` role holders can see guardian linkage detail.
- `AthleteGuardianRelationship` records are readable only through staff-facing pages (people list, person detail, team roster).
- Guardian operational context indicators (`hasNoGuardianOnFile`, `hasIncompleteRelationshipSupport`, etc.) are staff-facing diagnostics derived in `lib/guardian-operational-context.ts`.

**Current gaps:**
- No guardian-facing data access path exists. There is no route, page, or query that returns data to a logged-in guardian user based on their `AthleteGuardianRelationship` linkage.
- The entire guardian boundary is currently enforced by absence of implementation, not by positive access control rules. This is a deferred safety model — acceptable for the current phase, but insufficient once guardian-facing surfaces are introduced.

### 1.6 Dashboard and review workflows

**Current auth behavior:**
- All dashboard reads are derived from `ObservationNote`, `FollowUpTask`, `Event`, and `AttendanceRecord` queries filtered by `organizationId`.
- The dashboard is staff-route-protected. All authenticated staff users see the same dashboard panels.
- There is no per-panel, per-role, or per-record authorization applied at the dashboard query level beyond organization scoping.

**Current gaps:**
- Any future visibility-gated record (`PRIVATE`, `TEAM_STAFF`-only) would leak onto the shared dashboard without targeted query-level filtering.
- Dashboard counts and lists reflect all organizational records, not role-scoped subsets. A team-scoped coach today sees the same aggregate counts as an organization admin.

---

## 2. Current Role and Scope System Review

### 2.1 UserAccount

`UserAccount` links a Clerk identity (`clerkUserId`) to an `Organization` and optionally to a `Person`. Key properties:

- One `UserAccount` per `clerkUserId` (unique constraint).
- `personId` is optional — an account may be created before it is linked to a person.
- `upsertUserAccountForOrganization()` runs on every page load via `getOrganizationScope()`, ensuring account records exist before permission checks run.
- `resolveActorPersonId()` resolves the actor's `Person` identity from `UserAccount.personId`, with no fallback for unlinked accounts beyond returning `null`.

Access model implication: there is no meaningful authorization possible for a `UserAccount` that is not linked to a `Person`. Permission checks that depend on role assignments require a resolved `personId`.

### 2.2 Person

`Person` is the central identity record. A person may simultaneously hold multiple `RoleAssignment` records with different roles and scopes. A person may also have `AthleteGuardianRelationship` records on either the athlete or guardian side.

Key observation: `Person` carries no built-in access tier. Access is entirely derived from `RoleAssignment` entries.

### 2.3 RoleAssignment

`RoleAssignment` defines a person's access tier within an organization:

| Field | Purpose |
|---|---|
| `roleType` | The role: `ORGANIZATION_ADMIN`, `PROGRAM_DIRECTOR`, `COACH`, `ASSISTANT_COACH`, `PARENT_GUARDIAN`, `ATHLETE` |
| `scopeType` | The scope of this assignment: `ORGANIZATION`, `PROGRAM`, or `TEAM` |
| `programId?` | Required when `scopeType = PROGRAM` |
| `teamId?` | Required when `scopeType = TEAM` |

A person can hold multiple simultaneous assignments. Access evaluation in `lib/permissions/index.ts` checks whether **any** assignment in the set satisfies the action + scope combination — it is an `any()`-style evaluation.

Staff action set by role (from `STAFF_ACTIONS_BY_ROLE`):

| Role | Write capability |
|---|---|
| `ORGANIZATION_ADMIN` | All actions including approval/denial |
| `PROGRAM_DIRECTOR` | Event, note, task, attendance, booking create/update; approval/denial |
| `COACH` | Event, note, task, attendance create/update; booking create; no approval/denial |
| `ASSISTANT_COACH` | Note, task, attendance create/update only |
| `PARENT_GUARDIAN` | No write capabilities |
| `ATHLETE` | No write capabilities |

Scope enforcement: most write actions are in `SCOPED_ACTIONS`, meaning the actor's role assignment must have a `programId` or `teamId` matching the scope resolved from the record being mutated. `ORGANIZATION_ADMIN` with `scopeType = ORGANIZATION` bypasses scope matching.

### 2.4 Organization / Program / Team scoping

The authorization system implements a three-tier scope hierarchy:

```
Organization
  └── Program
        └── Team
```

Rules:
- `ORGANIZATION_ADMIN` at `ORGANIZATION` scope can act on everything within the org.
- `PROGRAM_DIRECTOR` at `PROGRAM` scope can act on everything within the program.
- `COACH` / `ASSISTANT_COACH` at `TEAM` scope can act on everything within the team.
- Scope resolution for mutations cascades upward through FK relationships (task → sourceEvent → program/team, or task → sourceNote → team/event → program/team).

Implication for visibility policy: when a record has a `teamId`, it can reasonably be considered "team-scoped" for visibility inheritance. When it has only an `organizationId`, it has organization-wide scope. Notes and tasks with no team context fall back to organization scope.

### 2.5 AthleteGuardianRelationship

`AthleteGuardianRelationship` links a guardian `Person` to an athlete `Person` within an organization. Properties:

- `organizationId` scopes the relationship.
- `athletePersonId` and `guardianPersonId` reference `Person` records.
- `relationshipType` is `PARENT` or `GUARDIAN`.
- Unique constraint on `(organizationId, athletePersonId, guardianPersonId, relationshipType)`.

Current access model implication:

- The relationship record exists in the database.
- It is currently used only for staff-facing diagnostics (`resolveGuardianRelationshipAccess`, `deriveGuardianOperationalContext`).
- It is **not** used to gate any data access for the guardian-side person.

This is the primary relationship that a future guardian-linked visibility policy must build on.

---

## 3. Per-Record Visibility Architecture

### 3.1 Visibility Concepts

Per-record visibility defines **who may read a record**, independent of write permissions. Visibility is a property of the record itself — a field stored on the entry — not of the reader.

Key principles:

1. **Visibility is declared at record creation.** The author selects or the system defaults the visibility category. Visibility may be changed by the author or an admin, but never silently.
2. **Visibility is enforced at the read path, not just the write path.** Every query that returns records to a user must apply a visibility filter against the actor's role context.
3. **Visibility is not a substitute for scope.** An organization-admin-scoped record is still restricted by its visibility setting. Scope says who can act within the organization; visibility says which records those actors may actually read.
4. **More permissive visibility cannot be assumed.** A record stored as `PRIVATE` must not be surfaced in a shared dashboard, even if the actor is an organization admin.
5. **Guardian visibility is relationship-scoped.** A guardian may only read records explicitly tagged for guardian visibility **and** linked to an athlete for whom they hold an `AthleteGuardianRelationship`.

### 3.2 Access Evaluation Flow

The following flow defines how a visibility check is evaluated for a given actor + record combination:

```
1. Resolve actor context
   - Clerk user ID → UserAccount → personId
   - personId → RoleAssignment[] → staffRoles, staffScopes
   - personId → AthleteGuardianRelationship[] → guardianLinks (athletePersonIds)

2. Evaluate base access gates (hard stop conditions)
   - Is the actor authenticated? → If not, deny.
   - Is the actor's UserAccount linked to a Person? → If not, deny.
   - Is the Organization active? → If not, deny.
   - Is the record in the same Organization as the actor? → If not, deny.

3. Evaluate visibility category against actor context
   - PRIVATE → allow only if actor.personId === record.authorPersonId
                OR actor has ORGANIZATION_ADMIN at ORGANIZATION scope (admin override, logged)
   - STAFF_ONLY → allow if actor holds any staff role assignment
                  (ORGANIZATION_ADMIN, PROGRAM_DIRECTOR, COACH, ASSISTANT_COACH)
   - TEAM_STAFF → allow if actor holds a staff role assignment scoped to the same team as the record,
                  OR actor holds ORGANIZATION_ADMIN/PROGRAM_DIRECTOR at encompassing scope
   - SHARED → allow if actor is any authenticated organization member
               (staff, guardian with linked athlete in org, athlete with self-scoped access)
   - GUARDIAN_LINKED → allow only if:
                        a. record has an explicit athletePersonId link, AND
                        b. actor.personId has an AthleteGuardianRelationship to that athletePersonId

4. Evaluate scope consistency (for team/program-scoped records)
   - If record has teamId AND actor's highest-scoped role is TEAM:
       actor's teamId assignment must match record.teamId, OR actor must hold encompassing scope.
   - Records with no teamId fall back to program or organization scope evaluation.

5. Access decision
   - If all gates pass: allow
   - If any gate fails: deny (return 404 or empty result depending on context)
```

### 3.3 Role-Aware Visibility Rules

The following table defines the read access granted per role for each visibility category:

| Visibility | ORGANIZATION_ADMIN | PROGRAM_DIRECTOR | COACH | ASSISTANT_COACH | PARENT_GUARDIAN | ATHLETE |
|---|---|---|---|---|---|---|
| `PRIVATE` | Admin override only (logged) | No | No | No | No | Self only (author) |
| `STAFF_ONLY` | Yes | Yes (scoped) | Yes (scoped) | Yes (scoped) | No | No |
| `TEAM_STAFF` | Yes | Yes (scoped to program/team) | Yes (team only) | Yes (team only) | No | No |
| `SHARED` | Yes | Yes | Yes | Yes | Yes (linked athlete only) | Yes (self-linked records) |
| `GUARDIAN_LINKED` | Yes | Yes | Yes | Yes | Yes (linked athlete only) | Self only |

Notes on this table:
- "Scoped" means the actor's role assignment must encompass the record's team/program scope.
- `GUARDIAN_LINKED` requires both the visibility category AND a verified `AthleteGuardianRelationship` to the specific athlete linked on the record.
- `PRIVATE` records should never appear in shared dashboard counts or shared history panels, even in aggregate.

### 3.4 Relationship-Aware Visibility Rules

These rules apply specifically when evaluating whether a **guardian** user may read a record:

1. **Guardian reads require a verified relationship.** The actor must have an `AthleteGuardianRelationship` record where `guardianPersonId = actor.personId` and `athletePersonId = record.athletePersonId`.
2. **Orphaned records are invisible to guardians.** A record with no `athletePersonId` link is never accessible to a guardian user, regardless of visibility setting.
3. **Visibility category must permit guardian access.** A record with visibility `STAFF_ONLY` or `PRIVATE` is never accessible to a guardian, even if the guardian has a verified relationship.
4. **Only `GUARDIAN_LINKED` (or `SHARED`) visibility permits guardian reads.** `GUARDIAN_LINKED` is the explicit signal that the author intended guardian visibility. `SHARED` may additionally extend to guardians, but only for records with verified athlete linkage.
5. **Multi-household athletes.** An athlete may have multiple guardian relationships. Each guardian's access is evaluated independently. Guardians in different households may each have access to the same record but must not see each other's identity or access status.
6. **Inactive/unlinked guardian accounts.** A guardian whose `UserAccount` has no linked `Person`, or whose `AthleteGuardianRelationship` record has been removed, loses access immediately. There is no grace period.

### 3.5 Organization / Program / Team Scope Enforcement

Scope enforcement interacts with visibility but is a distinct gate:

- Organization scope is always enforced first. A record with `organizationId = A` is never returned to a user whose `UserAccount.organizationId = B`.
- For team-scoped staff roles: a `COACH` or `ASSISTANT_COACH` assigned to Team X should not read records scoped to Team Y, even if visibility is `TEAM_STAFF`. This is a scope gate, not a visibility gate.
- For program-scoped directors: a `PROGRAM_DIRECTOR` assigned to Program A should not read records scoped to Program B teams.
- For org-admin override: `ORGANIZATION_ADMIN` at `ORGANIZATION` scope reads across all teams and programs. This is explicitly permitted but should be logged for auditing purposes in future phases.
- Records with no team/program linkage (org-only scope) are readable by any staff user in the organization, subject to their visibility category access.

---

## 4. Proposed Visibility Categories for Future Entry

The following visibility categories are proposed for the `Entry` model. They are defined here for planning purposes and are not yet implemented.

### 4.1 `PRIVATE`

**Definition:** Readable only by the author. No other user may read the record, including organization admins, by default.

**Use cases:**
- Personal coaching notes the author is not ready to share.
- Draft thinking before a decision entry is finalized.
- Private performance assessments not yet cleared for team review.

**Access:**
- `authorPersonId === actor.personId`: allow.
- `ORGANIZATION_ADMIN` at organization scope: allow with audit log (admin override for compliance/safety purposes only).
- All others: deny.

**Constraint:** `PRIVATE` records must be excluded from all shared dashboard counts, shared history panels, and all list views returned to anyone other than the author.

**Future Journal implication:** The Journal surface is a filtered view of `PRIVATE` entries authored by the current user. This category is the direct enabler of private journal behavior.

### 4.2 `STAFF_ONLY`

**Definition:** Readable by all staff role holders (`ORGANIZATION_ADMIN`, `PROGRAM_DIRECTOR`, `COACH`, `ASSISTANT_COACH`) within the record's organization and scope.

**Use cases:**
- Operational coaching observations.
- Incident notes.
- Sensitive performance context not appropriate for guardians or athletes.
- All current `ObservationNote` records implicitly carry this category.

**Access:**
- Any staff role assignment in the organization: allow (subject to scope matching for team/program-scoped assignments).
- `PARENT_GUARDIAN`: deny.
- `ATHLETE`: deny.

**Constraint:** This is the current default for all `ObservationNote` records and should remain the default for note-type entries. This category enforces the existing "staff-only notes must not be exposed to guardian users" policy.

### 4.3 `TEAM_STAFF`

**Definition:** Readable only by staff role holders with an assignment to the same team as the record, plus encompassing scopes (program director for the program, org admin).

**Use cases:**
- Notes or tasks that are relevant only to a specific team's coaching staff.
- Team-internal scheduling decisions.
- Sensitive team context that should not cross team boundaries within a multi-team organization.

**Access:**
- `ORGANIZATION_ADMIN` at org scope: allow.
- `PROGRAM_DIRECTOR` scoped to the record's program: allow.
- `COACH` or `ASSISTANT_COACH` scoped to the record's team: allow.
- `COACH` or `ASSISTANT_COACH` scoped to a different team: deny.
- `PARENT_GUARDIAN`, `ATHLETE`: deny.

**Constraint:** Requires `teamId` on the record. Records with no `teamId` cannot meaningfully use `TEAM_STAFF` visibility — either the creator must assign a team at record creation, or the system should reject this combination.

**When to use vs. `STAFF_ONLY`:** Use `TEAM_STAFF` for content that carries a need-to-know posture within a multi-team organization. Use `STAFF_ONLY` for content that is fine to share across teams but must stay staff-internal.

### 4.4 `SHARED`

**Definition:** Readable by any authenticated organization member with an appropriate relationship to the record.

**Use cases:**
- Event summaries intended for athletes and parents.
- Shared team announcements captured as entries.
- Non-sensitive follow-up action items that can be communicated to athletes or families.

**Access:**
- All staff roles: allow (subject to scope matching for scoped assignments).
- `ATHLETE`: allow only for records with a direct athlete or team link in which the athlete participates.
- `PARENT_GUARDIAN`: allow only for records with an `athletePersonId` link matching a verified `AthleteGuardianRelationship`.

**Constraint:** `SHARED` is the most permissive category and carries the highest visibility risk. Entry creation UI must make this selection explicit and should display a clear disclosure to the author that the content is intended for broader visibility.

**MVP risk note:** `SHARED` should not be activated for MVP runtime until guardian-facing read paths exist and are tested. Staff can apply this category, but guardian access remains gated on guardian surface implementation.

### 4.5 `GUARDIAN_LINKED`

**Definition:** Readable by the author, all staff, and any guardian who holds a verified `AthleteGuardianRelationship` to the athlete linked on the record.

**Use cases:**
- Guardian-facing progress updates explicitly authored for the guardian.
- Formal communication entries intended to inform a specific athlete's household.
- Attendance-related summaries prepared for guardian review.

**Access:**
- All staff roles: allow.
- `PARENT_GUARDIAN` with verified relationship to `record.athletePersonId`: allow.
- `PARENT_GUARDIAN` with no relationship to `record.athletePersonId`: deny.
- `ATHLETE` linked to `record.athletePersonId` (self-reference): allow (subject to athlete access design, which is deferred).
- Any other actor: deny.

**Constraint:** Requires `athletePersonId` on the record. Cannot be applied to records with no athlete link. Multi-household guardians each independently satisfy their own relationship check.

**Deferral note:** This category is the correct long-term design for guardian-facing entry content, but the guardian-facing read path is not yet implemented. `GUARDIAN_LINKED` visibility should be defined now as a schema category, but guardian-facing surface access remains blocked until guardian-facing UI and authorization paths are built and hardened.

### 4.6 Future Extensibility Considerations

The visibility model above is designed for extensibility. Possible future additions include:

- **`ATHLETE_SELF`:** Readable only by the athlete themselves and their staff. A stricter variant of `SHARED` for athlete-personal content.
- **`PROGRAM_STAFF`:** Similar to `TEAM_STAFF` but at program scope. Useful for program-level notes in multi-program organizations.
- **`GUARDIAN_AND_ATHLETE`:** A combination category allowing both the linked guardian and the athlete self-access.
- **Visibility expiration:** A future enhancement where `STAFF_ONLY` content transitions to `GUARDIAN_LINKED` after a defined workflow approval step.
- **Consent-gated categories:** Future categories that require explicit guardian consent before a record becomes readable. Not defined here — deferred to the Communications Architecture Track.

---

## 5. Access Evaluation Concepts Per Actor Type

### 5.1 Author

The `authorPersonId` on a future Entry record designates the person who created the entry.

Access rules:
- The author always has read access to their own entries, regardless of visibility category.
- The author has edit access to their own entries, subject to status constraints (e.g., a `FILED` or `ARCHIVED` entry may be locked for edits).
- The author may upgrade or downgrade the visibility category of their own entries, subject to role constraints (e.g., only staff may create `STAFF_ONLY` entries).
- The author does not have elevated access to read others' `PRIVATE` entries by virtue of being an author themselves.

### 5.2 Assignee

The `assignedToPersonId` on a future Entry record designates the person responsible for resolving a task-type entry.

Access rules:
- The assignee has read access to any entry assigned to them, regardless of visibility category, unless the entry is `PRIVATE` and they are not the author.
- The assignee does not have edit access to the entry's visibility setting.
- The assignee may update the status of an entry assigned to them (task lifecycle progression).
- An assignee who holds no staff role (e.g., a future `ATHLETE`-assigned task) has access limited to that specific assigned record only — they should not gain access to the broader record surface.

**Constraint:** If a future system allows tasks to be assigned to non-staff persons (athletes, guardian-linked people), the assignee access rule must be tightly scoped to the assigned record only. This does not exist today and is flagged as a deferred design decision.

### 5.3 Organization Admin

The `ORGANIZATION_ADMIN` role at `ORGANIZATION` scope has the broadest access:

- Reads all records in the organization, including `STAFF_ONLY`, `TEAM_STAFF`, and `SHARED` entries.
- Does not read `PRIVATE` entries of other users by default.
- May apply an admin override to read a `PRIVATE` entry in a compliance or safety context. All admin overrides for `PRIVATE` entries must be logged.
- Has full write access across all record types and scopes.

**Risk note:** Org admin override on `PRIVATE` entries is a high-sensitivity action. The current phase does not implement this override — it is defined here for architectural completeness. The first MVP slice should not activate this override path.

### 5.4 Coach / Team Staff

`COACH` and `ASSISTANT_COACH` with team-scoped assignments:

- Read access to `STAFF_ONLY` entries within their team scope.
- Read access to `TEAM_STAFF` entries for their assigned team.
- Read access to `SHARED` and `GUARDIAN_LINKED` entries for their team.
- No access to `PRIVATE` entries authored by others.
- No access to `TEAM_STAFF` entries for teams they are not assigned to.
- No access to `STAFF_ONLY` entries outside their team scope (unless an encompassing role assignment also exists).

### 5.5 Linked Guardian

A `PARENT_GUARDIAN` role holder with a verified `AthleteGuardianRelationship` to an athlete:

- Read access to `GUARDIAN_LINKED` entries where `athletePersonId` matches their linked athlete.
- Read access to `SHARED` entries linked to their athlete or the athlete's team (subject to team access design).
- No access to `PRIVATE`, `STAFF_ONLY`, or `TEAM_STAFF` entries.
- No write access to any entry type (current permission model; may evolve).

**Multi-athlete households:** A guardian linked to more than one athlete has independent relationship-gated access to entries for each athlete. They may not cross-reference entries from one athlete to another.

### 5.6 Unrelated Guardian

A `PARENT_GUARDIAN` role holder with **no** `AthleteGuardianRelationship` to the athlete on a given record:

- No access to any entry related to that athlete.
- No access to other athletes' entries, even if they are `SHARED`.
- Access is strictly limited to records linked to athletes they hold a verified relationship with.

**Edge case:** A guardian who has been assigned the `PARENT_GUARDIAN` role but has no `AthleteGuardianRelationship` records at all has read access to nothing except their own linked content and any organization-level notices explicitly published as `SHARED` with no athlete linkage requirement. This edge case is uncommon and likely indicates an incomplete onboarding state.

### 5.7 Athlete

The `ATHLETE` role is currently implemented as a zero-write role. Athlete-facing read paths do not yet exist. The following rules are defined for future Entry planning:

- An athlete may read their own `PRIVATE` entries (authored by themselves).
- An athlete may read entries with `GUARDIAN_LINKED` or `SHARED` visibility where `athletePersonId` matches their own `personId`.
- An athlete should not read `STAFF_ONLY` or `TEAM_STAFF` entries.
- An athlete should not read other athletes' entries.

**Deferral note:** Athlete-facing access is not implemented and is explicitly deferred. The rules above are design guardrails for future implementation. No athlete-facing read path should be added until after guardian-facing paths are built and pilot-validated.

---

## 6. Guardian Boundary Concerns

### 6.1 Staff-Only Operational Notes

Staff operational notes (`ObservationNote` today, `STAFF_ONLY` Entry in the future) must **never** be exposed to guardian users. This is a hard product constraint established in Phase 7E and reaffirmed throughout the Phase 8 operational foundation.

The concern is not hypothetical — if a guardian-facing read surface is built without per-record visibility enforcement, every `ObservationNote` in the database becomes a data-exposure risk. Current implementation safety relies entirely on the absence of a guardian-facing read path, not on an explicit row-level access rule.

Mitigation required before any guardian surface:
- Per-record visibility filtering must be enforced at the query layer, not just at the route-protection layer.
- All note-type entries must be explicitly confirmed `STAFF_ONLY` before any guardian read path is activated.

### 6.2 Sensitive Coaching Observations

Observations about athlete performance, injury, behavior, or interpersonal dynamics are operationally sensitive. Even if a guardian is linked to an athlete, they should not automatically have access to all coaching observations about that athlete.

Design rule:
- `STAFF_ONLY` and `TEAM_STAFF` entries are categorically excluded from guardian access.
- `GUARDIAN_LINKED` access is an explicit authorial decision — the coach must intentionally mark a note as guardian-visible.
- Default visibility for new note-type entries must be `STAFF_ONLY`. Selecting `GUARDIAN_LINKED` must be a deliberate choice with clear UI disclosure.

### 6.3 Guardian-Scoped Visibility

When an author selects `GUARDIAN_LINKED` visibility, they are explicitly targeting one or more guardians of the linked athlete. The implementation must:

1. Verify that `athletePersonId` is set on the record (required for guardian-linked records).
2. At read time, verify that the requesting actor holds an `AthleteGuardianRelationship` to that specific `athletePersonId`.
3. Not infer guardian access from team membership, roster presence, or other indirect signals.

### 6.4 Multi-Household Edge Cases

An athlete may have multiple `AthleteGuardianRelationship` records — for example, two parents in separate households. Edge cases:

- **Both households should have equal access.** If a record is `GUARDIAN_LINKED` for athlete X, both of athlete X's guardians may read it. This is correct and expected.
- **Guardians must not see each other.** The guardian read path should not expose the identities or access status of other guardians linked to the same athlete. Each guardian sees only their own view.
- **Relationship removal.** If a guardian's `AthleteGuardianRelationship` record is deleted, they immediately lose access to all previously accessible `GUARDIAN_LINKED` entries. No notification or grace period is required in the MVP.
- **Disputed custody / access restriction edge cases.** The system should not attempt to enforce household-specific access restrictions beyond the `AthleteGuardianRelationship` existence check. Edge cases involving custody disputes or consent revocation require a legal/compliance review that is out of scope for this phase.

### 6.5 Consent and Privacy Concerns

The `GUARDIAN_LINKED` and `SHARED` visibility categories introduce data sharing with persons who are not staff. Before any guardian-facing read path is activated, the following must be addressed:

- **Disclosure to athletes and guardians about what data is shared and how.**
- **Consent model for guardian account creation and data access.** Currently, a guardian person record can be created by staff without any consent workflow for the guardian.
- **Data retention and deletion obligations.** If a guardian relationship ends, what happens to the records they previously accessed?
- **Minors' data considerations.** Athletes are often minors. COPPA, FERPA, GDPR (where applicable), and state-level privacy laws may apply to athlete data exposed to guardians.

**These concerns are not resolved in this phase.** They are documented here as blockers for guardian-facing runtime activation. Phase 9D defines the policy model; consent and compliance architecture is deferred to the Communications Architecture Track (Track 3).

---

## 7. Visibility Inheritance and Open Questions for Linked Records

### 7.1 Linked Tasks

When a `FollowUpTask` (or future task-type `Entry`) is linked to a source `ObservationNote` (or source note-type `Entry`) via `sourceNoteId`:

- **Current behavior:** The task's visibility is independent of the note's visibility. The task list displays all tasks to all staff users.
- **Proposed rule:** A task's visibility should be set independently by its author/creator. It should not automatically inherit the visibility of its source note.
- **Risk:** If a `STAFF_ONLY` note spawns a task that is set to `SHARED`, the task body (title, description) may leak context from the private note into a broader audience. Task authors must be warned about this discrepancy when creating tasks from `STAFF_ONLY` or `PRIVATE` sources.
- **Open question:** Should the system enforce that a task's visibility cannot be more permissive than its source note's visibility? This would prevent accidental disclosure, but adds authorial friction. **Recommendation: add a UI warning, not a hard enforcement, in the MVP.**

### 7.2 Linked Events

Event records do not currently have a visibility field. When a note or task is linked to an event:

- The event's existence and basic details (title, date, location, status) should be readable based on the event's own visibility rules (which do not yet exist).
- A `STAFF_ONLY` note linked to an event should not expose the note body in the event detail view to a non-staff viewer, even if the event itself is visible.
- **Open question:** When `Event` eventually gains a visibility field, should it default to `SHARED` (since events are scheduling artifacts often communicated to athletes/guardians) or `STAFF_ONLY`? **Recommendation: `SHARED` default for published events; `STAFF_ONLY` default for draft events.**

### 7.3 Linked Attendance

`AttendanceRecord` entries have no visibility field. Attendance data is operationally sensitive:

- **Staff view:** All attendance records are currently visible to all staff. This is appropriate.
- **Guardian view:** A guardian might reasonably expect to see whether their linked athlete was marked present or absent. However, the `reasonCode` field on `UNEXCUSED_ABSENT` or `EXCUSED_ABSENT` records may contain sensitive context (medical, behavioral, etc.).
- **Proposed rule:** Attendance status (present/absent) may be shareable at `SHARED` visibility when an event is published. Reason codes should remain `STAFF_ONLY` at minimum.
- **Open question:** Should attendance records gain an explicit `visibility` field, or should visibility be derived from the parent event's visibility? **Recommendation: derive from parent event for now; add an explicit field only if discrepancy scenarios require it.**

### 7.4 Linked Notes

When multiple notes reference the same athlete or event, the visibility of each note is independent. There is no "parent note" visibility that cascades to linked notes.

- **Open question:** If a guardian has access to a `GUARDIAN_LINKED` note, and that note has a `related note` link (not yet implemented), should the related note be included in guardian access? **Recommendation: No. Each note's visibility must be evaluated independently. Related-note links are editorial context, not access grants.**

### 7.5 Future Feed Behavior

The Feed surface (deferred — see Section 8) will display a chronological stream of Entry records filtered by the actor's role and visibility permissions.

Key visibility implications for Feed design (for planning only — not implemented here):

- Feed must be driven by the visibility evaluation framework defined in this document.
- A guardian feed must show only `GUARDIAN_LINKED` and `SHARED` entries linked to the guardian's athletes.
- A staff feed may show `STAFF_ONLY`, `TEAM_STAFF`, `SHARED`, and `GUARDIAN_LINKED` entries within scope.
- `PRIVATE` entries must never appear in a shared feed, even for admin users.
- Feed item counts must match visibility-filtered totals — there should be no discrepancy between what a user sees in a list and what the aggregate count says.

---

## 8. Do Not Implement Yet

The following capabilities are explicitly blocked from implementation in Phase 9D and all near-term phases until the prerequisite gates in Section 9 are satisfied.

### 8.1 Guardian-Facing Feeds

A guardian-facing feed requires:
- A guardian read path (routes, queries, auth middleware gating on guardian role)
- Verified `GUARDIAN_LINKED` entry filtering at query time
- Consent and disclosure framework
- Multi-household identity separation

None of these exist. **Do not implement any guardian-facing feed, list, or stream.**

### 8.2 Messaging and Chat

Messaging (direct messages, group chat, broadcast channels) requires:
- Notification infrastructure
- Message delivery reliability
- Privacy controls and moderation policy
- Read receipt semantics
- Guardian boundary enforcement
- Consent and opt-out flows

None of these exist. The Entry visibility model defined here is a prerequisite for messaging boundaries, but messaging itself requires additional architecture beyond visibility policy. **Do not implement any messaging or chat surfaces.**

### 8.3 Notifications and Reminders

Automated notification/reminder delivery requires:
- A delivery channel (email, push, in-app)
- Preference management and opt-out
- Delivery reliability and retry guarantees
- Consent gating before first delivery
- A notification event taxonomy

None of these exist. Task due-date display in the UI is acceptable; automated delivery via any channel is not. **Do not implement notification or reminder delivery systems.**

### 8.4 AI Summarization

AI-assisted note capture, AI-suggested task prioritization, and AI-generated summaries require:
- Proven operational data volume
- Governance policy for AI use in sensitive operational contexts
- Review of athlete and guardian privacy obligations
- Explicit product decision on AI use case prioritization

The operational baseline is still being established and has not been pilot-validated. **Do not implement any AI-generated operational workflows or AI summarization.**

### 8.5 Automation and Escalation Systems

Escalation automation, reminder triggers, and task-assignment rule engines require:
- Reliable event sourcing and audit depth
- Explicit policy governance for automated actions
- A tested workflow execution model

None of these exist. **Do not implement automation engines or escalation workflows.**

### 8.6 Private Journal Surface

The Journal view is a filtered view of `PRIVATE` entries authored by the current user. It requires:
- The Entry model with `visibility = PRIVATE`
- A private read path that excludes all other actors
- A UI that clearly distinguishes private journal entries from operational records

Entry is not yet implemented. **Do not implement any Journal surface before Entry is live.**

### 8.7 Inbox Triage Runtime

The Inbox is a default capture container for new Entry records. It requires:
- The Entry model with `primaryContainerType = INBOX`
- Capture-first UX
- Triage lifecycle state transitions
- An inbox queue read surface

`InboxRoutingItem` in the current schema is a routing placeholder, not a full Inbox implementation. **Do not build Inbox triage UX on top of `InboxRoutingItem`.**

---

## 9. Required Before Entry Runtime — Prerequisite Checklist

The following items must be completed before any Entry schema implementation, migration, or runtime routes are introduced.

### Authorization Prerequisites

- [ ] **Per-record visibility enforcement library.** A centralized, reusable function that takes `(actorContext, record.visibility, record.authorPersonId, record.teamId, record.athletePersonId)` and returns `{ allowed: boolean }`. Must be tested with unit tests covering all visibility categories and all role types.
- [ ] **Visibility-aware query helpers.** Query helpers (Prisma `where` clause builders) that translate actor context into appropriate row-level filters for each visibility category. Dashboard, list, history, and detail queries must all use these helpers.
- [ ] **Private record exclusion in shared surfaces.** `PRIVATE` entries must be excluded from all shared dashboard counts, shared history panels, and list views. No shared aggregate count should include a `PRIVATE` entry not authored by the current user.
- [ ] **Guardian boundary enforcement function.** A reusable function that verifies `AthleteGuardianRelationship` linkage before granting `GUARDIAN_LINKED` or `SHARED` access to a guardian-role user. Must handle: no relationship, relationship present, inactive account, multiple athletes.
- [ ] **Visibility enforcement on note create/edit routes.** Once a note visibility field is used at runtime, the create/edit routes must validate that the actor's role permits the selected visibility category.

### Schema Prerequisites

- [ ] **Entry visibility enum defined in schema.** `EntryVisibility` enum with values: `PRIVATE`, `STAFF_ONLY`, `TEAM_STAFF`, `SHARED`, `GUARDIAN_LINKED`.
- [ ] **Entry schema shape finalized.** Field set, indexes, and supplemental table definitions locked (per Phase 7A design).
- [ ] **Entry status model decided.** Universal status enum vs. type-specific hybrid status — decision must be locked before schema is written.
- [ ] **EntryLink schema defined.** Polymorphic link table replacing current direct FKs on note/task records.

### Migration Prerequisites

- [ ] **FK dependency map complete.** All `ObservationNote` and `FollowUpTask` FK references across all routes, queries, and libs catalogued (Phase 9C complete ✅).
- [ ] **Backfill semantics resolved.** How existing notes (no title, no status) and tasks (no visibility) will be populated in the Entry migration must be explicitly decided and documented.
- [ ] **Staging migration dry-run passing.** A migration script must run end-to-end in a staging environment against representative data without data loss.
- [ ] **Operational history compatibility strategy defined.** `lib/operational-history.ts` must have a compatibility plan before migration — either dual-read or a single-table port with query parity.

### Validation Prerequisites

- [ ] **Note/task fixture coverage for migration.** Seed or test fixture records covering: note-linked task, event-linked task, standalone task, guardian-linked athlete note, `STAFF_ONLY` note, and multi-team scenario.
- [ ] **Visibility enforcement tests.** Unit tests proving that each visibility category correctly allows/denies access for each actor type defined in Section 5.

### Guardian-Facing Prerequisites (before activating `GUARDIAN_LINKED` visibility at runtime)

- [ ] **Guardian read path designed and implemented.** A guardian-facing route/page that returns only guardian-accessible records.
- [ ] **Consent/disclosure framework defined.** Before guardian users can read Entry records, a disclosure and consent model must be designed (deferred to Communications Architecture Track).
- [ ] **Pilot validation complete.** The operational foundation must be pilot-validated (Phase 8P Option E) before guardian-facing surfaces are considered for production.

---

## 10. Recommendations

### 10.1 Safest First Runtime Authorization Slice

The safest first implementation slice for Entry authorization is:

1. **Build the visibility enforcement library in isolation first**, before the Entry schema is added. Define the `evaluateVisibilityAccess(actorContext, visibilityCategory, ...)` function and test it against all role/visibility combinations. This proves the policy shape without any migration risk.
2. **Add `EntryVisibility` to the Prisma schema as an enum only**, with no new tables. Validate the schema compiles and the enum is usable. This is a zero-risk schema change.
3. **Apply visibility filtering to the existing `ObservationNote` queries** as a dry run. Since all notes are currently `STAFF_ONLY`, this should produce identical results to the current behavior while proving the filtering integration. This is a behavioral no-op that validates the framework.
4. **Do not activate guardian-facing paths in this slice.** The first runtime slice is staff-facing only.

### 10.2 What Should Remain Organization-Scoped Initially

The following should remain fully organization-scoped for the initial Entry MVP:

- **All dashboard counts and aggregates.** No per-visibility filtering needed for the dashboard's own access (all dashboard users are staff). The dashboard should exclude `PRIVATE` entries not authored by the current user, but staff users otherwise see all org entries.
- **Note and task list views.** Staff-facing list views should apply visibility filtering at the query layer, but the primary audience (staff roles) has access to `STAFF_ONLY`, `TEAM_STAFF` (within scope), `SHARED`, and `GUARDIAN_LINKED`. The biggest practical change for staff is exclusion of other users' `PRIVATE` entries.
- **Event and attendance data.** These models have no visibility field and are staff-scoped by route protection. Leave them organization-scoped without visibility changes until the Event migration is explicitly planned.

### 10.3 Visibility Rules Too Risky for MVP

The following visibility rules should not be activated in the first Entry MVP:

- **`PRIVATE` admin override.** Allowing organization admins to read another user's `PRIVATE` entries introduces compliance risk and builds an expectation among users that their private entries may be read by admins. This should only be added after explicit policy governance and audit logging are in place.
- **Guardian-facing `GUARDIAN_LINKED` access.** As detailed in Section 6.5, guardian-facing reads require consent framework, compliance review, and pilot validation before activation. `GUARDIAN_LINKED` as a category may be stored in the schema; the access path should not be opened in MVP.
- **`SHARED` for athletes.** Athlete self-access to `SHARED` entries requires a designed athlete-facing read path that does not exist. Do not open athlete access to `SHARED` entries until the athlete surface is explicitly designed and built.
- **Cross-household guardian visibility.** Any scenario where a guardian might see records linked to an athlete they are not directly related to (e.g., via team context) must be explicitly blocked. This edge case is a privacy boundary failure risk.
- **Task assignee access for non-staff roles.** Assigning a task to an athlete or guardian would require those users to have read access to that specific task. This is a novel access pattern that should be designed deliberately, not assumed to work from the assignee rule in Section 5.2.

---

## 11. Validation Summary

This Phase 9D document is based on the following implemented code paths reviewed as part of this architecture:

- `lib/permissions/index.ts` — permission action/scope evaluation
- `lib/guardian-relationship-access.ts` — guardian diagnostic access control
- `lib/guardian-operational-context.ts` — guardian operational status derivation
- `lib/organization-context.ts` — organization and user account resolution
- `lib/user-account.ts` — actor person attribution
- `prisma/schema.prisma` — `ObservationNote`, `FollowUpTask`, `Event`, `AttendanceRecord`, `RoleAssignment`, `AthleteGuardianRelationship`, `UserAccount`, `Person` model shapes
- `app/(dashboard)/notes/page.tsx` — current note list query and visibility badge rendering
- `app/(dashboard)/notes/create/route.ts` — note create authorization flow
- `planning/PERMISSIONS_MATRIX.md` — role/action matrix
- `planning/PHASE_9A_ENTRY_ARCHITECTURE_REVIEW.md` — Entry architecture assessment
- `planning/PHASE_9C_ENTRY_MIGRATION_DEPENDENCY_MAP.md` — migration dependency map and authorization gap review

Confirmed in this phase:

- No `Entry` runtime behavior was added.
- No `ObservationNote` or `FollowUpTask` migration was added.
- No Feed, Inbox, Journal, messaging, notification, or workflow automation behavior was added.
- No runtime code was modified. No typecheck/build run required.

---

## 12. PR Summary

This phase designs the per-record visibility and access policy architecture that must be in place before any unified `Entry` implementation is attempted.

### Key findings

1. **Current authorization is convention-based, not enforcement-based.** `ObservationNote.visibility = STAFF_ONLY` is a display label. No read-path query filter enforces it. `FollowUpTask` and `Event` have no visibility field at all. The system is safe today only because no guardian-facing read path exists.

2. **Five visibility categories are defined for Entry:** `PRIVATE`, `STAFF_ONLY`, `TEAM_STAFF`, `SHARED`, and `GUARDIAN_LINKED`. Each category has defined per-actor access rules for all seven actor types (author, assignee, org admin, coach/team staff, linked guardian, unrelated guardian, athlete).

3. **Guardian boundary has four hard requirements before activation:**
   - per-record visibility enforcement at the query layer
   - relationship-verified access (not role-only)
   - consent/disclosure framework
   - pilot validation completion

4. **The safest first runtime slice is:** visibility enforcement library (tested in isolation) → `EntryVisibility` enum in schema → dry-run visibility filtering on existing `ObservationNote` queries → staff-only for MVP → guardian surface deferred.

5. **Seven capability categories are explicitly blocked:** guardian feeds, messaging/chat, notifications, AI summarization, automation/escalation, private journal surface, inbox triage runtime.

### Recommended next step

Phase 9D is complete when this document is accepted. The recommended next step is:

- Lock Entry visibility semantics and status model decision.
- Scope Phase E1 (Entry schema implementation checkpoint) to: `EntryVisibility` enum, `Entry` table scaffolding (schema only), and visibility enforcement library implementation.
- Defer all data migration and runtime route replacement until the library is tested and the schema is stable.
