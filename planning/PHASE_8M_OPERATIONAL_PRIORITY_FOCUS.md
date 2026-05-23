# Phase 8M — Operational Priority Focus and Visibility

## Goal

Improve operational focus and priority visibility across existing CadreOS workflows. Phase 8M adds
lightweight priority indicators, a dashboard priority triage section, and improved filtering continuity
into priority-focused views — without adding AI, automation, messaging, or new major dependencies.

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

## Operational prioritization assumptions

1. "Urgent" means a task is unresolved AND (overdue or blocked). This is a heuristic derived from
   existing `FollowUpTask` status and `dueAt` fields — no AI or weighted scoring is used.
2. "Upcoming operational risk" means an event is upcoming (within 7 days) AND has unresolved follow-up
   (missing attendance or open tasks). This is higher-severity than "upcoming operational concern"
   (14-day window) and is derived from existing event timing and task/attendance data only.
3. "Stale unresolved" means a task has not been updated in 14+ days and remains unresolved. This is
   unchanged from prior phases.
4. "Needs attention" covers stale unresolved tasks, missing responsible context, and team
   roster/assignment gaps — items that should be reviewed but are not immediately time-critical.
5. The dashboard priority triage summary ("Operational Priority Focus") aggregates existing counts
   and does not introduce new data queries. It uses counts already computed by the dashboard page.
6. All priority indicators remain heuristic and timestamp-based. No predictive or ML-based
   prioritization is used or deferred in a pending state.

## Phase 8M runtime output summary

### Dashboard priority triage panel (`/dashboard`)

- Added a three-band "Operational Priority Focus" section near the top of the dashboard data section:
  - **Requires immediate review** (red): overdue tasks, blocked tasks, attendance gaps needing review.
  - **Needs attention** (amber): stale unresolved tasks, missing responsible context, teams with
    roster/assignment gaps.
  - **May impact upcoming operations** (violet): upcoming scheduled events, events with unresolved
    follow-up, upcoming events with operational concerns.
- Each band includes direct links to the relevant filtered list views.
- Includes a footer note clarifying that priority indicators are heuristic-based and that automation,
  reminders, and AI prioritization are intentionally deferred.

### Tasks — "urgent" priority indicator (`/tasks`)

- Added an **Urgent** badge (red) in the ownership/priority indicator column for tasks that are
  unresolved AND (overdue OR blocked). This is the highest-priority operational signal for follow-up
  tasks.
- Added "Urgent (overdue or blocked, unresolved)" as a filter option in the priority/ownership
  indicator dropdown, enabling fast triage to the most critical follow-up items.
- Renamed the filter dropdown label from "Ownership indicator" to "Priority / ownership indicator"
  to reflect the inclusion of the new "urgent" filter value.

### Events — "upcoming operational risk" indicator (`/events`)

- Added an **Upcoming operational risk** badge (red) for events that are upcoming within 7 days AND
  have unresolved follow-up (missing attendance or open tasks). This is higher urgency than the
  existing "Upcoming operational concern" (14-day window, violet).
- Added "Upcoming operational risk (within 7 days)" as a filter option in the operational indicator
  dropdown, alongside the existing "Upcoming operational concern (within 14 days)" option.
- The "Upcoming operational concern" badge is now suppressed for events that already show the higher-
  severity "Upcoming operational risk" badge, avoiding duplicate/redundant indicators.

## Current limitations

- Priority indicators are heuristic snapshots based on existing status fields and timestamps. They
  do not reflect operational context that is not captured in the CadreOS data model.
- "Urgent" for tasks is determined solely by `dueAt < now` OR `status === BLOCKED`. If a task has
  no due date, it cannot be flagged as overdue-urgent (only blocked-urgent).
- "Upcoming operational risk" is based on `startsAt` within 7 days; it does not consider event
  cancellation signals that may have occurred after data entry.
- The dashboard priority triage panel uses pre-computed counts and does not introduce additional
  database queries.
- Grouping/filtering remains URL/filter-driven. No client-side sorting by priority is added.

## Intentionally deferred concepts

- AI/ML-based prioritization and recommendation systems.
- Automated reminders, notifications, or escalation workflows.
- Feed/Journal runtime behavior.
- Entry migration/runtime unification work.
- Messaging/chat behavior.
- Workflow automation/orchestration engines.
- Parent-facing portal workflows.
- Predictive analytics/advanced reporting systems.

## Validation checklist applied in Phase 8M

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cadreos ./node_modules/.bin/prisma validate`
- Confirmed organization scoping remained intact across dashboard, tasks, and events updates.
- Confirmed "urgent" badge derives correctly from existing task status and dueAt data.
- Confirmed "upcoming operational risk" badge derives correctly from existing event timing and
  task/attendance data.
- Confirmed `ObservationNote` and `FollowUpTask` workflows remained operational.
- Confirmed `Event` and `Attendance` workflows remained operational.
- Confirmed dashboard/review continuity routes into priority-focused workflows.
- Confirmed no Entry migration work was added.
- Confirmed no messaging/notification behavior was added.
- Confirmed no FieldOps functionality was changed.
