# Phase 9I — Runtime Visibility-Classification Foundation (Current Operational Models)

## Purpose

Phase 9I introduces a lightweight runtime visibility-classification foundation for current operational models without implementing `Entry` and without migrating `ObservationNote` or `FollowUpTask`.

This phase keeps behavior incremental, low-risk, and organization-scoped.

## Scope Completed

1. **Lightweight visibility classification helpers**
   - Added `lib/operational-visibility.ts` with:
     - `classifyObservationNoteOperationalVisibility(...)`
     - `classifyFollowUpTaskOperationalVisibility(...)`
     - `buildSupportedTaskSourceNoteVisibilityWhere(...)`
   - Added explicit, reusable operational concepts:
     - `STAFF_ONLY`
     - `TEAM_STAFF` (only when team context is safely derivable from current linked data)
     - `ORGANIZATION_SCOPED` (safe default when team context is absent)
     - `UNRESOLVED` (deny-by-default fallback)

2. **Visibility evaluation consistency and fallback hardening**
   - Note detail now applies explicit classification before rendering and denies unresolved visibility state with safe messaging.
   - Task detail now derives and evaluates classification from source note/event links and denies unresolved visibility state with safe messaging.
   - Task create/update source-note visibility validation now uses shared classification logic for consistent unresolved handling.

3. **Query behavior hardening where classification is available**
   - Added reusable source-note visibility guard for task queries to exclude tasks linked to unsupported note visibility:
     - tasks list
     - dashboard task panels/counts
     - event-linked task reads
     - operational history task reads
   - Added explicit supported-note-visibility filtering on dashboard/event/operational-history note reads.

## Current Runtime Visibility Behavior (Phase 9I)

- `ObservationNote` remains operationally staff-only (`NoteVisibility.STAFF_ONLY` supported).
- `ObservationNote` operational scope classification:
  - `TEAM_STAFF` when team context is present (direct team or event team link),
  - `ORGANIZATION_SCOPED` when team context is absent,
  - `UNRESOLVED` when visibility is unsupported/unset.
- `FollowUpTask` has no first-class visibility field yet; runtime classification is derived from existing linked operational context and source note visibility when present.
- Unresolved/unsupported visibility states are denied by default with explicit safe fallback messaging.

## Deferred by Design (Unchanged)

- No `Entry` runtime behavior.
- No `ObservationNote` / `FollowUpTask` migration.
- No Feed/Inbox/Journal runtime behavior.
- No messaging/notifications/workflow automation runtime behavior.
- No guardian-facing feed/parent portal behavior.
- No broad schema redesign.
- No new major dependencies.

## Future Entry Compatibility Notes

- The Phase 9I classifier shape is intentionally lightweight so it can be mapped to future Entry-era per-record visibility categories.
- Current logic remains operational-model specific and intentionally avoids full mixed-category Entry visibility complexity.
- Guardian-linked visibility remains deferred until guardian-facing read-path design/consent boundaries are activated.

## Remaining Gaps

- `TEAM_STAFF` is currently derived from existing team/event link data only; no new team ownership model was introduced.
- `FollowUpTask` still relies on derived visibility context, not a stored task visibility field.
- Full per-record mixed visibility enforcement for future Entry categories remains deferred.

## Files Changed (Phase 9I)

- `lib/operational-visibility.ts`
- `app/(dashboard)/notes/[noteId]/page.tsx`
- `app/(dashboard)/tasks/[taskId]/page.tsx`
- `app/(dashboard)/tasks/create/route.ts`
- `app/(dashboard)/tasks/[taskId]/edit/update/route.ts`
- `app/(dashboard)/tasks/page.tsx`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/events/[eventId]/page.tsx`
- `lib/operational-history.ts`
- `planning/PHASE_9I_RUNTIME_VISIBILITY_CLASSIFICATION_FOUNDATION.md`
- `planning/PHASE_9I_VALIDATION_CHECKLIST.md`
- `planning/README.md`

## Validation Reference

See `planning/PHASE_9I_VALIDATION_CHECKLIST.md`.
