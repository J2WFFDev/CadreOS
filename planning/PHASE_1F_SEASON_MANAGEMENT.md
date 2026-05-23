# Phase 1F: Basic Season Management

## Scope
- Add a create season workflow (`/programs/[programId]/seasons/new` and POST create route) with:
  - Season `name`
  - Optional `startDate`
  - Optional `endDate`
  - Active organization context assignment
  - Zod validation
  - Duplicate-name prevention within the same program
  - Redirect to `/programs/[programId]` on success
- Add an edit season workflow (`/programs/[programId]/seasons/[seasonId]/edit` and POST update route) with:
  - Season `name`, `startDate`, and `endDate` editing
  - Zod validation including `endDate >= startDate` when both dates are present
  - Duplicate-name prevention within the same program
  - Redirect to `/programs/[programId]` on success
- Update program detail pages to show:
  - Seasons for the selected program
  - Teams under the program
  - A **New season** action
  - Season edit links
- Update team detail roster workflows to:
  - Allow season selection when adding roster memberships
  - Default to seeded/current/demo/first season behavior when choosing the season context
  - Keep duplicate prevention scoped by `team + season + person`
- Update team detail display to keep roster memberships season-oriented with simple season filtering.

## Data/Model Positioning
- Season is the time boundary for roster membership in CadreOS.
- `RosterMembership` is season-scoped and is not global across all time.
- Later workflows (events, RSVP, attendance, notes/tasks linkage) will align to season context, but those capabilities are intentionally deferred.

## Non-Scope / Limitations
- No season deletion workflow in this phase.
- No organization management UI in this phase.
- No authentication provider integration (mock auth remains).
- No full authorization enforcement in this phase (central placeholder remains).
- No additional product areas in this phase:
  - notes
  - events
  - RSVP
  - attendance
  - tasks
  - messaging
  - inventory
  - health records
  - AI
  - analytics
- No automatic seed execution.
