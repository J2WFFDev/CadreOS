# Phase 9A — Entry Architecture Review and Migration Strategy Assessment

## Purpose

This document performs a deliberate, architecture-first review of the current operational model structure before any implementation of a unified Entry model is attempted. It evaluates the strengths and weaknesses of the current separated-model approach, defines the risks and complexity of a unified Entry migration, and provides a recommendation for the safest next architectural step.

**No runtime Entry behavior is implemented in this phase.**
**No Feed, Inbox, Journal, messaging, notifications, or workflow automation is implemented in this phase.**

---

## 1. Current Operational Model Structure

### Implemented production models (as of Phase 8P closeout)

#### ObservationNote
- **Purpose:** Staff observation with optional athlete, team, and event context links.
- **Key fields:** `organizationId`, `authorPersonId`, `athletePersonId?`, `teamId?`, `eventId?`, `body`, `visibility` (single value: `STAFF_ONLY`), `createdAt`, `updatedAt`.
- **Status lifecycle:** No explicit status enum. Notes are live or soft-deleted only via workflow decisions (currently no archive/delete mechanism in UI).
- **Authorization:** Staff-only; visibility is a single-value enum with no runtime scoping logic yet.
- **Relationships:** links to `Person` (author), `Person?` (athlete), `Team?`, `Event?`, and `FollowUpTask[]` (sourced tasks).
- **Strengths:** Simple, fast, low-noise schema. No lifecycle complexity.
- **Weaknesses:** No status enum, no archive path, no tag support, no priority signal, single hard-coded visibility value, no container model, no general-purpose capture concept.

#### FollowUpTask
- **Purpose:** Accountable action item with ownership, optional due date, and source links.
- **Key fields:** `organizationId`, `title`, `description?`, `status` (`OPEN`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `CANCELLED`), `assigneePersonId`, `createdByPersonId`, `dueAt?`, `sourceNoteId?`, `sourceEventId?`, `sourceInboxItemId?`.
- **Status lifecycle:** Full operational lifecycle (`OPEN` → `IN_PROGRESS` → `BLOCKED` → `DONE`/`CANCELLED`).
- **Authorization:** Scoped to organization. Filtered by assignee in dashboard/task list queries.
- **Relationships:** links to `Person` (assignee), `Person` (createdBy), `ObservationNote?`, `Event?`, `InboxRoutingItem?`.
- **Strengths:** Clear lifecycle, assignee ownership, source-link continuity, due-date support.
- **Weaknesses:** No team-level or program-level container scoping, no visibility/privacy field, no tag support.

#### Event
- **Purpose:** Scheduled time-bound activity with RSVP and attendance tracking.
- **Key fields:** `organizationId`, `programId`, `teamId?`, `title`, `eventType` (enum), `status` (`DRAFT`, `PUBLISHED`, `COMPLETED`, `ARCHIVED`), `startsAt`, `endsAt?`, `location?`, `createdByPersonId`.
- **Status lifecycle:** `DRAFT` → `PUBLISHED` → `COMPLETED` → `ARCHIVED`.
- **Authorization:** Organization + program scoped. `createdByPersonId` tracks attribution.
- **Relationships:** links to `Program`, `Team?`, `Person` (creator), `RSVP[]`, `AttendanceRecord[]`, `ObservationNote[]`, `FollowUpTask[]`, `ResourceBooking[]`.
- **Strengths:** Strong lifecycle, full RSVP + attendance integration, cross-linked to notes and tasks.
- **Weaknesses:** Event is both an operational record and a future Entry concept candidate — overlap with Entry's Event type creates naming/migration tension.

#### RSVP
- **Purpose:** Availability/intent record for events.
- **Key fields:** `eventId`, `personId`, `status` (`GOING`, `NOT_GOING`, `MAYBE`), `reason?`.
- **Lifecycle:** Per-person per-event, upsert semantics.
- **Relationships:** links to `Event`, `Person`.

#### AttendanceRecord
- **Purpose:** Actual attendance outcome per person per event.
- **Key fields:** `eventId`, `personId`, `status` (`PRESENT`, `LATE`, `EXCUSED_ABSENT`, `UNEXCUSED_ABSENT`), `reasonCode?`, `markedByPersonId`, `markedAt`.
- **Lifecycle:** Per-person per-event, unique constraint.
- **Relationships:** links to `Event`, `Person` (attendee), `Person` (marker).

#### InboxRoutingItem
- **Purpose:** Metadata routing/workflow support item. Not a full unified content entry model.
- **Key fields:** `organizationId`, `category`, `subjectRefType` (string), `subjectRefId` (string), `priority` (int), `status` (`OPEN`, `TRIAGED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`), `ownerPersonId?`, `createdByPersonId`.
- **Role:** Routing layer only; no content body. Bridges source content to workflow queue.
- **Relationships:** links to `Person?` (owner), `Person` (creator), `FollowUpTask[]`.
- **Strengths:** Generic routing, lifecycle management, owner assignment.
- **Weaknesses:** Not a content model; `subjectRefType`/`subjectRefId` use untyped string polymorphism with no FK enforcement. Has no content. Currently not widely used in production UI.

#### Dashboard / Review Workflows (read-layer)
- Operational dashboard panels are **read-model derivations** over existing `ObservationNote`, `FollowUpTask`, `Event`, and `AttendanceRecord` queries.
- Dashboard rows summarize: readiness, stale/unresolved tasks, attendance gaps, recent activity, priority focus.
- No separate aggregation tables. Heuristic status windows are computed from `status`, `dueAt`, and `createdAt` at query time.

#### Relationship / Ownership / Readiness Workflows
- Guardian context is centralized in `lib/guardian-operational-context.ts`, derived from `AthleteGuardianRelationship`.
- Readiness indicators are derived from presence/absence of recent notes, open tasks, and attendance gaps.
- No separate readiness or ownership tables exist.

---

## 2. Evaluation: Strengths of the Separated-Model Approach

1. **Operational clarity.** Each model has a single, clear purpose. `ObservationNote` captures observations. `FollowUpTask` tracks accountability. `Event` schedules activities. There is no ambiguity about which table to query.
2. **Lifecycle independence.** Each model has its own status enum appropriate to its type. Tasks have `OPEN/IN_PROGRESS/BLOCKED/DONE/CANCELLED`. Events have `DRAFT/PUBLISHED/COMPLETED/ARCHIVED`. Notes have no formal status (intentionally simple). Conflating them under one status would have required compromises.
3. **Schema simplicity.** Each table is small, well-indexed, and easy to query. Cross-link queries (e.g., tasks linked to a note) are explicit FK joins.
4. **Authorization clarity.** Notes are staff-only. Tasks are assignee-filtered. Events are organization + program scoped. Each model's authorization is straightforward.
5. **Low migration risk during MVP.** No cross-model migration was required to ship operational workflows.
6. **Audit and continuity traceability.** Source links (`sourceNoteId`, `sourceEventId`, `sourceInboxItemId`) preserve provenance without requiring a shared parent table.

---

## 3. Evaluation: Weaknesses of the Separated-Model Approach

1. **No unified capture path.** There is no single "quick capture" interface. Users must decide upfront whether they are creating a note, task, or event — even for ambiguous items.
2. **No Inbox abstraction.** There is no landing zone for uncategorized operational context. `InboxRoutingItem` is a routing model only, not a content model.
3. **Visibility model fragmentation.** `ObservationNote` has `visibility: NoteVisibility` (single value). `FollowUpTask` and `Event` have no visibility field. Implementing parent/guardian-facing feeds, private journal, or scoped sharing would require adding visibility independently to each model.
4. **Tag and container absence.** Neither `ObservationNote` nor `FollowUpTask` supports tags or a primary container concept. Filtering by operational context requires custom queries per model.
5. **Status normalization complexity.** Future inbox/feed behavior needs a normalized lifecycle concept (e.g., `CAPTURED` → `TRIAGED` → `FILED`) but each model has its own lifecycle enum. Building a unified inbox requires mapping all existing statuses to a shared triage lifecycle.
6. **Cross-type conversion friction.** Converting a note into a task (or a task into an event) requires custom code per conversion path. There is no shared Entry parent to transfer ownership/context to.
7. **Reporting query divergence.** Count/summary queries must fan out across `ObservationNote`, `FollowUpTask`, and `Event` independently. Unified reporting (e.g., "all operational activity this week") requires UNION queries or multiple round-trips.
8. **InboxRoutingItem underutilization.** The routing model has lifecycle semantics (`OPEN`, `TRIAGED`, `RESOLVED`) but no content. It is an early placeholder, not a true inbox capture model.

---

## 4. Proposed Entry Architecture Concepts

### Core concept

`Entry` is a future unified capture model that abstracts all operational content (Note, Task, Event, Decision, Contact Note) under a single schema, enabling:

- Rapid capture with late classification
- A default landing zone (`Inbox`) before routing to a container
- Uniform visibility and privacy controls
- Uniform lifecycle status (capture → triage → file → complete/archive)
- Type-specific supplemental detail where needed

### Key design decisions already made (prior planning)

- Long-term direction: **Option B (unified Entry model)**, phased carefully.
- Default captured Entry type: **Task**.
- Default container: **Inbox**.
- One primary container per Entry; many optional links.
- Visibility must be explicit in UI.
- Staff-only content must not be exposed to parent/guardian users.
- Messaging/DM must not be implemented before Feed + Entry stabilize.

### Entry type taxonomy

| Type | Purpose | Current equivalent |
|---|---|---|
| Task | Accountable action item | `FollowUpTask` |
| Note | Observation, context, narrative | `ObservationNote` |
| Event | Scheduled time-bound activity | `Event` (partial) |
| Decision | Recorded determination + rationale | None (not yet implemented) |
| Contact Note | Interaction history with a person | None (not yet implemented) |

### Proposed Entry schema shape (planning only — not for implementation yet)

See `PHASE_7A_ENTRY_INBOX_SCHEMA_DESIGN.md` for detailed field-level schema drafts. Key structural concepts:

- `Entry`: core fields — `id`, `organizationId`, `authorPersonId`, `type` (enum), `status` (string), `visibility` (enum), `title`, `body?`, `primaryContainerType`, `primaryContainerId?`, `dueAt?`, `assignedToPersonId?`, `priority?`, timestamps.
- `EntryLink[]`: polymorphic links to related records without changing primary container.
- `EntryTag[]`: normalized tags with organization-scoped governance.
- `EntryDecisionDetail?`: optional decision-specific fields (statement, rationale, alternatives).
- `EntryContactDetail?`: optional contact-interaction-specific fields.

---

## 5. Migration Complexity Assessment

### 5.1 ObservationNote → Entry (type: NOTE)

| Factor | Assessment |
|---|---|
| Field coverage | `body` → `body`. Author, org scope, timestamps map cleanly. |
| Missing Entry fields | No `title` on ObservationNote — requires backfill or derivation (e.g., first 50 chars of body). |
| Visibility mapping | Single-value `STAFF_ONLY` → `STAFF_ONLY` in Entry visibility enum. Low complexity. |
| Status mapping | No status enum on ObservationNote → default `FILED` or `CAPTURED` on migration. Risk: ambiguous initial state. |
| Links | `athletePersonId`, `teamId`, `eventId` → `EntryLink` records. Existing FK semantics must be preserved as explicit links. |
| Source FK usage | `FollowUpTask.sourceNoteId` → must remap to `sourceEntryId` or dual-write during transition window. |
| Rollback risk | Removing `ObservationNote` model breaks all task source FK references without a migration script. |

### 5.2 FollowUpTask → Entry (type: TASK)

| Factor | Assessment |
|---|---|
| Field coverage | `title`, `description`, `status`, `assigneePersonId`, `createdByPersonId`, `dueAt` map cleanly. |
| Missing Entry fields | No `visibility` on FollowUpTask — requires a default on migration. |
| Status mapping | `OPEN/IN_PROGRESS/BLOCKED/DONE/CANCELLED` → Entry type-specific task status. Low complexity if type-specific status is preserved. |
| Source FK usage | `sourceNoteId`, `sourceEventId`, `sourceInboxItemId` → `EntryLink[]` on the new Entry record. References must remain consistent. |
| Assignee continuity | `assigneePersonId` maps to `assignedToPersonId` in Entry. No risk if migrated atomically. |
| Rollback risk | Removing `FollowUpTask` without dual-write period breaks dashboard task queries and all existing filter/sort behavior. |

### 5.3 Event → Entry (type: EVENT)

| Factor | Assessment |
|---|---|
| Scope | `Event` is the most complex migration candidate. It is the primary scheduling model with RSVP and attendance FK chains. |
| FK dependencies | `RSVP.eventId`, `AttendanceRecord.eventId`, `ObservationNote.eventId`, `FollowUpTask.sourceEventId`, `ResourceBooking.eventId` — all reference `Event` directly. A migration must either preserve `Event` as a wrapper or update all downstream FKs atomically. |
| Status mapping | `DRAFT/PUBLISHED/COMPLETED/ARCHIVED` → Entry status. Clean mapping but event-specific semantics must be preserved. |
| Specialized fields | `eventType`, `startsAt`, `endsAt`, `location`, `programId`, `teamId` are event-specific and have no equivalent in core Entry. Would require a supplemental `EntryEventDetail` table or retention of `Event` as a linked record. |
| Assessment | Migrating `Event` into Entry before RSVP/attendance FK refactoring would be extremely high risk. Recommended: leave `Event` out of the initial Entry migration scope. |

### 5.4 InboxRoutingItem → Entry

| Factor | Assessment |
|---|---|
| Current role | Routing/workflow metadata only. No content body. |
| Migration path | Could be deprecated in favor of Entry's Inbox container concept. `subjectRefType`/`subjectRefId` polymorphism would be replaced by `EntryLink` records. |
| Risk | Low risk to deprecate if `FollowUpTask.sourceInboxItemId` references are migrated first. |

---

## 6. Authorization Complexity

### Current authorization approach

- `ObservationNote`: implicitly staff-only via access control in server components/routes (no row-level policy).
- `FollowUpTask`: assignee-filtered and organization-scoped; no visibility field.
- `Event`: organization + program scoped; no visibility field.
- All authorization relies on organization-scope context resolution and role checks (via `RoleAssignment`).

### Entry authorization requirements

| Concern | Complexity |
|---|---|
| Visibility field enforcement | Entry introduces a `visibility` field (`PRIVATE`, `STAFF_ONLY`, `SHARED`). Every read path must filter by visibility against the actor's role. Currently no framework exists for this. |
| Private entries | PRIVATE entries must be readable only by `authorPersonId`. Dashboard queries must exclude them for other actors. |
| Staff-only enforcement | Currently implicit via route protection. Entry requires this to become explicit per-record policy. |
| Guardian access | Entry visibility expansion (e.g., `LINKED_GUARDIAN`) requires relationship-scope checks, not just org-scope checks. `AthleteGuardianRelationship` must gate access per entry, per person link. This is substantially more complex than current implementation. |
| Assignee vs owner vs author | An Entry has `authorPersonId` and optionally `assignedToPersonId`. Authorization rules for who can view/edit must be defined and enforced consistently across all surfaces. |
| FieldOps / cross-domain access | Future Entry links to `ResourceBooking` records introduce authorization surface at the domain boundary. |

**Assessment:** Authorization maturity is currently insufficient for a safe unified Entry rollout. Per-record visibility enforcement is not yet present in the codebase. Implementing Entry before authorization hardening introduces material visibility-leakage risk.

---

## 7. Historical Continuity Concerns

1. **Audit trail continuity.** Current `AuditEvent` records reference `entityType: 'ObservationNote'` and `entityType: 'FollowUpTask'`. A migration must either backfill audit entries with new Entry IDs or maintain a legacy-reference lookup layer.
2. **Source link preservation.** `FollowUpTask.sourceNoteId` is a hard FK. If `ObservationNote` is removed, all tasks that reference a source note lose provenance. This cannot be silently migrated without an explicit continuity strategy.
3. **Operational history queries.** Dashboard history panels currently query `ObservationNote` and `FollowUpTask` directly. After migration, these queries must be updated atomically with the data migration — no partial transition window is safe without dual-read support.
4. **Stale reference risk.** If a migration runs non-atomically, operational dashboard panels querying both old and new tables simultaneously may show duplicate, missing, or inconsistent records.
5. **Search/filter continuity.** Task filter parameters (status, assigneePersonId, dueWindow) and note filter parameters (athletePersonId, teamId, eventId) must continue to work post-migration. URL-based deep links and saved query patterns depend on consistent filter semantics.

---

## 8. Operational Workflow Impact

| Workflow | Migration impact |
|---|---|
| Notes list/detail/create/edit | All routes reference `ObservationNote` directly. Full route refactor required. |
| Tasks list/detail/create/edit | All routes reference `FollowUpTask` directly. Full route refactor required. |
| Dashboard panels | Heuristic queries fan out across both models. Must be updated with Entry queries atomically. |
| Event-linked notes/tasks | `ObservationNote.eventId` and `FollowUpTask.sourceEventId` would become `EntryLink` records. Continuity for event detail pages requires link-aware queries. |
| Attendance-linked follow-up | Attendance gap → task creation continuity must be preserved through new Entry link semantics. |
| Guardian context indicators | Notes with `athletePersonId` surface in guardian context workflows. Must remain queryable post-migration. |
| FieldOps approval links | `ResourceBooking` ↔ `FollowUpTask` source links are used in booking workflow follow-up. Must be preserved. |

**Assessment:** The operational workflow impact of a full migration is high. Every route that touches notes or tasks requires refactoring. A phased dual-model transition with read compatibility is the minimum acceptable safety strategy.

---

## 9. Reporting / Query Impact

1. **Count queries** today are per-model (e.g., `count(ObservationNote where organizationId = X and athletePersonId = Y`). After migration they must include Entry type filter (e.g., `count(Entry where type = NOTE and ...`).
2. **Date-range filters** are currently applied directly to model timestamps. Unified Entry exposes `createdAt`, `dueAt`, and `scheduledAt` in one place — this is a simplification, but requires query rewrites.
3. **Cross-type aggregation** (e.g., "all operational activity for person X this week") currently requires multi-model UNION queries. Entry enables single-table queries, but only after full migration.
4. **Status filters** are currently model-specific. After migration, status filters must understand the type-specific lifecycle within a single Entry status field or a hybrid status field.
5. **Existing URL query parameters** (e.g., `?status=OPEN`, `?assigneePersonId=X`) are embedded in the task list route. After migration, these parameter names must remain stable or all current links break.

---

## 10. Future Feed / Inbox Implications

The Entry model is foundational to both Feed and Inbox behavior, which are both explicitly deferred to post-MVP phases:

- **Feed** requires a role-aware stream derived from Entry visibility + container + links + role. This is not feasible on top of separate `ObservationNote`/`FollowUpTask`/`Event` models without a mapping layer.
- **Inbox** requires a default capture container with triage lifecycle. The current `InboxRoutingItem` model exists but is not a full Inbox. Entry's `primaryContainerType = INBOX` is the designed Inbox foundation.
- **Journal** is a filtered Entry view over `visibility = PRIVATE` and `authorPersonId = actorPersonId`. It has no equivalent today.
- **Notifications/reminders** are deferred entirely and require their own delivery channel architecture before building on Entry.

The implication is: **Entry is a prerequisite for Feed, Inbox, and Journal — but Entry itself requires authorization maturity and migration safety before it can be implemented.**

---

## 11. Do Not Implement Yet

The following capabilities are explicitly blocked from implementation in current and near-term phases. They are listed here as a guardrail reference.

### 11.1 Feed runtime behavior
- Feed requires a unified Entry model AND role-aware visibility policy AND container-scoped access control. None of these are fully in place.
- Implementing Feed on top of current separate models would produce a fragmented, unmaintainable read layer.
- **Do not implement Feed until Entry is live and authorization is hardened.**

### 11.2 Inbox triage
- The current `InboxRoutingItem` is a routing placeholder, not a full Inbox. Do not build inbox triage UX on top of it.
- True Inbox triage requires Entry's primary container concept and capture-first UX.
- **Do not implement Inbox triage until Entry Inbox container behavior is implemented.**

### 11.3 Messaging and chat
- Messaging (DM, group chat, broadcast) requires notification infrastructure, moderation policy, privacy controls, read receipts, and parent/guardian boundary enforcement.
- None of these prerequisites exist.
- **Do not implement messaging or chat under any phase label until Feed + Entry + notification architecture are stable.**

### 11.4 Notifications and reminders
- Notification/reminder delivery requires a channel delivery architecture (email, push, in-app), preference management, opt-out/consent flows, and reliability guarantees.
- None of these exist. CadreOS has no notification delivery infrastructure.
- **Do not implement notifications or reminders as a runtime system yet.** Task due-date display is acceptable; automated delivery is not.

### 11.5 AI-generated operational workflows
- AI-generated notes, AI-suggested tasks, and AI-prioritized operational queues require a proven operational baseline, data volume confidence, and a clear governance model.
- The operational baseline is still being established.
- **Do not implement AI-generated operational workflows until the operational Foundation MVP has been pilot-validated.**

### 11.6 Workflow automation engines
- Escalation automation, reminder triggers, and task-assignment rule engines require reliable event sourcing, audit depth, and explicit policy governance.
- None of these exist.
- **Do not implement workflow automation engines in current or near-term phases.**

---

## 12. Migration Risk Areas

### 12.1 Data continuity
- All existing `ObservationNote` and `FollowUpTask` records must be migrated atomically or remain dual-readable during a coexistence window.
- Any migration that leaves records in a partial state risks permanent data loss.
- **Risk level: HIGH.** Requires a tested, reversible migration script with a full backup checkpoint before execution.

### 12.2 Stale references
- `FollowUpTask.sourceNoteId` will become a stale FK if `ObservationNote` is removed without updating or remapping references.
- `AuditEvent.entityType` values referencing `ObservationNote` and `FollowUpTask` will become unresolvable without a legacy-type lookup.
- `RSVP.eventId` and `AttendanceRecord.eventId` must remain valid even if `Event` gains a dual representation under Entry.
- **Risk level: HIGH.** Every stale FK must be catalogued and resolved before the old model can be removed.

### 12.3 Authorization leakage
- Current models have no per-record visibility field. If Entry is introduced with `visibility` fields but existing authorization checks are not updated to enforce them, all staff-only content becomes visible to any authenticated user.
- Guardian-facing entry visibility requires per-relationship-scoped authorization checks that do not currently exist.
- **Risk level: HIGH.** Entry must not be introduced until per-record visibility enforcement is implemented and tested.

### 12.4 Orphaned workflow relationships
- Dashboard panels, guardian context indicators, and event-detail continuity links all reference `ObservationNote` and `FollowUpTask` by their current model types.
- Migrating records without updating query paths leaves operational panels empty or broken.
- **Risk level: MEDIUM-HIGH.** All workflow surfaces reading from these models must be catalogued and updated before migration.

### 12.5 Reporting / query regressions
- Count queries, filter parameters, and sort semantics will change post-migration.
- Dashboard metric cards and task/note list queries may silently return wrong counts if model switches happen without query updates.
- **Risk level: MEDIUM.** Requires a pre/post migration query audit comparing result sets.

### 12.6 Operational continuity disruption
- If migration is performed while the system is in active use, in-flight note/task operations may write to the old model while new reads come from Entry, producing split-brain state.
- **Risk level: MEDIUM-HIGH.** Migration must be coordinated with a maintenance window or a dual-write compatibility layer.

---

## 13. Possible Migration Strategies

### Strategy 1: Adapter / Wrapper Strategy

**Concept:** Introduce an `Entry` table that wraps existing `ObservationNote` and `FollowUpTask` records via a reference field (e.g., `legacyNoteId?`, `legacyTaskId?`). Old tables remain unchanged. Reads can go through the Entry layer; writes continue to the legacy models during a transition period.

**Pros:**
- Lowest short-term risk. Existing routes continue to function.
- Allows incremental migration of specific workflows to the Entry API.
- Easy rollback: drop the Entry wrapper; nothing in the old models changed.
- Enables progressive UI migration without a flag day.

**Cons:**
- Two sources of truth during transition. Sync complexity grows.
- Wrapper FK semantics are not enforced by the database (old model + new wrapper = eventual consistency risk).
- Transition period can become indefinitely long without explicit exit criteria.
- Visibility and status fields on Entry must stay in sync with old models.

**Best fit for:** Low-risk incremental entry point when operational confidence in Entry shape is not yet established. Good if the team wants to validate Entry behavior on real data before full commitment.

### Strategy 2: Parallel-Model Strategy

**Concept:** `Entry` is introduced as a fully independent model alongside `ObservationNote` and `FollowUpTask`. New note/task records are written to `Entry` only. Old records remain in legacy models. Eventually legacy tables are deprecated after all legacy records age out or are backfilled.

**Pros:**
- No immediate migration of old data required.
- New capture behavior can be built cleanly on Entry.
- Old records retain full FK integrity.
- Allows gradual traffic migration.

**Cons:**
- Reports and dashboards must query both tables during coexistence period.
- "Where is my data?" confusion for mixed legacy/new records.
- Entry features (tags, containers, visibility) are unavailable on legacy records until backfill is done.
- Backfill from legacy models into Entry is eventually still required.

**Best fit for:** Greenfield new entry types (e.g., Decision, Contact Note) where there is no legacy data to migrate. Less suitable for Note/Task which have substantial existing records.

### Strategy 3: Phased Migration Strategy

**Concept:** Migration proceeds in ordered, validated stages:
1. **Stage 0:** Define Entry schema + authorization model. Validate in staging.
2. **Stage 1:** Migrate `ObservationNote` → Entry (type: NOTE). Dual-write for 2 weeks. Validate.
3. **Stage 2:** Migrate `FollowUpTask` → Entry (type: TASK). Dual-write for 2 weeks. Validate.
4. **Stage 3:** Deprecate legacy models. Remove old tables.
5. **Stage 4 (long-term):** Evaluate `Event` migration separately.

**Pros:**
- Reduces risk by isolating each migration step.
- Dual-write window catches query regressions before legacy tables are dropped.
- Each stage can be validated and rolled back independently.

**Cons:**
- Requires explicit dual-write logic in create/update routes.
- Timeline is long; team must maintain migration discipline to advance stages.
- Dual-write period introduces temporary complexity in route handlers.

**Best fit for:** A production system with live operational data where correctness is higher priority than migration speed. Recommended as the safest path if Entry migration proceeds.

### Strategy 4: Hard-Cut Migration Strategy

**Concept:** A one-time migration script transforms all `ObservationNote` and `FollowUpTask` records into `Entry` records in a single transaction. Old tables are dropped after migration. All routes are updated atomically.

**Pros:**
- Clean cut. No split-brain period.
- No dual-write complexity.
- Simpler long-term query model.

**Cons:**
- Highest immediate risk. If the migration script has a bug, all operational data is at risk.
- Requires a full system downtime/maintenance window.
- Requires all routes to be updated before migration to avoid broken queries.
- No rollback path without a full database restore.
- Any FK issue (stale references, missing mappings) is discovered too late.

**Best fit for:** Only appropriate after all prior migration strategies have been validated in staging with a complete data snapshot, and only after all FK dependency mapping is confirmed clean. Not appropriate for a first migration attempt.

---

## 14. Recommendation

### 14.1 Safest next architectural step

**Do not implement Entry runtime behavior yet.**

The safest next architectural step is to complete the following prerequisite validation work before any Entry schema changes are introduced:

1. **Enumerate all FK dependencies** on `ObservationNote` and `FollowUpTask` across every route, query, and component in the codebase. Produce a dependency map.
2. **Define per-record visibility enforcement design.** Design and document the authorization layer that will enforce `visibility` on Entry records before any Entry table is created.
3. **Draft a reversible migration script** for `ObservationNote` → Entry (type: NOTE) and test it in staging against a full data snapshot. Do not run in production yet.
4. **Define Entry status model** (universal vs type-specific hybrid) and lock this decision before implementation begins.
5. **Pilot-validate the operational Foundation MVP** (as recommended in Phase 8P Option E) to build a stable data baseline before introducing migration complexity.

### 14.2 Should Entry migration proceed yet?

**No.** Entry migration should not proceed until:

- [ ] Authorization maturity gate: per-record visibility enforcement is designed, implemented, and tested.
- [ ] FK dependency map is complete: all references to `ObservationNote` and `FollowUpTask` are catalogued.
- [ ] Staging migration test is passing: a full dry-run migration of real data (from a production snapshot) completes without data loss, stale reference errors, or query regressions.
- [ ] Entry status model is locked: the universal-vs-type-specific hybrid decision is finalized.
- [ ] Pilot validation is complete: operational Foundation MVP has been validated in real usage to confirm stable data volume and workflow patterns.
- [ ] Entry schema shape is finalized: field set, index design, and supplemental detail table structure are locked (not just conceptual).

### 14.3 Prerequisite validation / testing still needed

| Gate | Current status | Blocking? |
|---|---|---|
| Per-record visibility enforcement design | Not designed | Yes |
| FK dependency cataloguing across all routes | Not done | Yes |
| Entry schema finalized (not just conceptual) | Partial (7A draft exists) | Yes |
| Entry status model locked | Open decision | Yes |
| Staging migration dry-run | Not done | Yes |
| Pilot operational validation | Not done | Strongly recommended |
| Authorization hardening for guardian-scoped visibility | Not done | Yes (for guardian feeds) |
| Decision + Contact Note behavior defined | Not defined | No (can defer to post-Entry-MVP) |

---

## 15. Source References

- [Notes / Inbox / Entry Model](./NOTES_INBOX_ENTRY_MODEL.md)
- [Phase 6B Entry / Inbox / Feed / Journal Plan](./PHASE_6B_ENTRY_INBOX_FEED_JOURNAL_PLAN.md)
- [Phase 7A Entry / Inbox Schema Design](./PHASE_7A_ENTRY_INBOX_SCHEMA_DESIGN.md)
- [Phase 8P Operational Foundation MVP Closeout](./PHASE_8P_OPERATIONAL_FOUNDATION_MVP_CLOSEOUT.md)
- [Phase 2D Notes / Observations](./PHASE_2D_NOTES_OBSERVATIONS.md)
- [Phase 2E Follow-up Tasks](./PHASE_2E_FOLLOW_UP_TASKS.md)
- [Phase 2A Event Management](./PHASE_2A_EVENT_MANAGEMENT.md)
- [Phase 4E Basic Authorization](./PHASE_4E_BASIC_AUTHORIZATION.md)
- [Prisma Schema](../prisma/schema.prisma)
