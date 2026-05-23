# Phase 9F — Authorization Consistency and Query Hardening

## Purpose

Phase 9F applies the Phase 9E authorization helpers more consistently across active operational read workflows, with low-risk hardening of note/task access behavior and team-scoped workflow assumptions.

## Scope Completed

- Reused `resolveActorRoleContext` / `canReadStaffOnlyContent` across additional operational read pages to avoid implicit UI trust.
- Applied `canReadTeamScopedContent` on selected team/event/note/task detail workflows where team scope is available.
- Applied `canAccessFollowUpTask` for task-detail visibility checks so task access aligns with assignee/creator helper semantics where helper logic is now enforced.
- Preserved organization scoping (`organizationId`) and existing guardian diagnostic behavior.
- Added Phase 9F manual validation guidance and planning index updates.

## Runtime Areas Hardened

- Dashboard operational review surface.
- Events list and event detail operational workflows.
- Note detail and note edit/create surfaces.
- Task detail and task edit/create surfaces.
- Team and person operational detail surfaces (staff-only gating, plus team-scope check on team detail).

## Current Authorization Limitations (Intentional)

- Program-to-team strict verification is still conservative via `canReadTeamScopedContent` behavior from Phase 9E; no new async program/team verification was introduced.
- Person detail workflows remain staff-gated but are not yet decomposed into per-record, mixed-visibility sections.
- Operational history remains existing-model based (`ObservationNote`, `FollowUpTask`) and is not migrated to Entry semantics.

## Deferred by Design

- No Entry model runtime behavior.
- No ObservationNote / FollowUpTask migration.
- No Feed / Inbox / Journal runtime behavior.
- No guardian-facing portal/feed behavior.
- No messaging, notifications, or workflow automation runtime.
- No schema redesign.

## Future Entry Implications

The Phase 9F gating changes intentionally align current workflows with Entry-read helper patterns so Entry visibility enforcement can be introduced incrementally later without widening current runtime scope.

## Validation Reference

See `planning/PHASE_9F_VALIDATION_CHECKLIST.md`.
