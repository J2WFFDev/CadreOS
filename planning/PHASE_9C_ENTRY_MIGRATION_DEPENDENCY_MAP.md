# Phase 9C — Entry Migration Dependency Map and Authorization Gap Review

## Purpose

This document records the concrete migration dependencies and authorization gaps that must be resolved before any `Entry` schema or runtime work begins.

Phase 9C is documentation-only:

- No `Entry` model implementation is added in this phase.
- No `ObservationNote` or `FollowUpTask` migration is added in this phase.
- No Feed, Inbox, Journal, messaging, notifications, or workflow automation runtime behavior is added in this phase.
- No FieldOps scope is expanded in this phase.
- No schema redesign is performed in this phase.

This review is based on the current implemented code paths in:

- `prisma/schema.prisma`
- `app/(dashboard)/notes/**`
- `app/(dashboard)/tasks/**`
- `app/(dashboard)/events/[eventId]/page.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/people/[personId]/page.tsx`
- `app/(dashboard)/teams/[teamId]/page.tsx`
- `lib/operational-history.ts`
- `lib/permissions/index.ts`
- `lib/guardian-relationship-access.ts`
- `lib/guardian-operational-context.ts`
- `lib/organization-context.ts`
- `planning/PHASE_7A_ENTRY_INBOX_SCHEMA_DESIGN.md`
- `planning/PHASE_9A_ENTRY_ARCHITECTURE_REVIEW.md`

---

## 1. Current Model Dependency Map

### 1.1 Prisma models and FK shape

#### `ObservationNote`

Current schema (`prisma/schema.prisma`) depends on:

- `organizationId -> Organization` (required, `onDelete: Restrict`)
- `authorPersonId -> Person` via `NoteAuthor` (required, `onDelete: Restrict`)
- `athletePersonId -> Person` via `NoteAthlete` (optional, `onDelete: SetNull`)
- `teamId -> Team` (optional, `onDelete: SetNull`)
- `eventId -> Event` (optional, `onDelete: SetNull`)
- reverse relation `tasks -> FollowUpTask[]`

Current indexes:

- `[organizationId, createdAt]`
- `[organizationId, athletePersonId, createdAt]`
- `[organizationId, teamId, createdAt]`

#### `FollowUpTask`

Current schema (`prisma/schema.prisma`) depends on:

- `organizationId -> Organization` (required, `onDelete: Restrict`)
- `assigneePersonId -> Person` via `TaskAssignee` (required, `onDelete: Restrict`)
- `createdByPersonId -> Person` via `TaskCreator` (required, `onDelete: Restrict`)
- `sourceNoteId -> ObservationNote` (optional, `onDelete: SetNull`)
- `sourceEventId -> Event` (optional, `onDelete: SetNull`)
- `sourceInboxItemId -> InboxRoutingItem` (optional, `onDelete: SetNull`)

Current indexes:

- `[organizationId, status, dueAt]`
- `[organizationId, assigneePersonId, status]`
- `[organizationId, sourceNoteId]`
- `[organizationId, sourceEventId]`

#### `InboxRoutingItem`

Current schema (`prisma/schema.prisma`) depends on:

- `organizationId -> Organization` (required, `onDelete: Restrict`)
- `ownerPersonId -> Person` via `InboxOwner` (optional, `onDelete: SetNull`)
- `createdByPersonId -> Person` via `InboxCreatedBy` (required, `onDelete: Restrict`)
- reverse relation `tasks -> FollowUpTask[]`

Current indexes:

- `[organizationId, status, priority]`
- `[organizationId, ownerPersonId, status]`
- polymorphic `subjectRefType` + `subjectRefId` remain string fields without FK enforcement

#### Event-linked note/task references

Current schema dependencies:

- `ObservationNote.eventId -> Event.id`
- `FollowUpTask.sourceEventId -> Event.id`
- task queries also depend on note-linked event context through `FollowUpTask.sourceNoteId -> ObservationNote.eventId`

This means Entry migration work cannot treat event linkage as a single edge. It currently exists in two forms:

1. direct task-to-event linkage (`sourceEventId`)
2. indirect task-to-event linkage through note context (`sourceNote.eventId`)

---

## 2. Implemented Code Path Map

### 2.1 Notes surfaces (`ObservationNote`)

#### Read paths

- `app/(dashboard)/notes/page.tsx`
  - list query
  - direct filters by `teamId`, `athletePersonId`, `eventId`, `authorPersonId`
  - derived readiness filtering based on linked task status and note age
  - guardian-context filtering through `athlete.athleteLinks`
- `app/(dashboard)/notes/[noteId]/page.tsx`
  - detail query
  - linked task display
  - event, team, athlete, author display
- `app/(dashboard)/notes/new/page.tsx`
  - note creation form loads people, teams, events used for note linking
- `app/(dashboard)/notes/[noteId]/edit/page.tsx`
  - note edit form loads the note plus people, teams, events
- `app/(dashboard)/events/[eventId]/page.tsx`
  - event detail page reads event-linked notes and their linked task counts
- `app/(dashboard)/dashboard/page.tsx`
  - counts recent notes
  - loads recent notes
  - loads notes needing attention
  - deep-links into note filters
- `app/(dashboard)/people/[personId]/page.tsx`
  - reads notes authored by or linked to the selected person
- `app/(dashboard)/teams/[teamId]/page.tsx`
  - reads notes linked directly to the team or indirectly through team events
- `lib/operational-history.ts`
  - reads notes into person/team/event/dashboard operational history panels
- `lib/permissions/index.ts`
  - reads note scope to resolve permission context for note and task mutations

#### Write/update paths

- `app/(dashboard)/notes/create/route.ts`
  - creates `ObservationNote`
  - validates `athletePersonId`, `teamId`, `eventId`
  - resolves `authorPersonId`
- `app/(dashboard)/notes/[noteId]/edit/update/route.ts`
  - updates note body and optional links
  - validates `athletePersonId`, `teamId`, `eventId`

#### Linking/dependency paths

- `app/(dashboard)/notes/[noteId]/page.tsx`
  - link to create follow-up task with `sourceNoteId`
- `app/(dashboard)/events/[eventId]/page.tsx`
  - links into `/notes/new?eventId=...`
  - links into `/notes?eventId=...`
- `app/(dashboard)/dashboard/page.tsx`
  - links into `/notes?readinessIndicator=needs_review`
  - links into `/notes?eventId=...`

### 2.2 Task surfaces (`FollowUpTask`)

#### Read paths

- `app/(dashboard)/tasks/page.tsx`
  - list query
  - reads assignee, creator, source note, source event, source inbox item
  - derives team context from event + note + note.event
  - derives responsible-context state from note/event/inbox links
- `app/(dashboard)/tasks/[taskId]/page.tsx`
  - detail query
  - displays assignee, creator, source note, source event, source inbox item
  - displays guardian context derived from linked source note athlete
- `app/(dashboard)/tasks/new/page.tsx`
  - loads assignees, notes, and events for task creation
- `app/(dashboard)/tasks/[taskId]/edit/page.tsx`
  - loads task plus assignees, notes, and events for task editing
- `app/(dashboard)/events/[eventId]/page.tsx`
  - reads event tasks
  - task rows also show `sourceNote`
- `app/(dashboard)/dashboard/page.tsx`
  - counts and lists overdue tasks
  - counts and lists blocked tasks
  - counts and lists stale unresolved tasks
  - counts and lists tasks missing responsible context
  - deep-links into filtered task views
- `app/(dashboard)/people/[personId]/page.tsx`
  - reads tasks assigned to, created by, or note-linked to the selected person
- `app/(dashboard)/teams/[teamId]/page.tsx`
  - reads tasks linked to team events or team-linked notes
- `lib/operational-history.ts`
  - reads tasks into person/team/event/dashboard operational history panels
- `lib/permissions/index.ts`
  - reads task source scope to resolve mutation permission context

#### Write/update/status paths

- `app/(dashboard)/tasks/create/route.ts`
  - creates `FollowUpTask`
  - validates `assigneePersonId`, `sourceNoteId`, `sourceEventId`
  - resolves `createdByPersonId`
- `app/(dashboard)/tasks/[taskId]/edit/update/route.ts`
  - updates title, description, status, assignee, due date, `sourceNoteId`, `sourceEventId`

#### Assignment/status behavior

- `assigneePersonId` is required on create and edit
- `createdByPersonId` is immutable after create in current UI/route behavior
- task status updates currently happen only through full edit form submission
- no dedicated status-only mutation route exists
- no task create/edit flow currently exposes `sourceInboxItemId`

#### Linking/dependency paths

- `app/(dashboard)/notes/[noteId]/page.tsx`
  - link to create task from note context using `sourceNoteId`
- `app/(dashboard)/events/[eventId]/page.tsx`
  - links into `/tasks/new?sourceEventId=...`
  - links into `/tasks?eventId=...`
- `app/(dashboard)/dashboard/page.tsx`
  - links into resolution/ownership/event task reviews

### 2.3 Inbox routing item surfaces (`InboxRoutingItem`)

Implemented usage is limited to:

- Prisma schema definitions and reverse relation from `FollowUpTask`
- task list/detail display of `sourceInboxItem`
- dashboard missing-context logic that explicitly checks `sourceInboxItemId`
- task permission scope resolution indirectly includes the schema relation

Current gaps:

- no inbox list page
- no inbox route handlers
- no create/edit/runtime workflow for `InboxRoutingItem`
- no task create/edit form field for `sourceInboxItemId`
- no seed/demo data for inbox routing items

This model is therefore a schema-level dependency and display-level dependency, not an active workflow surface.

---

## 3. ObservationNote Usage Inventory

### Read

- note list, detail, create form option loading, edit form option loading
- event detail page note panel
- dashboard recent-note, note-count, note-attention, and review-link panels
- person detail related notes
- team detail related notes
- operational history aggregation
- permission scope resolution for mutations

### Write

- create route
- edit/update route

### Linked

- optional links to `athletePersonId`, `teamId`, `eventId`
- reverse linked tasks via `FollowUpTask.sourceNoteId`
- event detail page uses event-linked notes
- task create/detail/list pages depend on note linkage

### Filtered

Current implemented URL or query filters on the note list:

- `teamId`
- `athletePersonId`
- `eventId`
- `authorPersonId`
- `readinessIndicator`
  - `recently_active`
  - `stale`
  - `needs_review`
  - `unresolved_too_long`
  - `upcoming_operational_concern`
- `guardianContext`
  - `missing_guardian_linkage`
  - `guardian_linked`
  - `inactive_guardian_account`

Operational-history filtering also depends on:

- `eventId`
- `personId` via `athletePersonId` or `authorPersonId`
- `teamId` via direct team link or linked event team

### Counted

- dashboard recent note count
- note detail unresolved linked task count
- note list readiness counts derived from unresolved linked tasks
- person/team/dashboard derived unresolved note-follow-up counts
- event detail note-linked task counts

---

## 4. FollowUpTask Usage Inventory

### Read

- task list, detail, create form option loading, edit form option loading
- event detail task panel
- dashboard overdue/blocked/stale/missing-context counts and lists
- person detail related tasks
- team detail related tasks
- operational history aggregation
- permission scope resolution for mutations

### Write

- create route
- edit/update route

### Linked

- required assignee link
- required creator link
- optional `sourceNoteId`
- optional `sourceEventId`
- optional `sourceInboxItemId` in schema and read views only
- note detail depends on reverse relation from task to note
- event detail depends on direct event-linked tasks and note-linked event context

### Filtered

Current implemented URL or query filters on the task list:

- `status`
- `assigneePersonId`
- `teamId`
- `eventId`
- `resolution`
  - `unresolved`
  - `resolved`
  - `all`
- `dueWindow`
  - `overdue`
  - `upcoming`
  - `all`
- `changedWindow`
  - `last_24h`
  - `last_7d`
  - `all`
- `guardianFollowUp`
  - `involving_guardian`
  - `missing_guardian_linkage`
- `ownershipIndicator`
  - `unresolved_owner_linked`
  - `overdue_owner_linked`
  - `missing_responsible_context`
  - `stale_unresolved`
  - `urgent`

Operational-history filtering also depends on:

- `eventId` via direct `sourceEventId` or indirect `sourceNote.eventId`
- `personId` via `assigneePersonId`, `createdByPersonId`, or `sourceNote.athletePersonId`
- `teamId` via direct event team, note team, or note.event team

### Counted

- dashboard overdue task count
- dashboard blocked task count
- dashboard stale unresolved task count
- dashboard tasks missing responsible context count
- team and person unresolved related task counts
- event detail open task count
- note detail unresolved linked task count
- operational history unresolved-task inclusion

### Assigned

- assignee is selected on create/edit forms
- task list supports assignee filtering
- task detail shows assignee as a first-class field
- dashboard and review surfaces assume assignee visibility is valid for all staff users who can reach the page

### Status-updated

- task status is editable on the full edit form
- dashboard urgency, stale-state, overdue, blocked, and unresolved logic all rely on the task status enum remaining unchanged
- event detail, note detail, team detail, person detail, and operational history all treat unresolved status as:
  - `OPEN`
  - `IN_PROGRESS`
  - `BLOCKED`

---

## 5. Dashboards and Operational Review Dependencies

Current dashboards and review surfaces are tightly coupled to legacy note/task tables.

### Dashboard (`app/(dashboard)/dashboard/page.tsx`)

Depends on:

- `ObservationNote.count` for recent note volume
- `ObservationNote.findMany` for recent notes
- `ObservationNote.findMany` for notes needing attention
- `FollowUpTask.count/findMany` for:
  - overdue tasks
  - blocked tasks
  - stale unresolved tasks
  - missing-responsible-context tasks
- deep links into current note/task filter parameters
- unresolved event concern summaries that depend on event task counts
- `getOperationalHistory()` for recent/unresolved operational history

### Event operational review (`app/(dashboard)/events/[eventId]/page.tsx`)

Depends on:

- event-linked notes via `ObservationNote.eventId`
- event-linked tasks via `FollowUpTask.sourceEventId`
- indirect event-linked tasks via note context shown in task rows
- deep links into event-scoped notes/tasks filtered lists
- `getOperationalHistory({ eventId })`

### Person operational review (`app/(dashboard)/people/[personId]/page.tsx`)

Depends on:

- tasks where person is assignee
- tasks where person is creator
- tasks where linked note athlete matches the person
- notes where person is athlete or author
- `getOperationalHistory({ personId })`

### Team operational review (`app/(dashboard)/teams/[teamId]/page.tsx`)

Depends on:

- tasks linked through event team, note team, or note.event team
- notes linked directly to the team or through event team
- `getOperationalHistory({ teamId })`

### Operational history read model (`lib/operational-history.ts`)

This is the most important read-layer dependency for future Entry work. It currently:

- queries `FollowUpTask` and `ObservationNote` directly
- applies team/person/event filtering against current FK graph
- uses current task unresolved semantics
- builds user-facing history items and unresolved summaries

Any Entry rollout that changes note/task storage without a compatibility layer will break dashboard, people, team, and event operational history panels.

---

## 6. Planning and Seed/Demo Dependencies

### Planning docs currently connected to Entry direction

- `planning/PHASE_7A_ENTRY_INBOX_SCHEMA_DESIGN.md`
  - defines the deferred Entry schema direction
- `planning/NOTES_INBOX_ENTRY_MODEL.md`
  - captures the long-term unified model direction and migration concerns
- `planning/PHASE_9A_ENTRY_ARCHITECTURE_REVIEW.md`
  - records the broader architecture and migration-risk assessment
- `planning/README.md`
  - planning index entry point

### Seed/demo data dependencies

Current seed data (`prisma/seed.mjs`) does **not** seed:

- `ObservationNote`
- `FollowUpTask`
- `InboxRoutingItem`

Current seed data does seed `Event`, people, roles, roster, guardian relationships, and FieldOps resources/bookings.

Implication:

- there is no existing seeded note/task/inbox fixture set to validate an Entry migration against
- any future migration dry run will need dedicated note/task fixture coverage added deliberately

---

## 7. Current Authorization Assumptions for Notes and Tasks

### 7.1 Organization scoping

Current assumption:

- every implemented note/task query and mutation path is scoped by `organizationId`
- lookup validation for linked people/teams/events is also organization-scoped
- permission checks derive scope from note/task/event relations but still start from organization context

Implication:

- organization scoping is strong and broadly consistent
- future Entry work must preserve organization-level containment as a non-negotiable baseline

### 7.2 Staff-only notes

Current assumption:

- notes are created as staff-only
- the note form explicitly tells users notes are staff-only
- schema visibility enum currently has only one value: `STAFF_ONLY`

Current gap:

- note read paths do not enforce per-record visibility rules beyond organization context and route-level auth
- there is no generalized read policy that interprets note visibility at query time

### 7.3 Assignee visibility

Current assumption:

- task assignee is always visible to users who can read the task surfaces
- task list, task detail, dashboard, team/person review, and event detail all display assignee identity

Current gap:

- no separate rule exists for hiding assignee identity from some staff roles or future guardian-facing views
- assignment visibility is effectively inherited from broad staff access, not explicit policy

### 7.4 Creator/author visibility

Current assumption:

- note author is always visible on note detail/list and event surfaces
- task creator is always visible on task detail/list surfaces that include it
- actor attribution is resolved through linked `UserAccount.personId` with fallback behavior in `lib/user-account.ts`

Current gap:

- there is no explicit rule for whether author/creator visibility differs from record visibility
- there is no owner/author private-view model

### 7.5 Guardian visibility boundaries

Current assumption:

- guardian relationship detail viewing is restricted to staff roles from `resolveGuardianRelationshipAccess()`
- guardian-related note/task filters only activate when that access check passes
- guardian users themselves have no mutation permissions for note/task actions
- existing planning explicitly says staff-only notes must not be exposed to guardians

Current gap:

- there is no guardian-facing note/task read path yet
- there is no per-record rule describing when a guardian may see an entry tied to a linked athlete
- current code treats guardian context as staff diagnostics, not as an audience/visibility permission system

---

## 8. Authorization Gap Review for Future Entry

The future `Entry` model introduces requirements that are not satisfied by current note/task authorization patterns.

### 8.1 Per-record visibility enforcement

Missing today:

- a reusable read-access evaluator
- query helpers that translate actor context into row filters
- consistent enforcement across dashboard, detail, history, and aggregate counts

Needed before Entry:

- a central `Entry` read policy abstraction
- a way to apply that policy to counts, lists, detail views, and aggregated review panels

### 8.2 Private entries

Missing today:

- current models do not support author-private operational records
- dashboard/history panels assume every reachable record may be counted and surfaced to staff

Needed before Entry:

- a rule for whether `PRIVATE` means author-only or author-plus-admin
- exclusion logic for private records from shared dashboards and history panels
- deep-link behavior when a user lacks access to a private entry

### 8.3 Staff-only entries

Missing today:

- current note behavior is staff-only by convention, not by explicit row-level enforcement
- tasks and events have no visibility field at all

Needed before Entry:

- a single explicit staff-only rule spanning note-like, task-like, and future decision/contact entry types
- shared filtering semantics so dashboards do not leak staff-only rows into broader audiences

### 8.4 Guardian-linked visibility

Missing today:

- no actor-facing rule for linked-guardian visibility
- no shared abstraction for evaluating athlete-linked records against guardian relationships
- no handling for guardians with inactive accounts, multiple athlete links, or team/program mixed scope

Needed before Entry:

- exact definition of when a guardian may read an entry tied to an athlete
- exact behavior for entries linked to team/event/program without direct athlete linkage
- fallback behavior when a note/task references both a guardian-linked athlete and broader staff-only context

### 8.5 Assignee vs author vs owner behavior

Missing today:

- current models use `authorPersonId`, `createdByPersonId`, `assigneePersonId`, and `ownerPersonId` with no unified visibility contract
- `InboxRoutingItem.ownerPersonId` exists in schema but has no implemented workflow semantics

Needed before Entry:

- explicit precedence rules for:
  - author
  - assignee
  - inbox owner
  - linked athlete/person subject
  - team/program/org-level staff viewers
- clear distinction between:
  - who can view
  - who can edit
  - who receives accountability signals
  - who is shown in lists/history

### 8.6 Team/program/org scoped access

Missing today:

- current mutation permissions derive team/program scope from event/note/task relationships
- current read surfaces mostly rely on dashboard route protection plus organization-scoped querying

Needed before Entry:

- read-scope rules for team-only, program-only, and org-wide staff viewers
- consistent treatment of entries linked to multiple scopes
- policy for entries with no team/program context
- policy for context inherited through links rather than primary container

---

## 9. Migration Blockers

The following blockers must be solved before `Entry` implementation begins.

1. **Read-path compatibility is not abstracted yet.**
   - dashboards, people/team/event review pages, and operational history query `ObservationNote` and `FollowUpTask` directly
   - there is no shared read adapter layer

2. **Per-record visibility enforcement does not exist yet.**
   - current note/task read access is not driven by a reusable row-level authorization model

3. **Event-linked dependency mapping must be preserved explicitly.**
   - current event continuity depends on both `ObservationNote.eventId` and `FollowUpTask.sourceEventId`
   - task/event filtering also depends on indirect `sourceNote.eventId`

4. **Legacy filter/deep-link continuity is required.**
   - existing note/task dashboards and review panels depend on current query parameters staying meaningful

5. **Backfill semantics are unresolved.**
   - notes have no title and no independent status
   - tasks have no visibility field
   - inbox routing items have no content body and use polymorphic string references

6. **Author/assignee/owner visibility rules are unresolved.**
   - Entry cannot safely unify models until author, assignee, owner, and linked-subject visibility behavior is defined

7. **Guardian-linked visibility behavior is unresolved.**
   - current guardian logic is staff diagnostic support, not end-user visibility enforcement

8. **Seed/demo migration coverage is missing.**
   - there are no seeded note/task/inbox fixtures to prove migration integrity

9. **Operational history would break without a compatibility phase.**
   - `lib/operational-history.ts` is a central dependency for dashboard, event, team, and person views

10. **InboxRoutingItem is not operationally mature enough to anchor migration behavior.**
   - it is currently a placeholder schema relation, not an implemented inbox workflow

---

## 10. Safe First Implementation Slice Recommendation for Phase 9D

Recommended safe first slice:

### 9D should do

1. **Implement authorization primitives before migration primitives.**
   - add the reusable visibility/read-access model needed for future Entry records
   - prove the policy shape in isolation before any note/task migration logic

2. **Add schema-only Entry scaffolding with no runtime cutover.**
   - create the minimal future tables needed for `Entry` + explicit visibility semantics
   - keep `ObservationNote` and `FollowUpTask` fully authoritative

3. **Do not migrate existing note/task rows in 9D.**
   - no backfill
   - no dual-write
   - no route swaps
   - no dashboard rewrites

4. **Do not activate Inbox/Feed/Journal behavior in 9D.**
   - no inbox triage runtime
   - no feed stream
   - no private journal UI
   - no notifications/messaging behavior

5. **Add targeted fixture/test coverage for migration prerequisites only.**
   - seed or test fixture coverage for note-linked task, event-linked task, standalone task, and guardian-linked note/task visibility cases

### 9D should explicitly avoid

- replacing note/task routes
- changing current task/note filters
- repointing operational history
- migrating `ObservationNote`
- migrating `FollowUpTask`
- changing `Event`, RSVP, or attendance ownership/runtime behavior

Reason:

This is the smallest slice that reduces architectural risk without touching current operational workflows.

---

## 11. Recommended Next Step

Recommended next step after Phase 9C:

1. approve the blocker list
2. lock Entry visibility semantics first
3. define the first reusable read-access contract
4. scope 9D to authorization primitives + schema scaffolding only
5. defer all data migration and runtime replacement until compatibility strategy is proven

---

## 12. Validation Summary

This Phase 9C review matches the currently implemented code paths reviewed in the files listed above.

Confirmed in this phase:

- no `Entry` runtime behavior was added
- no `ObservationNote` or `FollowUpTask` migration was added
- no Feed, Inbox, Journal, messaging, notification, or workflow automation behavior was added
- no FieldOps expansion was added
- only planning documentation and planning index changes are required

Repository validation run before documentation edits:

- `npm run lint` ✅
- `npm run typecheck` ✅
- `DATABASE_URL=postgresql://user:pass@localhost:5432/cadreos ./node_modules/.bin/prisma validate` ✅
- `npm run build` ✅

---

## PR Summary

This phase documents the exact migration dependency graph for `ObservationNote`, `FollowUpTask`, `InboxRoutingItem`, and event-linked note/task behavior before any Entry implementation starts.

Main finding:

- Entry migration is blocked less by schema shape than by read-path coupling and missing per-record authorization enforcement.

Recommended next step:

- Phase 9D should implement authorization primitives and schema scaffolding only, while leaving all current note/task/event runtime behavior unchanged.
