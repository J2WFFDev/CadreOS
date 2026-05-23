# Phase 1C: Controlled Create/Edit Workflows

## Scope
- Add controlled create workflow for People (`/people/new`) with first name, last name, email, and phone.
- Add controlled edit workflow for People (`/people/[personId]/edit`) for first name, last name, email, and phone.
- Add controlled create workflow for Teams (`/teams/new`) with name and program selection from existing programs.
- Add roster membership add workflow under Team detail (`/teams/[teamId]`) for seeded/current season membership.
- Validate mutation inputs with Zod and surface graceful validation feedback.
- Keep organization-scoped writes and centralized permission stubs using existing mock auth context.
- Maintain graceful handling when database/schema is unavailable.

## Non-Scope
- Authentication provider integration and real authorization policy enforcement.
- Role management UI or role assignment editing.
- Delete workflows.
- Bulk import flows.
- Notes, events, RSVP, attendance, tasks, messaging, inventory, health records, AI, or analytics.
- Automatic seed execution.
- Schema redesign beyond what is strictly necessary for this phase.
