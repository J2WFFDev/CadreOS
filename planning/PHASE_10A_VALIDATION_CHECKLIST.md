# Phase 10A Validation Checklist — Minimal Entry Runtime Foundation

## Build / Type Safety

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `DATABASE_URL=... ./node_modules/.bin/prisma validate`
- [ ] `npm run prisma:generate`

## Operational Continuity (must remain unchanged)

- [ ] ObservationNote create/list/detail/edit workflows still function correctly.
- [ ] FollowUpTask create/list/detail/edit workflows still function correctly.
- [ ] Existing dashboard/people/team/task/note read behavior remains legacy-model based.

## Authorization / Scoping Safety

- [ ] Organization scoping remains intact for note and task workflows.
- [ ] Current staff-gated authorization behavior remains intact.
- [ ] No new authorization bypass path was introduced.

## Entry Runtime Introduction Safety

- [ ] Sidecar model is additive and reversible.
- [ ] Sidecar writes are feature-flagged (`CADREOS_ENTRY_RUNTIME_NOTES_SIDECAR_WRITE`).
- [ ] Sidecar writes are non-blocking/fail-safe for note creation flow.
- [ ] Sidecar uniqueness constraint on `(organizationId, sourceModelType, sourceModelId)` is present.
- [ ] Sidecar visibility mapping is constrained to `STAFF_ONLY` only.
- [ ] Sidecar write behavior is limited to newly created notes.

## Deferred Runtime Areas Confirmed Not Implemented

- [ ] No Feed runtime behavior added.
- [ ] No Inbox triage runtime behavior added.
- [ ] No Journal runtime behavior added.
- [ ] No messaging/chat runtime behavior added.
- [ ] No notifications/reminders runtime behavior added.
- [ ] No guardian-facing runtime/feed/portal behavior added.
- [ ] No workflow automation behavior added.
- [ ] No AI/recommendation behavior added.
