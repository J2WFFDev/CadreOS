# Phase 10C — FollowUpTask Entry Wrapper Integration

## Purpose

Introduce a lightweight, additive Entry wrapper relationship for `FollowUpTask` using the Phase 10A–10B runtime foundation.

This phase remains intentionally constrained:

- `FollowUpTask` remains the primary operational model.
- Existing note/task workflows remain authoritative and unchanged.
- No destructive migration or broad schema replacement.
- No Feed, Inbox, Journal, messaging, notifications, guardian-facing runtime visibility, or workflow automation behavior.

## Phase 10A–10B Foundation Applied

Phase 10A–10B established:

- additive `EntryRuntimeRef` sidecar metadata
- feature-flagged, fail-safe `ObservationNote` wrapper sync
- org-scoped runtime checks and Arc 9 authorization continuity
- read-only wrapper traceability on note detail

Phase 10C extends this pattern to `FollowUpTask` in the same additive, reversible way.

## Implemented Phase 10C Scope

1. **Lightweight FollowUpTask wrapper linkage**
   - `EntryRuntimeRef` now supports `FOLLOW_UP_TASK` source model linkage.
   - `EntryRuntimeRef` now supports `TASK` entry kind.
   - Wrapper visibility metadata supports `TEAM_STAFF` and `ORGANIZATION_SCOPED` in addition to existing `STAFF_ONLY`.
2. **Feature-flagged sidecar sync (non-authoritative)**
   - New flag: `CADREOS_ENTRY_RUNTIME_TASKS_SIDECAR_WRITE`.
   - Task create flow attempts non-blocking wrapper upsert after successful legacy task creation.
   - Task edit flow attempts non-blocking wrapper re-sync after successful legacy task update.
3. **Minimal metadata behavior only**
   - ownership pointer: `createdByPersonId` mirrored to wrapper author pointer
   - visibility metadata derived from existing FollowUpTask operational visibility classification
   - lightweight relationship linkage: athlete/team/event pointers where derivable
   - operational traceability: source model linkage and timestamps
4. **Read-only operational traceability in task detail**
   - Task detail now includes informational wrapper linkage status and metadata summary.
   - Wrapper panel is informational only and does not drive authorization or workflow execution.

## Consistency with ObservationNote Wrapper Behavior

- Wrapper writes remain feature-flagged, fail-safe, and non-authoritative.
- Wrapper read failures remain non-blocking.
- Existing operational models (`ObservationNote`, `FollowUpTask`) remain authoritative for create/edit/read workflows.
- Arc 9 authorization and organization-scoping gates remain authoritative before wrapper reads/writes.

## Explicitly Deferred in Phase 10C

- Any replacement of `FollowUpTask` or `ObservationNote` authoritative reads/writes with Entry runtime
- Broad dual-write expansion beyond constrained note/task sidecar linkage
- Feed runtime behavior
- Inbox triage/runtime behavior
- Journal runtime behavior
- Activity stream rendering
- Messaging/chat behavior
- Notifications/reminders behavior
- Guardian-facing feed/portal runtime behavior
- Workflow automation/orchestration behavior
- Broad backfill/migration of historical notes/tasks into Entry runtime

## Rollback Expectations

Rollback remains additive and reversible:

1. Set `CADREOS_ENTRY_RUNTIME_TASKS_SIDECAR_WRITE=false`.
2. Keep existing task workflows on `FollowUpTask` unchanged.
3. Existing `EntryRuntimeRef` task-linked records can remain as non-authoritative metadata.
4. Task-detail wrapper visibility remains informational only and does not require rollback migration.

No operational rollback migration is required because current runtime behavior does not depend on wrapper linkage for task authorization or task execution.

## Validation Guidance

Use `PHASE_10C_VALIDATION_CHECKLIST.md` for focused verification:

- lint/typecheck/build/prisma validation
- task + note workflow continuity
- wrapper linkage continuity on task create/update
- unchanged organization scoping and Arc 9 authorization behavior
- confirmation that deferred runtime areas remain deferred

## Phase 10C Output Summary

- Added additive Entry wrapper linkage capability for `FollowUpTask`.
- Kept `FollowUpTask` as the authoritative operational model.
- Added feature-flagged, non-blocking task wrapper sync for create/update.
- Added read-only task wrapper traceability panel aligned with existing note wrapper behavior.
- Documented rollback and deferred runtime boundaries for safe incremental rollout.

## PR Summary

Phase 10C extends the Entry wrapper rollout to `FollowUpTask` with a lightweight, additive, reversible sidecar linkage model. Existing task and note workflows remain authoritative, organization-scoped, and governed by current Arc 9 authorization behavior. Entry integration is limited to metadata linkage and traceability only, with no Feed/Inbox/Journal/messaging/notifications/guardian-facing runtime behavior or workflow automation introduced.
