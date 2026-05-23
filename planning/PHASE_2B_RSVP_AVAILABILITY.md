# Phase 2B: RSVP / Availability Management

## Scope
- Extend event detail at `/events/[eventId]` to display RSVP submissions.
- Show RSVP person, status, optional reason, and response timestamp.
- Add RSVP create/update workflow on event detail with redirect back to `/events/[eventId]`.
- Keep mutation authorization placeholder centralized with an RSVP upsert action.
- Keep validation centralized with existing workflow helpers.

## Data and Validation Positioning
- RSVP is constrained to one record per event/person pair.
- RSVP is scoped to the active organization and must reference:
  - an event in the active organization
  - a person in the active organization
- RSVP status must use existing enum values only:
  - `GOING`
  - `NOT_GOING`
  - `MAYBE`
- Reason is optional and length-limited.

## Why This Phase Matters
- RSVP captures availability and attendance intent ahead of event time.
- This availability signal supports planning and communication before the event.
- Actual attendance recording remains a separate workflow for a later phase.

## Non-Scope / Guardrails
- No Attendance implementation in this phase.
- No RSVP delete workflow.
- No event delete workflow.
- No Notes.
- No Tasks.
- No Messaging.
- No Inventory.
- No health/medical record workflows.
- No AI or analytics features.
- No real authentication provider integration.
- No automatic seed execution.
