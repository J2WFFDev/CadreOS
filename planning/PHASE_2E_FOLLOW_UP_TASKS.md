# Phase 2E: Follow-up Tasks

## Scope
- Add follow-up task list at `/tasks`.
- Add follow-up task detail at `/tasks/[taskId]`.
- Add task creation workflow at `/tasks/new` with POST handling and redirect to task detail.
- Add task edit workflow at `/tasks/[taskId]/edit` with POST handling and redirect back to task detail.
- Keep mutation authorization placeholder centralized with `task.create` and `task.update` actions.
- Add practical task links from dashboard, notes, and events without overbuilding new navigation.

## Data and Validation Positioning
- Follow-up tasks are scoped to the active organization.
- Tasks include required `title`, `status`, and `assigneePersonId`.
- Tasks support optional `description`, `dueAt`, `sourceNoteId`, and `sourceEventId`.
- Validation remains centralized with existing workflow helpers and Zod parsing.
- No new enum values or Prisma schema changes are required in this phase.

## Accountability Positioning
- Follow-up tasks convert observations, event follow-up, and operational needs into accountable action items.
- Optional source links preserve the originating note or event context without introducing messaging or analytics.
- Created-by attribution first attempts to resolve the current mock auth actor to a linked organization person.
- If no actor person is linked yet, the workflow falls back to a seeded/admin organization person until real auth is implemented.

## Why This Phase Matters
- Notes and events now have a direct path into accountable operational follow-up.
- Staff can track ownership, status, and due dates without adding unrelated product surface area.
- This phase closes the loop between observation capture and execution.

## Non-Scope / Guardrails
- No task delete workflow.
- No messaging features.
- No inventory features.
- No health/medical record workflows.
- No AI or analytics features.
- No real authentication provider integration.
- No automatic seed execution.
