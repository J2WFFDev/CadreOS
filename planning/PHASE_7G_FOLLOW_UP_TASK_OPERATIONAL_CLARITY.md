# Phase 7G — FollowUpTask Operational Clarity

## Goal

Improve `FollowUpTask` operational clarity and coach/admin usability using the current task workflow before any future unified Entry migration.

## Scope Guardrails

- No unified Entry model implementation.
- No migration of `FollowUpTask` into Entry.
- No FieldOps expansion.
- No messaging, notifications, chat, Feed behavior, or Journal functionality.
- No major task schema redesign.
- No new major dependencies.
- Organization scoping remains required on all task reads/writes.
- Existing CadreOS auth/data-access and permission patterns remain in place.

---

## Current FollowUpTask Workflow (as implemented)

### Model summary

`FollowUpTask` remains the runtime task model and includes:

| Field | Purpose |
|---|---|
| `title` | Required operational task label |
| `status` | Enum lifecycle (`OPEN`, `IN_PROGRESS`, `BLOCKED`, `DONE`, `CANCELLED`) |
| `assigneePersonId` | Required accountable assignee |
| `createdByPersonId` | Required creator attribution |
| `dueAt` | Optional due date/time |
| `sourceNoteId` | Optional link to `ObservationNote` |
| `sourceEventId` | Optional link to `Event` |
| `sourceInboxItemId` | Optional link to `InboxRoutingItem` |
| `organizationId` | Required organization scope boundary |

### Runtime routes

| Route | Purpose |
|---|---|
| `GET /tasks` | Task list and filtering |
| `GET /tasks/new` | Task creation form |
| `POST /tasks/create` | Task creation submit |
| `GET /tasks/[taskId]` | Task detail |
| `GET /tasks/[taskId]/edit` | Task edit form |
| `POST /tasks/[taskId]/edit/update` | Task edit submit |

### Data relationships

- `FollowUpTask.sourceNoteId` links task context to `ObservationNote`.
- `FollowUpTask.sourceEventId` links task context to `Event`.
- `FollowUpTask.sourceInboxItemId` can reference `InboxRoutingItem` when present.
- Organization scoping is preserved by `organizationId` constraints in all task queries.

---

## Phase 7G Runtime Improvements

### Task list (`/tasks`)

- Added coach-usable readability and operational context:
  - explicit creator column
  - status badges
  - overdue flags
  - blocked visibility
  - safer source display for note/event/inbox linkage
- Added lightweight URL-based filters:
  - `status`
  - `assigneePersonId`
  - derivable `teamId` context (from linked note/event relationships)
  - `dueWindow` (`all`, `overdue`, `upcoming` in next 7 days)
- Added filter-aware empty state when no rows match active filters.

### Task detail (`/tasks/[taskId]`)

- Improved status readability with badge styling.
- Added explicit overdue highlighting.
- Added explicit display for linked `sourceInboxItem` when present.

### Cross-visibility in note/event detail pages

- Note detail related-task cards now show overdue status and linked event context when present.
- Event detail related-task cards now show overdue status and linked note context when present.

### Assignment display guardrail

- Edit task page now warns when the current assignee value is no longer valid in the active organization and prompts explicit reassignment.

---

## Current Task Workflow vs Future Entry Direction

| Aspect | Current `FollowUpTask` workflow | Future Entry direction (deferred) |
|---|---|---|
| Task runtime model | `FollowUpTask` is canonical today | Potential task-as-entry migration |
| Context links | Optional FKs to note/event/inbox item | Entry-centric references and container model |
| Operational UX | List/detail/edit on dedicated task routes | Unified entry/inbox workflows (not implemented) |
| Migration status | No migration performed in Phase 7G | Still planning-only |

### Migration considerations (future, deferred)

1. Preserve task-to-note/event/inbox link integrity during any migration.
2. Preserve organization boundaries and permission checks during dual-model periods.
3. Maintain creator/assignee accountability fields without ambiguity.
4. Preserve task status semantics and overdue interpretation during backfill.

---

## Deferred Scope (explicitly unchanged)

- Inbox triage workflow implementation
- Feed behavior
- Journal behavior
- Messaging/chat
- Advanced workflow automation
- Unified Entry runtime migration

---

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cadreos?schema=public ./node_modules/.bin/prisma validate`
- Confirmed organization scoping remains in task/note/event queries touched by this phase.
- Confirmed linked `ObservationNote`/`Event` task relationships remain functional.
- Confirmed no Entry schema implementation was added.
- Confirmed no messaging/notification/Feed behavior was added.
- Confirmed no FieldOps functionality was modified.

---

## Files Changed (Phase 7G)

| File | Summary |
|---|---|
| `app/(dashboard)/tasks/page.tsx` | Added lightweight filtering, status/overdue/blocked readability, creator visibility, source/inbox context, and filter-aware empty states |
| `app/(dashboard)/tasks/[taskId]/page.tsx` | Added stronger status readability, overdue marker, and source inbox routing item visibility |
| `app/(dashboard)/tasks/[taskId]/edit/page.tsx` | Added invalid-assignee display guardrail and reassignment prompt |
| `app/(dashboard)/notes/[noteId]/page.tsx` | Improved related-task readability and event cross-link visibility |
| `app/(dashboard)/events/[eventId]/page.tsx` | Improved related-task readability and note cross-link visibility |
| `lib/follow-up-tasks.ts` | Added reusable overdue and status badge helpers |
| `planning/README.md` | Added Phase 7G index link |
| `planning/ROADMAP.md` | Added Phase 7G placement in active phase build order |
| `planning/PHASE_7G_FOLLOW_UP_TASK_OPERATIONAL_CLARITY.md` | This Phase 7G output summary |
