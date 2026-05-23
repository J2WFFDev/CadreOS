# Phase 7F — Operational Notes Workflow Hardening

## Goal

Harden the current `ObservationNote` workflow so coaches and admins can reliably capture and review operational observations before any future unified Entry migration.

## Scope Guardrails

- No unified Entry model implementation.
- No migration of Notes or Tasks into Entry.
- No FieldOps expansion.
- No messaging, notifications, chat, or Feed behavior.
- No Journal/private diary functionality.
- No new major dependencies.
- Organization scoping preserved throughout.
- Existing CadreOS auth and data access patterns used exclusively.

---

## Current Operational Notes Workflow

### Data model

`ObservationNote` is the active note capture model. Each note has:

| Field | Description |
|---|---|
| `body` | Required free-text content of the note |
| `authorPersonId` | Person who authored the note (required, resolved via `resolveActorPersonId`) |
| `athletePersonId` | Optional link to a Person (athlete/contact) |
| `teamId` | Optional link to a Team |
| `eventId` | Optional link to an Event |
| `visibility` | Enum — currently always `STAFF_ONLY` |
| `organizationId` | Scopes the note to the active organization |
| `createdAt` / `updatedAt` | Timestamps |

### Author attribution

Note author is resolved via `resolveActorPersonId()` in `lib/user-account.ts`:
1. Checks `UserAccount.personId` for the authenticated Clerk user.
2. Falls back to the first `ORGANIZATION_ADMIN` role assignment in the org.
3. Falls back to the first person record in the org.

### Routes

| Route | Purpose |
|---|---|
| `GET /notes` | List all org notes (now with URL-based filtering) |
| `GET /notes/new` | New note creation form |
| `POST /notes/create` | Submit new note → redirect to detail |
| `GET /notes/[noteId]` | Note detail with related tasks |
| `GET /notes/[noteId]/edit` | Note edit form |
| `POST /notes/[noteId]/edit/update` | Submit note edit → redirect to detail |

### Visibility

All notes are `STAFF_ONLY` by default. The `NoteVisibility` enum currently has only this one value. Staff-only notes must not be exposed to parent/guardian workflows.

### Follow-up task relationship

`FollowUpTask` records can reference a `sourceNoteId`. This links the task back to the originating note. Both the note detail page and the task detail page show this relationship with working links in both directions.

---

## Phase 7F Runtime Improvements

### Notes list page (`/notes`)

- Added URL-based filtering: by team, by athlete/person, by event, by author.
  - Filters are sent as GET query parameters (`teamId`, `athletePersonId`, `eventId`, `authorPersonId`).
  - Filter options (teams, people, events) are loaded from the active organization.
  - Applied as Prisma `where` conditions — organization scope is always preserved.
- Filter bar renders above the notes table with `<form method="GET">` for server-rendered, zero-JS operation.
- Active filters displayed as a label row below the filter selects.
- "Clear" link appears when any filter is active.
- Notes list now includes author links (linked to `/people/[id]`) in addition to existing athlete/team/event links.
- Visibility column now renders a styled amber badge pill ("Staff Only") instead of plain text.
- Empty state message is filter-aware: shows "No notes match the selected filters." vs "No observation notes have been recorded yet."
- Deferred Entry/Inbox notice added at the bottom of the page.

### Note detail page (`/notes/[noteId]`)

- Visibility field now renders as a styled amber badge pill for clarity.
- "Related tasks" section renamed to "Related follow-up tasks" for precision.
- Task status in the related tasks list now renders as a styled badge pill.
- Deferred Entry/Inbox notice added at the bottom of the page.

### New note page (`/notes/new`)

- Author attribution disclaimer updated to reflect Phase 4C Clerk-to-person resolution instead of legacy mock auth language.

---

## Current Notes vs. Future Entry Model

| Aspect | Current `ObservationNote` | Future `Entry` model (deferred) |
|---|---|---|
| **Capture type** | Observation note only | Multiple types: Note, Task, Event, Decision, Contact Note |
| **Default container** | None (org-level list) | Inbox (default landing zone) |
| **Lifecycle/status** | No explicit lifecycle state | Full status lifecycle per entry type |
| **Follow-up** | Linked via `FollowUpTask.sourceNoteId` | First-class conversion to Task within Entry |
| **Visibility** | Enum: `STAFF_ONLY` (only value) | Role-scoped routing by audience/visibility/type |
| **Container scoping** | Optional links to team/event/athlete | Full container: Person, Team, Program, Season, Event, Org |
| **Migration risk** | None — using current model | Requires careful backfill, foreign key migration, status normalization |

---

## Migration Caution Areas

When the future unified Entry migration is eventually designed, the following areas require careful planning:

1. **Link integrity**: `ObservationNote` has FK links to `athletePersonId`, `teamId`, `eventId`, and `authorPersonId`. Converting to Entry requires preserving these relationships.
2. **Status normalization**: ObservationNote has no status field; Entry will have per-type lifecycle states. Backfill ambiguity for historical notes.
3. **Visibility semantics**: Current `NoteVisibility.STAFF_ONLY` enum has a single value. Future Entry visibility will be richer. Ensure no default-visibility change occurs silently on migration.
4. **Task source links**: `FollowUpTask.sourceNoteId` must be remapped or dual-tracked during migration to avoid breaking task-to-note relationships.
5. **Audit continuity**: If note records are replaced, audit history under `AuditEvent` referencing old note IDs must be preserved.
6. **Rollback risk**: Migration must be staged with dual-read/dual-write compatibility window before deprecating `ObservationNote`.

---

## Deferred Scope (unchanged from prior phases)

- Unified Entry schema implementation
- Inbox routing workflows
- Feed behavior
- Journal / private diary entries
- Messaging, DM, or chat features
- Advanced note tagging systems
- Guardian-visible note sharing
- Note analytics or aggregation dashboards

---

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- Organization scoping verified: all note queries include `organizationId: scope.organizationId`.
- Filter queries preserve org scope: filter WHERE conditions are additive to the org scope.
- No FieldOps routes modified.
- No Entry schema added.
- No Feed/Journal/Messaging behavior added.
- FollowUpTask relationships tested end-to-end (note detail → task detail → back).

---

## Files Changed

| File | Change summary |
|---|---|
| `app/(dashboard)/notes/page.tsx` | Added URL-based filtering (team/athlete/event/author), visibility badge, filter-aware empty state, deferred Entry notice |
| `app/(dashboard)/notes/[noteId]/page.tsx` | Visibility badge, improved task status badge, renamed section, deferred Entry notice |
| `app/(dashboard)/notes/new/page.tsx` | Cleaner author attribution text |
| `planning/PHASE_7F_NOTES_WORKFLOW_HARDENING.md` | This file: Phase 7F summary, current workflow, future model comparison, migration cautions |
| `planning/README.md` | Added Phase 7F link |
| `planning/ROADMAP.md` | Added Phase 7F to active build sequence |
