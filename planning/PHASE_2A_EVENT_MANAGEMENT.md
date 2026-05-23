# Phase 2A: Basic Event Management

## Scope
- Add an events list page at `/events` with event summary data:
  - title
  - event type
  - status
  - start/end date-time
  - program
  - optional team
  - optional location
- Add an event detail page at `/events/[eventId]` with full event metadata and back navigation.
- Add event creation workflow at `/events/new` with a POST create route.
- Add event edit workflow at `/events/[eventId]/edit` with a POST update route.
- Keep create/edit validation centralized with shared workflow helpers.
- Keep mutation permission checks centralized in the existing phase permission placeholder.

## Data and Validation Positioning
- Events are created in the active organization context and always reference a valid organization and program.
- Team association is optional and must belong to the selected program.
- Event type and status must use existing Prisma enum values only.
- `endsAt` must not be before `startsAt` when both are present.

## Created-By Attribution Limitation
- Event creation uses current mock actor context first.
- If no actor-to-person mapping is available yet, creation falls back to a safe organization person (seeded/admin-first strategy).
- This is temporary until real authentication identity mapping is implemented.

## Why This Phase Matters
- Phase 2A establishes the Event backbone needed for subsequent workflows.
- RSVP and Attendance are intentionally deferred in this phase, but Events are now in place to support those features in later phases.

## Non-Scope / Guardrails
- No event delete workflow.
- No RSVP.
- No Attendance.
- No Notes.
- No Tasks.
- No Messaging.
- No Inventory.
- No health/medical record workflows.
- No AI or analytics features.
- No real authentication provider integration.
- No automatic seed execution.
