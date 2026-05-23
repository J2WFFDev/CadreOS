# Phase 2C: Attendance Management

## Scope
- Extend event detail at `/events/[eventId]` to display attendance records separately from RSVP intent records.
- Show attendance person, status, optional reason code, marked timestamp, and marked-by person when available.
- Add attendance create/update workflow on event detail with redirect back to `/events/[eventId]`.
- Keep mutation authorization placeholder centralized with an attendance upsert action.
- Keep validation centralized with existing workflow helpers.

## Data and Validation Positioning
- Attendance is constrained to one record per event/person pair.
- Attendance is scoped to the active organization and must reference:
  - an event in the active organization
  - a person in the active organization
- Attendance status must use existing enum values only:
  - `PRESENT`
  - `LATE`
  - `EXCUSED_ABSENT`
  - `UNEXCUSED_ABSENT`
- Reason code is optional and length-limited.
- Team-roster-linked people are preferred in selection order when the event has a team, while still allowing organization-level selection.

## RSVP vs Attendance
- RSVP captures intent/availability before the event.
- Attendance captures actual participation after the event occurs.
- Both workflows stay available on event detail, but are visually and semantically distinct.

## Marked-by Attribution Limitation
- Attendance marked-by attribution first attempts to resolve the current mock auth actor to a linked organization person.
- If no actor person is linked yet, the workflow falls back to a seeded/admin organization person.
- This is an intentional temporary limitation until real authentication and policy phases are implemented.

## Non-Scope / Guardrails
- No Attendance delete workflow.
- No Notes.
- No Tasks.
- No Messaging.
- No Inventory.
- No health/medical record workflows.
- No AI or analytics features.
- No real authentication provider integration.
- No automatic seed execution.
