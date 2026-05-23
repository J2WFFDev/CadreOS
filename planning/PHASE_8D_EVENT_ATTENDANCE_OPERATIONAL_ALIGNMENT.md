# Phase 8D — Event/Attendance Operational Alignment

## Goal

Improve operational alignment between `Event`, `AttendanceRecord`, `ObservationNote`, `FollowUpTask`, and team roster workflows using current models and existing auth/data-access patterns.

## Scope guardrails (enforced)

- No messaging/chat/notifications/reminders/Feed/Journal behavior.
- No Entry migration implementation.
- No FieldOps expansion.
- No parent portal or consent workflow implementation.
- No attendance approval workflow implementation.
- No major Event or Attendance schema redesign.
- No new major dependencies.
- Preserve organization scoping on reads/writes.

## Runtime model/workflow review

- `Event` remains the central planning record and links to RSVPs, attendance records, notes, and follow-up tasks.
- `AttendanceRecord` remains the runtime participation capture model (`eventId`, `personId`, `status`, `markedByPersonId`).
- `ObservationNote.eventId` remains optional event context for coaching observations.
- `FollowUpTask.sourceEventId` and `FollowUpTask.sourceNoteId` remain optional links for follow-up traceability.
- Team roster relationships continue to provide the safe attendance expectation baseline when events are team-linked.

## Phase 8D runtime output summary

### Events list (`/events`)

- Added lightweight operational filters:
  - event status
  - team
  - attendance coverage state
  - link context state (notes/tasks/follow-up required)
- Added attendance coverage indicators per row:
  - complete
  - partial
  - missing
  - captured (no roster expectation)
  - not expected
- Added row-level note/task counts and follow-up-required signal.
- Added filter-aware empty state behavior.

### Event detail (`/events/[eventId]`)

- Added operational alignment summary block for:
  - attendance captured
  - expected attendance (team roster derived)
  - attendance missing
  - linked note/task counts
  - open follow-up task count
  - follow-up-required indicator
- Added related notes section directly on event detail for clearer note↔event visibility.
- Preserved and improved related task visibility for task↔event and note↔task chain tracing.
- Added attendance list filter (`all`, `present`, `late`, `excused absent`, `unexcused absent`).
- Added explicit “missing attendance from current team roster” visibility when applicable.
- Added direct people links in RSVP/attendance tables for person-level operational follow-up.

## Operational attendance assumptions (current)

1. Attendance expectation is inferred from current linked team roster members when an event has a team.
2. If no team is linked, attendance expectation is treated as not configured.
3. Attendance records can still be captured for organization people even when no roster expectation exists.
4. Missing attendance indicators are operational prompts, not enforcement or approval states.

## Event follow-up workflow (current)

1. Capture attendance on event detail.
2. Add event-linked notes for observations/contexts.
3. Create follow-up tasks from event or note context.
4. Use open linked task count + attendance gap indicators to identify immediate coach/admin follow-up.

## Current limitations

- Attendance expectations are based on current roster state, not date-specific roster snapshots.
- No attendance approval or exception workflow.
- No messaging/notification/reminder automation.
- No guardian attendance workflow.
- Reporting remains operational/basic rather than advanced analytics.

## Future Entry/Inbox considerations (deferred)

- Preserve event↔note↔task linkage integrity for any future Entry migration.
- Preserve organization scoping and role-appropriate visibility constraints.
- Keep attendance as an operational runtime workflow until explicit Entry-track migration decisions are approved.

## Validation checklist applied in Phase 8D

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cadreos?schema=public ./node_modules/.bin/prisma validate`
- Confirmed organization scoping remains intact in touched event queries and forms.
- Confirmed Event/Attendance workflows continue functioning with existing routes.
- Confirmed ObservationNote and FollowUpTask event relationships remain intact.
- Confirmed no Entry migration implementation was added.
- Confirmed no messaging/notification behavior was added.
- Confirmed no FieldOps behavior was changed.
