# Phase 9I — Manual Validation Checklist

## Build / static validation

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

## Operational visibility classification checks

- [ ] Observation note detail enforces classification with explicit safe fallback for unresolved visibility (`/notes/[noteId]`).
- [ ] Follow-up task detail enforces derived classification with explicit safe fallback for unresolved visibility (`/tasks/[taskId]`).
- [ ] Team-linked records are evaluated as `TEAM_STAFF` only when team context is actually resolvable from existing links.
- [ ] Teamless operational records evaluate as `ORGANIZATION_SCOPED` and remain safely constrained.

## Query hardening checks

- [ ] Tasks list excludes tasks linked to unsupported source note visibility states.
- [ ] Dashboard task count/list panels exclude tasks linked to unsupported source note visibility states.
- [ ] Event detail task reads exclude tasks linked to unsupported source note visibility states.
- [ ] Operational history task reads exclude tasks linked to unsupported source note visibility states.
- [ ] Dashboard/event/operational-history note reads remain constrained to currently supported operational note visibility.

## Workflow continuity checks

- [ ] ObservationNote workflows still function correctly (list/detail/create/edit and event-linked note context).
- [ ] FollowUpTask workflows still function correctly (list/detail/create/edit and note/event linkage).
- [ ] Dashboard/review workflows still function correctly.
- [ ] Event-linked operational workflows still function correctly.

## Security and boundary checks

- [ ] Organization scoping remains intact.
- [ ] Staff-only operational data remains protected.
- [ ] Visibility fallback behavior is explicit and safe.
- [ ] No guardian-facing runtime visibility behavior is introduced.
- [ ] No Entry runtime behavior is introduced.
- [ ] No Feed/Inbox/Journal runtime behavior is introduced.
- [ ] No messaging/notification runtime behavior is introduced.
