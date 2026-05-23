# Phase 9H — Authorization Boundary Hardening and Safe Visibility Defaults

## Purpose

Phase 9H hardens authorization boundaries for current operational workflows by enforcing safer defaults, reducing implicit trust-by-route behavior, and narrowing scoped reads for non-organization-wide staff assignments.

This phase remains strictly within current runtime models (`ObservationNote`, `FollowUpTask`, dashboard/review, and event-linked workflows) and does not activate Entry/Feed/Inbox/Journal/messaging behavior.

## Scope Completed

1. **Authorization helper hardening (`lib/authorization/index.ts`)**
   - Added explicit note-visibility helper (`canReadObservationNoteByVisibility` / `evaluateObservationNoteVisibilityAccess`) with deny-by-default behavior for unsupported/unresolved visibility states.
   - Hardened team-scope evaluation to:
     - require resolved team-program context for program-scoped access,
     - deny organization-level (teamless) content for non-organization-scope assignments,
     - remove conservative allow-on-uncertainty behavior.
   - Added `resolveStaffScopeResolution` for safe scope derivation and ambiguous-scope detection.

2. **Scoped-query hardening for operational list/review workflows**
   - Applied explicit scoped filtering to event, note, and task list/review data paths so non-org-scope staff no longer receive broad organization-wide datasets by default.
   - Added explicit safe fallback UI when scope assignments are ambiguous or insufficient for safe evaluation.
   - Applied the same scoped principles to dashboard aggregated operational reads for events/notes/tasks.

3. **Boundary consistency on detail workflows**
   - Event detail team-scope checks now include resolved program context to avoid program-scope ambiguity.
   - Note/task detail team-scope evaluation now resolves and passes program context derived from related team/event links.
   - Note detail now applies explicit note visibility gate through the helper layer.

4. **Route hardening for ambiguous linked context**
   - Note create/update now rejects team/event combinations when team context conflicts with selected event context.
   - Task create/update now rejects:
     - source notes with unsupported visibility states,
     - source note + source event combinations where event linkage is inconsistent.

## Safe Default Behavior (Phase 9H)

- Deny by default when:
  - role scope assignments are ambiguous (missing program/team pointer),
  - program-scoped access cannot be verified against resolved team program context,
  - note visibility is unresolved/unsupported for current operational workflows.
- Preserve explicit organization scoping in all hardened query paths.
- Keep guardian operational visibility diagnostics staff-gated only; no guardian-facing feed/portal behavior is introduced.

## Deferred by Design

- No Entry model/runtime behavior.
- No ObservationNote/FollowUpTask migration.
- No Feed/Inbox/Journal runtime behavior.
- No messaging/notifications/automation behavior.
- No guardian-facing feed/portal implementation.
- No major dependency additions.

## Remaining Risks / Follow-up

- Scope-filter coverage is focused on current operational workflows; remaining non-operational pages may still require additional per-record scope hardening in future phases.
- Program/team scoping depends on integrity of existing role assignment and relationship data; malformed records are now denied more aggressively, which may surface admin remediation needs.
- Entry-era mixed visibility categories remain deferred and will require dedicated per-category helper expansion.

## Files Changed (Phase 9H)

- `lib/authorization/index.ts`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/events/page.tsx`
- `app/(dashboard)/events/[eventId]/page.tsx`
- `app/(dashboard)/notes/page.tsx`
- `app/(dashboard)/notes/[noteId]/page.tsx`
- `app/(dashboard)/tasks/page.tsx`
- `app/(dashboard)/tasks/[taskId]/page.tsx`
- `app/(dashboard)/notes/create/route.ts`
- `app/(dashboard)/notes/[noteId]/edit/update/route.ts`
- `app/(dashboard)/tasks/create/route.ts`
- `app/(dashboard)/tasks/[taskId]/edit/update/route.ts`
- `planning/PHASE_9H_AUTHORIZATION_BOUNDARY_HARDENING.md`
- `planning/PHASE_9H_VALIDATION_CHECKLIST.md`
- `planning/README.md`

## Validation Reference

See `planning/PHASE_9H_VALIDATION_CHECKLIST.md`.
