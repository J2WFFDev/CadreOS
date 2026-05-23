# Phase 8E — Coach Operational Dashboard

## Goal

Deliver a lightweight, coach/admin-focused operational dashboard using existing CadreOS runtime workflows and organization-scoped data.

## Scope guardrails (enforced)

- No messaging/chat/notifications/reminders/Feed/Journal behavior.
- No Entry migration implementation.
- No FieldOps expansion.
- No parent portal behavior.
- No advanced analytics or BI/reporting infrastructure.
- No major schema redesign.
- No new major dependencies.
- Preserve organization scoping and current auth/data-access patterns.

## Runtime workflow/data review

Phase 8E dashboard sections are sourced from existing operational entities and routes:

- Team roster visibility and assignment context (`Team`, `RosterMembership`, `RoleAssignment`)
- Guardian relationship visibility context (`AthleteGuardianRelationship`, staff-role gated views)
- Events and attendance (`Event`, `AttendanceRecord`)
- Observation notes (`ObservationNote`)
- Follow-up tasks (`FollowUpTask`)
- FieldOps approval queue where already supported (`ResourceBooking.approvalStatus`)

## Phase 8E runtime output summary

### Dashboard home (`/dashboard`)

- Added/updated lightweight operational summary sections for:
  - upcoming events
  - attendance needing review
  - overdue follow-up tasks
  - recent operational notes
  - athletes missing guardian linkage (staff-gated visibility)
  - team roster/assignment gaps
  - pending FieldOps approvals
- Added actionable navigation links into existing workflows (events, attendance capture, tasks, notes, teams, people, FieldOps bookings).
- Improved empty states for operational clarity and next-step guidance.
- Added lightweight operational metric cards tied to existing module routes and safe query filters.

## Current limitations

- Dashboard summaries are operational prompts, not advanced analytics.
- Attendance expectation remains derived from currently linked team roster data.
- Guardian-linkage detail remains staff-role gated and is not parent-facing.
- Roster/assignment gap indicators are lightweight and based on current season context selection.
- FieldOps dashboard signals only surface existing approval queue context; no workflow expansion is introduced.

## Intentionally deferred scope

- Advanced BI/reporting and predictive analytics.
- Messaging/chat/notification/reminder workflows.
- Parent-facing portal dashboards.
- Feed/Inbox/Journal runtime behavior changes.
- Entry migration/runtime unification work.
- FieldOps feature expansion beyond existing approvals visibility.

## Validation checklist applied in Phase 8E

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Confirmed organization scoping remained intact on all new dashboard queries.
- Confirmed dashboard summaries read from existing operational models/workflows.
- Confirmed navigation links target existing routes/filters only.
- Confirmed no Entry migration work was added.
- Confirmed no messaging/notification behavior was added.
- Confirmed no FieldOps runtime functionality was changed.
