# Phase 8H — Operational Review Cadence Workflows

## Goal

Improve lightweight operational review cadence support for coaches/admins using existing CadreOS operational data, organization scoping, and current auth/data-access patterns.

## Scope guardrails (enforced)

- No messaging/chat/reminders/notifications/Feed/Journal runtime behavior.
- No Entry migration implementation.
- No FieldOps expansion.
- No workflow automation/orchestration additions.
- No advanced analytics/reporting infrastructure.
- No parent-facing workflow or portal behavior.
- No schema redesign.
- No new major dependencies.
- Preserve organization scoping and existing CadreOS auth/data-access patterns.

## Operational review cadence assumptions

1. `ObservationNote` and `FollowUpTask` remain the active operational review/follow-up models.
2. Operational review sections are lightweight workflow cues, not orchestration or automation.
3. Event readiness uses existing event/attendance/task relationships and status context only.
4. Roster readiness uses selected-season roster and assignment coverage signals already present in team workflows.
5. “Stale/unreviewed” visibility is derived from existing `updatedAt` fields and unresolved task states.
6. Guardian-linkage visibility remains staff-role gated and intentionally non-parent-facing.

## Phase 8H runtime output summary

### Dashboard (`/dashboard`)

- Added an explicit operational review cadence section for:
  - weekly coach review
  - event readiness review
  - unresolved operational follow-up review
  - roster readiness review
- Added stale/unreviewed unresolved follow-up visibility (no-update window signal).
- Added recent operational notes needing attention (notes with unresolved linked tasks).
- Added unresolved event-related operational concerns summary (missing attendance and/or open event-linked tasks).
- Preserved and extended continuity links into existing `events`, `tasks`, `notes`, and `teams` workflows using existing filters/routes.

### Existing operational sections preserved and reinforced

- Overdue tasks
- Attendance gaps
- Team roster/assignment gaps
- Athletes missing guardian linkage (staff-gated)
- Recently changed operational items

## Current limitations

- Review cadence guidance remains human-driven; no reminders, scheduled reporting, or orchestration are introduced.
- Stale/unreviewed signals are heuristic operational prompts based on `updatedAt`, not workflow-state engines.
- Event concern summaries remain lightweight and tied to existing attendance/task relationship data.
- Dashboard continues to prioritize operational continuity over analytics/reporting depth.

## Intentionally deferred concepts

- Messaging/chat/notification/reminder runtime behavior.
- Feed/Inbox/Journal runtime behavior.
- Scheduled reports.
- Workflow automation/orchestration engines.
- Entry migration/runtime unification work.
- Parent-facing portal workflows.
- Predictive analytics/advanced reporting pipelines.

## Validation checklist applied in Phase 8H

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Confirmed organization scoping remained intact for added dashboard review queries and links.
- Confirmed dashboard review summaries reflect underlying event/attendance/task/note/team data.
- Confirmed operational links/navigation continue routing to existing workflows.
- Confirmed `ObservationNote` and `FollowUpTask` workflows remain operational.
- Confirmed no Entry migration work was added.
- Confirmed no messaging/notification behavior was added.
- Confirmed no FieldOps functionality was changed.
