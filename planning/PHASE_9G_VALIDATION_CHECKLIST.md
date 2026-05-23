# Phase 9G — Manual Validation Checklist

This phase adds internal authorization decision visibility and logging while preserving existing operational workflows.

## Build / static validation

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

## Authorization decision visibility checks

- [ ] With `CADREOS_AUTH_AUDIT_LOG=true`, denied staff-only access emits `[cadreos.authz]` log entries containing `reasonCode`, `scopeApplied`, and `ownershipRelationship`.
- [ ] Team-scope denials emit `DENY_TEAM_SCOPE_MISMATCH` when actor has no matching team/program/organization scope.
- [ ] Task ownership checks on `/tasks/[taskId]` emit `ALLOW_TASK_ASSIGNEE` / `ALLOW_TASK_CREATOR` / `DENY_TASK_NO_OWNERSHIP` as appropriate.
- [ ] Logs stay server-side only and are not rendered into end-user UI.

## Operational regression checks

- [ ] ObservationNote list/detail workflows still function for authorized staff users (`/notes`, `/notes/[noteId]`).
- [ ] FollowUpTask list/detail workflows still function for authorized staff users (`/tasks`, `/tasks/[taskId]`).
- [ ] Dashboard/review workflows still function for authorized staff users (`/dashboard` and linked review surfaces).
- [ ] Existing deny messages for unauthorized users remain user-safe and do not expose internal decision payloads.

## Scope and policy guardrail checks

- [ ] Organization scoping remains intact (`organizationId` filters unchanged).
- [ ] Authorization helpers still enforce expected visibility rules.
- [ ] No Entry runtime behavior was added.
- [ ] No Feed/Inbox/Journal runtime behavior was added.
- [ ] No messaging/notification runtime behavior was added.
- [ ] No guardian-facing feed/portal behavior was added.

## Notes for operators

- Authorization decision logging is opt-in via `CADREOS_AUTH_AUDIT_LOG`.
- Keep this logging disabled in normal operation unless diagnosing authorization incidents.
