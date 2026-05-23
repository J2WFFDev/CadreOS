# Phase 9J — Visibility Relationship Handling and Inheritance Consistency (Current Operational Workflows)

## Purpose

Phase 9J hardens linked-record visibility inheritance for current operational workflows without implementing `Entry` and without migrating `ObservationNote` or `FollowUpTask`.

This phase keeps runtime behavior conservative:
- unresolved/ambiguous visibility relationships deny by default,
- visibility is not automatically broadened,
- organization scoping is preserved.

## Scope Completed

1. **Linked-visibility helper expansion**
   - Extended `lib/operational-visibility.ts` to handle:
     - conflicting note/event/team/program linkage assumptions,
     - unresolved ownership/scope relationships,
     - ambiguous linked-record visibility context.
   - Added lightweight helper for reuse in read workflows:
     - `hasResolvedFollowUpTaskOperationalVisibility(...)`

2. **Note ↔ task and event ↔ task consistency hardening**
   - Task create/update now evaluate linked note/event visibility relationships using shared helper logic before write.
   - Task detail now evaluates note/event linkage consistency more explicitly before rendering.
   - Event detail task panels now exclude tasks with unresolved linked visibility relationships.

3. **Operational review workflow hardening**
   - Tasks list now excludes tasks with unresolved linked visibility relationships after shared classification evaluation.
   - Operational history task slices now exclude unresolved linked visibility relationships.

## Visibility Inheritance Assumptions (Current Runtime)

- `ObservationNote` remains operationally `STAFF_ONLY` only.
- `FollowUpTask` visibility remains derived (no task visibility column yet):
  - source note visibility (when linked),
  - source note team/event scope context,
  - source event team/program context (when linked).
- If linked records imply conflicting or incomplete scope context, task visibility is treated as `UNRESOLVED` and denied/filtered by default.

## Deferred by Design (Unchanged)

- No `Entry` model/runtime implementation.
- No `ObservationNote` / `FollowUpTask` migration.
- No Feed/Inbox/Journal runtime behavior.
- No messaging/notifications/workflow automation runtime behavior.
- No guardian-facing feed or parent portal runtime behavior.
- No broad schema redesign.
- No new major dependencies.

## Future Entry Implications

- Phase 9J keeps helper logic small and model-local so it can map to future Entry-era visibility categories.
- Current linked-relationship conflict checks are conservative guardrails, not a complete Entry visibility graph.
- Guardian-linked visibility remains deferred until guardian-facing read-path + consent boundaries are activated.

## Remaining Gaps

- `FollowUpTask` still has no first-class stored visibility field.
- Cross-record consistency checks are still bounded by current model links and runtime derivation (not centralized Entry policy objects).
- Dashboard task aggregates still rely on existing scoped query constraints and do not yet run full linked-relationship post-classification on every aggregate path.

## Files Changed (Phase 9J)

- `lib/operational-visibility.ts`
- `app/(dashboard)/tasks/create/route.ts`
- `app/(dashboard)/tasks/[taskId]/edit/update/route.ts`
- `app/(dashboard)/tasks/[taskId]/page.tsx`
- `app/(dashboard)/tasks/page.tsx`
- `app/(dashboard)/events/[eventId]/page.tsx`
- `lib/operational-history.ts`
- `planning/PHASE_9J_VISIBILITY_RELATIONSHIP_INHERITANCE_CONSISTENCY.md`
- `planning/PHASE_9J_VALIDATION_CHECKLIST.md`
- `planning/README.md`

## Validation Reference

See `planning/PHASE_9J_VALIDATION_CHECKLIST.md`.
