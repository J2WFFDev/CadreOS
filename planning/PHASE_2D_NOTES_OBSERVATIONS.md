# Phase 2D: Notes / Observations

## Scope
- Add staff observation notes list at `/notes`.
- Add note detail at `/notes/[noteId]`.
- Add note creation workflow at `/notes/new` with POST handling and redirect to note detail.
- Add note edit workflow at `/notes/[noteId]/edit` with POST handling and redirect to note detail.
- Keep mutation authorization placeholder centralized with `note.create` and `note.update` actions.
- Keep validation centralized with existing workflow helpers.

## Data and Validation Positioning
- Notes are scoped to the active organization.
- Notes include required `body` text and optional context links:
  - `athletePersonId`
  - `teamId`
  - `eventId`
- Visibility remains the existing enum default `STAFF_ONLY`.
- No new enum values or schema changes are required in this phase.

## Staff-only Positioning
- Observation notes are staff-only by default.
- Notes are not exposed to parent/guardian workflows in this phase.
- No sharing controls are introduced in this phase.

## Author Attribution Limitation
- Note author attribution first attempts to resolve the current mock auth actor to a linked organization person.
- If no actor person is linked yet, the workflow falls back to a seeded/admin organization person.
- This is an intentional temporary limitation until real authentication and policy phases are implemented.

## Why This Phase Matters
- Notes provide quick, structured staff observations tied to people, teams, and events.
- This creates clean context for future follow-up task workflows without implementing tasks yet.

## Non-Scope / Guardrails
- No follow-up Tasks implementation in this phase.
- No note delete workflow.
- No parent/guardian note visibility.
- No messaging features.
- No inventory features.
- No health/medical record workflows.
- No AI or analytics features.
- No real authentication provider integration.
- No automatic seed execution.
