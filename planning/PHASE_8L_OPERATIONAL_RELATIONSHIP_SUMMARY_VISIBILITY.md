# Phase 8L — Operational Relationship Summary Visibility

## Goal

Improve operational relationship summary visibility across people, teams, events, attendance, notes, and follow-up tasks using existing CadreOS workflows and data.

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

## Operational relationship assumptions

1. Relationship summaries remain lightweight read-context derived from existing `Person`, `Team`, `Event`, `AttendanceRecord`, `ObservationNote`, and `FollowUpTask` data.
2. Unresolved related-item visibility is derived from existing unresolved task statuses (`OPEN`, `IN_PROGRESS`, `BLOCKED`) and attendance concern states.
3. Upcoming operational concern context remains heuristic and link-based, using existing event timing and unresolved operational data.
4. Guardian relationship context remains staff-role-gated and operational-only; it does not introduce parent-facing workflow behavior.
5. Relationship grouping/filtering remains route/filter driven (team/event/unresolved/recent), not a new reporting engine.

## Phase 8L runtime output summary

### Person relationship summaries (`/people/[personId]`)

- Added an operational relationship summary section with lightweight visibility for:
  - related notes/tasks
  - unresolved related items
  - recent attendance context
  - upcoming team-event readiness context
- Added contextual navigation links from person to related notes/tasks/events and recent activity filters.
- Added lightweight attendance-context previews that route directly into event attendance workflows.

### Team relationship summaries (`/teams/[teamId]`)

- Added a team-level operational relationship summary section for:
  - related notes/tasks
  - unresolved related items
  - upcoming events
  - upcoming operational concerns
- Added contextual navigation links from team to unresolved team tasks, team notes, and event concern filters.
- Added lightweight upcoming concern previews linking directly to event detail workflows.

### Event relationship workflow continuity (`/events/[eventId]`)

- Added a relationship workflow navigation section tying event context directly to:
  - attendance workflow
  - event notes
  - unresolved event tasks
  - recent event-linked activity
  - team upcoming concern filters
- Preserved event attendance/notes/tasks operational-context flow while improving direct navigation continuity.

### Dashboard/review continuity (`/dashboard`)

- Added a dedicated relationship-summary continuity section linking dashboard review into person/team/event relationship summary workflows.
- Updated key dashboard entity links to deep-link into relationship summary sections for faster continuity from review panels.

## Current limitations

- Relationship summaries are operational-context snapshots and not full audit history or analytics dashboards.
- Person attendance/event context is derived from existing attendance/team/event links only; no new event-participant model is introduced.
- Upcoming concern detection remains lightweight and derived from existing timestamps/status context.
- Grouping/filtering remains intentionally lightweight and URL/filter-driven.

## Intentionally deferred concepts

- Feed/Journal runtime behavior.
- Entry migration/runtime unification work.
- Messaging/chat/notification/reminder behavior.
- Workflow automation/orchestration engines.
- Parent-facing portal workflows.
- Predictive analytics/advanced reporting systems.

## Validation checklist applied in Phase 8L

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cadreos ./node_modules/.bin/prisma validate`
- Confirmed organization scoping remained intact across person/team/event/dashboard relationship summary updates.
- Confirmed relationship summaries reflect currently stored notes/tasks/attendance/event data.
- Confirmed `ObservationNote` and `FollowUpTask` workflows remained operational.
- Confirmed `Event` and `Attendance` workflows remained operational.
- Confirmed dashboard/review continuity routes into relationship-summary workflows.
- Confirmed no Entry migration work was added.
- Confirmed no messaging/notification behavior was added.
- Confirmed no FieldOps functionality was changed.
