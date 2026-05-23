# Phase 1E: Basic Program Management

## Scope
- Add a create program workflow (`/programs/new` and POST create route) with:
  - Program `name`
  - Active organization context assignment
  - Zod validation
  - Duplicate-name prevention within the same organization
  - Redirect to `/programs` on success
- Add an edit program workflow (`/programs/[programId]/edit` and POST update route) with:
  - Program `name` editing
  - Zod validation
  - Duplicate-name prevention within the same organization
  - Redirect to `/programs/[programId]` on success
- Add program detail page (`/programs/[programId]`) showing:
  - Program name
  - Organization name
  - Teams under the program (linked to `/teams/[teamId]`)
  - Program-scoped role assignments when available
- Update `/programs` to:
  - Include a **New Program** action
  - Link program names to program detail pages
  - Show team count per program
- Keep `/teams/new` behavior aligned with existing program selection and ensure newly created programs are selectable through live program queries.

## Data/Model Positioning
- Program is the management container above Teams in the Phase 1 hierarchy:
  - `Organization → Program → Team`
- Leadership assignment for Program remains handled through existing role assignments (`RoleAssignment` with `ScopeType.PROGRAM`) rather than adding custom Program leadership fields.

## Non-Scope / Limitations
- No program deletion workflow in this phase.
- No organization management UI in this phase.
- No authentication provider integration (mock auth remains).
- No additional Prisma schema fields unless strictly required (none expected).
- No board-specific models or role-enum additions in this phase.
- No notes, events, RSVP, attendance, tasks, messaging, inventory, health records, AI, or analytics.
- No automatic seed execution.
