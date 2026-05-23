# Phase 10A — Minimal Entry Runtime Foundation (Arc 10 Candidate Slice A/B)

## Purpose

Implement the smallest safe, non-destructive Entry runtime foundation recommended by Phase 9M/9N:

- Additive sidecar metadata only.
- No broad migration.
- No replacement of `ObservationNote` or `FollowUpTask`.
- No feed/inbox/journal runtime behavior.

## Arc 9 Readiness Guidance Applied

Phase 9M and 9N recommended the first Arc 10 runtime slice as:

- Feature-flagged `ObservationNote` sidecar write path.
- Minimal non-authoritative metadata only.
- Strict organization scoping.
- `STAFF_ONLY` mapping only.
- Fail-safe, rollback-ready behavior.

This phase implements exactly that bounded slice.

## Implemented Runtime Scope (and only this scope)

1. **Additive sidecar model**: `EntryRuntimeRef`
   - `organizationId`
   - `sourceModelType` (`OBSERVATION_NOTE`)
   - `sourceModelId`
   - `entryKind` (`NOTE`)
   - `authorPersonId`
   - `visibilityClass` (`STAFF_ONLY`)
   - optional lightweight links: `athletePersonId`, `teamId`, `eventId`
   - timestamps (`createdAt`, `updatedAt`)
2. **Schema safety**
   - Additive-only schema change.
   - Unique constraint on `(organizationId, sourceModelType, sourceModelId)`.
3. **Runtime write behavior**
   - `ObservationNote` create route performs existing auth/scope checks first.
   - After note creation, sidecar write is attempted behind `CADREOS_ENTRY_RUNTIME_NOTES_SIDECAR_WRITE`.
   - Sidecar write is fail-safe/non-authoritative and must not block note creation.
4. **Visibility handling**
   - Sidecar writes only map `NoteVisibility.STAFF_ONLY`.
   - Unsupported visibility states are skipped.
5. **Organization scope guardrail**
   - Sidecar writes require note organization to match active organization scope.

## Explicitly Deferred in Phase 10A

- Any migration/backfill of existing notes/tasks.
- Any change to `ObservationNote` authoritative reads/writes.
- Any change to `FollowUpTask` authoritative reads/writes.
- Feed runtime behavior.
- Inbox triage runtime behavior.
- Journal runtime behavior.
- Messaging/chat runtime behavior.
- Notifications/reminders runtime behavior.
- Guardian-facing feed/portal runtime behavior.
- Workflow automation behavior.
- AI/recommendation behavior.

## Rollback Expectations

Rollback is immediate and non-destructive:

1. Set `CADREOS_ENTRY_RUNTIME_NOTES_SIDECAR_WRITE=false`.
2. Keep all existing note/task runtime behavior unchanged.
3. Existing `EntryRuntimeRef` rows can remain as non-authoritative metadata.

No rollback migration is required for operational continuity because current runtime reads do not depend on `EntryRuntimeRef`.

## Runtime Safety Assumptions

- Existing authorization and organization scoping remain the authoritative gate for note creation.
- Existing note/task/dashboard/history reads remain on current models.
- Sidecar writes are metadata-only and non-blocking.
- Current visibility policy remains operationally `STAFF_ONLY` for notes.

## Phase 10A Output Summary

- Added `EntryRuntimeRef` sidecar model and enums to Prisma schema.
- Added feature-flagged, fail-safe sidecar write helper for newly created notes only.
- Wired note-create route to attempt sidecar write after successful legacy note creation.
- Added focused documentation and validation checklist for this constrained runtime slice.

## Validation Status

- Typecheck/build/lint/prisma-validate run before implementation.
- Post-change validation is tracked in `PHASE_10A_VALIDATION_CHECKLIST.md`.

## PR Summary

Phase 10A introduces a minimal, additive, reversible Entry runtime foundation by adding a feature-flagged `ObservationNote` sidecar write (`EntryRuntimeRef`) with organization scoping, ownership metadata, `STAFF_ONLY` visibility classification, and lightweight link references. `ObservationNote` and `FollowUpTask` remain authoritative and unchanged, with no feed/inbox/journal/messaging/notification/guardian runtime behavior introduced. Rollback is immediate by disabling the feature flag.
