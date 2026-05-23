# Phase 8G — Operational Readiness Visibility and Status Tracking

## Goal

Improve coach/admin operational readiness visibility and action status tracking across existing CadreOS roster/member, guardian, events, attendance, ObservationNote, FollowUpTask, and dashboard workflows using current models and organization-scoped access patterns.

## Scope guardrails (enforced)

- No messaging/chat/reminders/notifications/Feed/Journal runtime behavior.
- No Entry migration implementation.
- No FieldOps expansion or workflow orchestration additions.
- No advanced analytics/reporting infrastructure.
- No parent-facing workflow behavior.
- No schema redesign.
- No new major dependencies.
- Preserve organization scoping and existing auth/data access patterns.

## Operational readiness assumptions (runtime)

1. Readiness indicators are lightweight operational signals derived from existing relationships and statuses.
2. Follow-up accountability remains in `FollowUpTask`; unresolved status is represented by non-terminal task states.
3. Attendance readiness remains roster-derived and event-scoped.
4. Guardian linkage diagnostics remain staff-role gated and non-parent-facing.
5. Team readiness is inferred from selected-season roster coverage and team-scoped role assignment coverage.
6. “Recently changed” indicators use existing `updatedAt`/`markedAt` model fields only.

## Phase 8G runtime output summary

### Dashboard (`/dashboard`)

- Added blocked follow-up task metric and blocker list.
- Added recently changed operational items summary (task, note, attendance updates in recent window).
- Preserved existing readiness summaries for attendance review, overdue tasks, guardian-linkage gaps, and team roster/assignment gaps.

### Tasks workflow (`/tasks`)

- Added lightweight grouping/filtering for:
  - resolution state (`unresolved`, `resolved`)
  - event context (`sourceEvent` or `sourceNote.event`)
  - recently changed window (`last 24h`, `last 7d`)
- Preserved existing grouping/filtering for:
  - overdue/upcoming due window
  - team context
  - responsible person (assignee)
  - guardian follow-up context (staff-gated)
- Added task “last updated” visibility and lightweight “Recent” indicator chip.

### Teams workflow (`/teams`)

- Added team-level readiness visibility signal (`Needs attention` vs `Operationally clear`).
- Added lightweight team grouping/filtering for:
  - readiness state
  - role-assignment gap signal
  - inactive/unassigned role-assignment signal
- Added explicit list-card summaries for:
  - role-assignment gaps
  - inactive/unassigned role signals
  - selected-season roster gap status

## Operational status limitations

- Team readiness remains based on selected-season roster context, not historical snapshots.
- Role-assignment readiness is a visibility signal, not automatic enforcement or automation.
- Recently changed summary is informational and does not represent a workflow engine.
- Guardian diagnostics remain staff-only and intentionally non-parent-facing.
- Dashboard remains operational and lightweight rather than analytical/reporting-heavy.

## Intentionally deferred concepts

- Messaging/chat/notification/reminder runtime behavior.
- Feed/Journal runtime behavior.
- Entry migration and unified Entry runtime model.
- Workflow automation/orchestration engines.
- Predictive analytics or advanced reporting pipelines.
- Parent portal workflows.

## Validation checklist applied in Phase 8G

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Confirm organization scoping remained intact in updated dashboard/tasks/teams read paths.
- Confirm readiness/status indicators reflect existing underlying data relationships.
- Confirm ObservationNote and FollowUpTask workflows remain operational.
- Confirm dashboard workflows remain operational.
- Confirm no Entry migration implementation was added.
- Confirm no messaging/notification runtime behavior was added.
- Confirm no FieldOps functionality was changed.
