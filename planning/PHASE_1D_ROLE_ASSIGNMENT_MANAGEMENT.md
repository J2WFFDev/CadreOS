# Phase 1D: Role Assignment Management

## Scope
- Show role assignment details on person detail including role type, scope type, and program/team context.
- Add role assignment workflow on person detail with role type and scope selection.
- Validate role assignment input with Zod using existing enum values only.
- Enforce scope constraints:
  - `ORGANIZATION`: no program/team linkage
  - `PROGRAM`: program required, no team linkage
  - `TEAM`: team required
- Add create-role route with duplicate prevention using `findFirst` for nullable scope fields.
- Keep mutation authorization placeholder centralized and unchanged in behavior (mock auth remains).
- Add explicit role-assignment-only delete behavior (hard delete of `RoleAssignment` records only).
- Redirect back to person detail after create/delete and keep graceful schema/database fallback messages.
- Keep people list/detail role summaries current after assignment changes.

## Non-Scope / Limitations
- No real authentication provider integration.
- No full permissions enforcement policy.
- No people deletion or team deletion.
- No enum additions or role taxonomy redesign.
- No schema redesign unless strictly required (none added for this phase).
- No notes, events, RSVP, attendance, tasks, messaging, inventory, health records, AI, or analytics.
- No automatic seed execution.
