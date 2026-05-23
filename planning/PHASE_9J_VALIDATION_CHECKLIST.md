# Phase 9J — Manual Validation Checklist

## Build / static validation

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

## Linked visibility relationship checks

- [ ] Task create rejects unresolved source-note visibility context for linkage.
- [ ] Task create rejects conflicting note/event linked-visibility assumptions.
- [ ] Task update rejects unresolved source-note visibility context for linkage.
- [ ] Task update rejects conflicting note/event linked-visibility assumptions.
- [ ] Task detail denies unresolved linked visibility context with safe fallback messaging.
- [ ] Event detail excludes tasks whose linked visibility context is unresolved.
- [ ] Tasks list excludes tasks whose linked visibility context is unresolved.
- [ ] Operational history excludes tasks whose linked visibility context is unresolved.

## Workflow continuity checks

- [ ] ObservationNote workflows still function correctly (list/detail/create/edit and event-linked context).
- [ ] FollowUpTask workflows still function correctly (list/detail/create/edit and note/event linkage).
- [ ] Dashboard/review workflows still function correctly.
- [ ] Event/attendance workflows still function correctly.

## Security and boundary checks

- [ ] Organization scoping remains intact.
- [ ] Visibility inheritance behavior remains explicit and safe.
- [ ] Staff-only operational data remains protected.
- [ ] No guardian-facing runtime visibility behavior is introduced.
- [ ] No Entry runtime behavior is introduced.
- [ ] No Feed/Inbox/Journal runtime behavior is introduced.
- [ ] No messaging/notification runtime behavior is introduced.
