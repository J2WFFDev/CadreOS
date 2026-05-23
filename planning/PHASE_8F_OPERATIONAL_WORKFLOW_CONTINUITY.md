# Phase 8F — Operational Workflow Continuity

## Goal

Improve operational continuity between roster/member context, events, attendance, observation notes, follow-up tasks, and dashboard workflows using existing CadreOS models and organization-scoped access patterns.

## Scope guardrails (enforced)

- No messaging/chat/notifications/reminders/Feed/Journal behavior.
- No Entry migration implementation.
- No FieldOps expansion.
- No parent portal behavior.
- No major schema redesign.
- No advanced analytics/reporting infrastructure.
- No new major dependencies.
- Preserve organization scoping and current auth/data-access patterns.

## Runtime workflow continuity assumptions

1. `ObservationNote` and `FollowUpTask` remain the active runtime continuity models.
2. Event attendance workflow remains event-scoped and roster-derived for expectation prompts.
3. Attendance concern signals are lightweight operational indicators, not approval or automation workflows.
4. Guardian-linkage follow-up signals remain staff-role gated and non-parent-facing.
5. Dashboard links should route to existing operational pages/anchors/filters only.

## Phase 8F runtime output summary

### Event workflow continuity (`/events/[eventId]`)

- Added direct event-level navigation to the in-page attendance workflow section.
- Added attendance continuity links from attendance section to related notes/tasks and create actions.
- Added attendance concern visibility (`missing`, `late`, `unexcused absent`) as a lightweight operational signal.
- Added unresolved attendance guidance with direct note/task follow-up actions.
- Improved related notes/tasks empty states with next-step operational guidance.

### Dashboard continuity (`/dashboard`)

- Fixed attendance capture continuity link targets to existing event attendance workflow context (`/events/[eventId]#attendance-workflow`).
- Added direct event-note navigation from attendance review cards for faster event → attendance → notes/task flow.

### Note continuity (`/notes/[noteId]`)

- Added event-attendance workflow link in note event context.
- Added note-level follow-up pending status indicator from linked task states.
- Improved linked-task empty guidance for unresolved operational items.
- Added per-task pending indicator chips in related task list.

### Task continuity (`/tasks/[taskId]`)

- Added task-level “unresolved operational item” status signal for non-terminal task states.
- Added source-event attendance workflow link in task context.
- Added explicit “why this task exists” context summary from source relationships.
- Added staff-facing “missing guardian linkage impacting follow-up” indicator when applicable.

## Current limitations

- Attendance expectations remain derived from current roster state (not historical/date-snapshot roster membership).
- Continuity links are lightweight navigation/context cues, not automated workflow orchestration.
- Guardian follow-up diagnostics remain staff-facing and role-gated.
- Dashboard remains operationally focused and intentionally avoids advanced reporting infrastructure.

## Intentionally deferred Entry/Inbox workflow concepts

- Unified Entry runtime migration and data model consolidation.
- Inbox routing automation/orchestration behavior.
- Feed/Journal/private-entry runtime functionality.
- Messaging/chat/notification/reminder behavior.

## Validation checklist applied in Phase 8F

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Confirmed organization scoping remained intact for updated event/dashboard/note/task reads and links.
- Confirmed Event/Attendance workflows continue functioning with existing route handlers.
- Confirmed ObservationNote and FollowUpTask relationships remain intact.
- Confirmed dashboard operational links route to existing workflow contexts.
- Confirmed no Entry migration implementation was added.
- Confirmed no messaging/notification behavior was added.
- Confirmed no FieldOps runtime behavior was changed.
