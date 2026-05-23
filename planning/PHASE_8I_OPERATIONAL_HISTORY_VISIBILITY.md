# Phase 8I — Operational History Visibility and Activity Context

## Goal

Improve lightweight operational timeline/history visibility across existing CadreOS workflows using current timestamps, links, organization scoping, and auth/data-access patterns.

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

## Operational history assumptions

1. Current history is derived from existing `createdAt`, `updatedAt`, and `markedAt` fields on existing operational models.
2. `ObservationNote`, `FollowUpTask`, `AttendanceRecord`, `Event`, `RosterMembership`, and `RoleAssignment` remain the only runtime sources for this slice.
3. “Who changed this” is shown only where safely derivable from current records (`author`, `createdBy`, `markedBy`); true `updatedBy` tracking is not available for all models.
4. Roster and assignment history is limited to current records that still exist; deletion history is intentionally not reconstructed.
5. Unresolved operational history remains lightweight and is derived from unresolved task state, event attendance gaps, and non-present attendance outcomes.

## Phase 8I runtime output summary

### Shared history layer

- Added a reusable operational history query layer that derives recent activity from:
  - tasks
  - notes
  - attendance
  - events
  - roster memberships
  - role assignments
- Added lightweight activity context for:
  - actor attribution where derivable
  - changed timestamp
  - related team/event/person chips
  - unresolved follow-up indicators

### Dashboard (`/dashboard`)

- Replaced the single “recently changed” summary with richer recent and unresolved operational history panels.
- Expanded recent operational visibility to include roster membership and role-assignment change context in addition to tasks, notes, attendance, and events.
- Added dashboard continuity language clarifying current history assumptions and what remains deferred.

### Event / team / person workflows

- Added event-scoped operational history to `/events/[eventId]`.
- Added team-scoped operational history to `/teams/[teamId]`, including derivable roster/assignment activity.
- Added person-scoped operational history to `/people/[personId]`, including task, note, attendance, roster, and role context where derivable.

### Note / task continuity

- Added direct links from note/task detail pages into related person/team/event operational history views.

## Current limitations

- History remains a lightweight operational read model, not a formal audit log.
- True “last updated by” attribution is unavailable for models that only store `updatedAt`.
- Roster membership removals and role assignment removals are not reconstructable from current runtime data alone.
- Grouping/filtering is intentionally limited to safe current-context views (dashboard recent/unresolved plus team/event/person scoped history).
- No Feed/Journal/Entry runtime behavior is introduced.

## Intentionally deferred concepts

- Feed/Inbox/Journal runtime behavior.
- Entry migration/runtime unification work.
- Messaging/chat/notification/reminder behavior.
- Workflow automation/orchestration engines.
- Parent-facing portal workflows.
- Advanced reporting/analytics pipelines.
- Full audit-event-backed historical reconstruction.

## Validation checklist applied in Phase 8I

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Confirmed organization scoping remained intact for shared operational history queries.
- Confirmed recent history reflects underlying current records without schema expansion.
- Confirmed `ObservationNote` and `FollowUpTask` workflows remained operational.
- Confirmed `Event` and `Attendance` workflows remained operational.
- Confirmed dashboard/review continuity still routes into existing workflows.
- Confirmed no Entry migration work was added.
- Confirmed no messaging/notification behavior was added.
- Confirmed no FieldOps functionality was changed.
