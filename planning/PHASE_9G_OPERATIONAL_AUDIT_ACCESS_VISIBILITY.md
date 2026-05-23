# Phase 9G — Operational Audit Visibility and Access-Evaluation Transparency

## Purpose

Phase 9G adds lightweight internal visibility into authorization decisions for active operational workflows so developers/operators can quickly answer:

- why access was allowed
- why access was denied
- what scope was applied
- what ownership relationship was used

This phase keeps runtime behavior constrained to current operational models (`ObservationNote`, `FollowUpTask`, dashboard/review surfaces) without introducing Entry runtime behavior.

## Scope Completed

1. **Authorization decision context/evaluation helpers (`lib/authorization/index.ts`)**
   - Added structured `AuthorizationDecision` output for:
     - staff-only checks
     - team-scoped checks
     - follow-up task ownership checks
   - Decision output now includes:
     - helper name
     - allow/deny result
     - reason code + human-readable reason
     - scope applied (`organization` / `team` / `program` / ownership scope)
     - ownership relationship (`staff_role`, `assignee`, `creator`, etc.)
     - matched role assignment details where relevant

2. **Optional structured auth decision logging**
   - Added `logAuthorizationDecision(...)` with environment-gated output:
     - enabled only when `CADREOS_AUTH_AUDIT_LOG` is set to `1`, `true`, `yes`, or `on`
   - Logging is server-side/internal only.
   - No end-user UI exposure of internal authorization internals.

3. **Operational workflow integration (targeted)**
   - Added explicit decision logging with workflow/entity context on:
     - dashboard access (`/dashboard`)
     - notes list/detail (`/notes`, `/notes/[noteId]`)
     - tasks list/detail (`/tasks`, `/tasks/[taskId]`)
   - Task detail now emits ownership + team-scope decision traces.
   - Note detail now emits team-scope decision traces.

4. **Backwards-compatible helper behavior**
   - Existing boolean helpers (`canReadStaffOnlyContent`, `canReadTeamScopedContent`, `canAccessFollowUpTask`) now evaluate through the structured decision helpers and preserve return semantics.
   - Existing organization scoping behavior is unchanged.

## Authorization Evaluation Flow (Current)

1. Resolve actor role context once (`resolveActorRoleContext`).
2. Evaluate access using structured decision helpers:
   - `evaluateStaffOnlyContentAccess`
   - `evaluateTeamScopedContentAccess`
   - `evaluateFollowUpTaskAccess`
3. Optionally log the decision via `logAuthorizationDecision` for internal debugging/operations.
4. Render user-safe allow/deny UI messaging without exposing internal reason internals to non-operator users.

## Debugging Authorization Problems

When diagnosing access issues in development/staging:

1. Enable structured auth audit logs:
   - `CADREOS_AUTH_AUDIT_LOG=true`
2. Reproduce the workflow and inspect server logs for `[cadreos.authz]` entries.
3. Use decision fields to identify failure cause quickly:
   - `reasonCode`
   - `scopeApplied`
   - `ownershipRelationship`
   - `matchedRoleAssignment`
   - workflow/entity metadata from call sites where provided.

## Existing Audit/Event Logging Pattern Review

- `lib/audit/index.ts` remains a no-op placeholder (`writeAuditEvent`) and was not expanded in this phase.
- Phase 9G intentionally focuses on lightweight authorization-evaluation visibility instead of introducing broad persistence/audit schema changes.

## Current Limitations (Intentional)

- No persistent audit table writes were added for auth decisions (server log visibility only, environment-gated).
- Program-to-team strict verification remains conservative for program-scoped assignments in `canReadTeamScopedContent`/`evaluateTeamScopedContentAccess`.
- Not all legacy pages currently attach workflow/entity metadata on every helper call; base helper-level optional logging still exists.

## Deferred by Design

- No Entry model runtime behavior.
- No ObservationNote/FollowUpTask migration.
- No Feed/Inbox/Journal runtime behavior.
- No guardian-facing portal/feed behavior.
- No messaging, notifications, or workflow automation runtime behavior.
- No schema redesign beyond current operational models.

## Future Entry Implications

The structured decision shape added in Phase 9G is intended to map directly to future Entry read enforcement and migration hardening:

- visibility-category evaluation reason codes
- ownership relationship traces
- scope resolution traces
- internal operator debugging for mixed-visibility Entry records

## Files Changed

- `lib/authorization/index.ts`
- `app/(dashboard)/dashboard/page.tsx`
- `app/(dashboard)/notes/page.tsx`
- `app/(dashboard)/notes/[noteId]/page.tsx`
- `app/(dashboard)/tasks/page.tsx`
- `app/(dashboard)/tasks/[taskId]/page.tsx`
- `planning/PHASE_9G_OPERATIONAL_AUDIT_ACCESS_VISIBILITY.md`
- `planning/PHASE_9G_VALIDATION_CHECKLIST.md`
- `planning/README.md`

## Validation Reference

See `planning/PHASE_9G_VALIDATION_CHECKLIST.md`.
