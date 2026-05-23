# Phase 9H — Manual Validation Checklist

## Build / static validation

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

## Authorization boundary hardening checks

- [ ] Scoped staff users do not receive broad organization-wide event/note/task list data by default.
- [ ] Ambiguous role scope assignments (missing team/program pointers) are denied with safe, non-sensitive user messaging.
- [ ] Program-scoped staff access to team-scoped records is denied when team-program mapping is unresolved.
- [ ] Organization-scoped content (teamless records) is denied for non-organization-scope assignments.

## Workflow continuity checks

- [ ] ObservationNote list/detail workflows still function for authorized users (`/notes`, `/notes/[noteId]`).
- [ ] FollowUpTask list/detail workflows still function for authorized users (`/tasks`, `/tasks/[taskId]`).
- [ ] Dashboard/review workflows still function for authorized users (`/dashboard` and linked review surfaces).
- [ ] Event detail workflow still functions with team/program scoped authorization enforcement (`/events/[eventId]`).

## Route hardening checks

- [ ] Note create/update rejects mismatched team+event combinations with safe validation messaging.
- [ ] Task create/update rejects mismatched source note/event combinations with safe validation messaging.
- [ ] Task create/update rejects unsupported/unresolved source note visibility for linkage.

## Security and boundary checks

- [ ] Organization scoping remains intact in hardened queries.
- [ ] Unauthorized users cannot access staff-only operational data.
- [ ] Authorization fallback behavior is explicit and safe (deny-by-default where uncertain).
- [ ] Internal authorization decision internals are not exposed in normal user UI.
- [ ] No Entry runtime behavior was added.
- [ ] No Feed/Inbox/Journal runtime behavior was added.
- [ ] No messaging/notification runtime behavior was added.
- [ ] No guardian-facing feed/portal behavior was added.
