# Phase 9F — Manual Validation Checklist

This repository still has no established automated test framework for these workflows, so Phase 9F validation is manual-first.

## Build / static validation

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.

## Authorization consistency checks

- [ ] Non-staff actor cannot access: `/dashboard`, `/events`, `/events/[eventId]`, `/people/[personId]`, `/teams/[teamId]`, `/notes/[noteId]`, `/notes/new`, `/notes/[noteId]/edit`, `/tasks/new`, `/tasks/[taskId]/edit`.
- [ ] Non-staff actor cannot read staff-only note content on note detail.
- [ ] Staff actor can still access all existing operational workflows above.
- [ ] Team-scoped staff actor cannot access team/event/note/task workflows outside allowed team scope where helper checks are now applied.

## Task visibility checks

- [ ] For task detail (`/tasks/[taskId]`), actor access follows `canAccessFollowUpTask` where helper logic is applied.
- [ ] Staff actor still has expected task visibility.
- [ ] Assignee/creator-based access behavior remains correct for linked person actors where applicable.

## Operational workflow regression checks

- [ ] ObservationNote list/detail/create/edit workflows still function for authorized staff users.
- [ ] FollowUpTask list/detail/create/edit workflows still function for authorized staff users.
- [ ] Dashboard/review workflows still load for authorized staff users.
- [ ] Event-linked note/task workflows still load for authorized staff users.
- [ ] Guardian operational context indicators still render for authorized staff users.

## Constraint checks

- [ ] Organization scoping remains intact (`organizationId` filtering unchanged).
- [ ] No Entry runtime behavior was added.
- [ ] No Feed/Inbox/Journal runtime behavior was added.
- [ ] No messaging/notification runtime behavior was added.
