# Phase 17B — Member Status and Lifecycle Model

## Goal

Add the smallest safe schema support for explicit member/person lifecycle status so Arc 17 workflows (join, move, inactive/archive, rollover, guardian maintenance) can be implemented in later phases without disrupting existing runtime behavior.

## Scope

- Add minimal lifecycle status model support in Prisma.
- Keep lifecycle state organization-scoped.
- Preserve existing Core MVP, FieldOps, GearOps, role assignment, roster membership, and guardian relationship behavior.
- Do not implement lifecycle workflows in this phase.

## Model Decision

### Chosen model

Add lifecycle status directly to `Person`:

- New enum: `MemberLifecycleStatus`
  - `PROSPECT`
  - `ACTIVE`
  - `INACTIVE`
  - `ARCHIVED`
  - `ALUMNI`
- New field on `Person`:
  - `lifecycleStatus MemberLifecycleStatus @default(ACTIVE)`
- New index:
  - `@@index([organizationId, lifecycleStatus])`

### Why `Person` was modified directly

This is the smallest safe model for current CadreOS architecture:

1. `Person` is already the canonical organization-scoped identity used by `UserAccount`, `RoleAssignment`, `RosterMembership`, attendance, notes/tasks, FieldOps, and GearOps references.
2. Lifecycle status at this stage is a per-person participation state; it does not yet require separate transition history, policy metadata, or per-season status snapshots.
3. A separate `MemberProfile`/`MemberLifecycle` model would add joins and write orchestration without immediate Arc 17B functional value, increasing implementation and migration complexity before workflows are introduced.

## Backward Compatibility and Safety

- Existing create flows remain stable because `lifecycleStatus` defaults to `ACTIVE`.
- No existing relation or unique constraint was changed.
- No runtime authorization helper behavior was changed.
- No FieldOps or GearOps behavior was changed.
- No guardian access behavior was changed.

## Deferred by Design (Not in 17B)

- Join/activate workflow routes and transition enforcement
- Team/program move workflows
- Inactive/archive execution workflows
- Season rollover workflows
- Guardian relationship maintenance workflows
- Reporting dashboards and lifecycle analytics
- Messaging/notifications and parent portal behavior

## Arc 17B Output Summary

Arc 17B introduces explicit member lifecycle state in the schema with a single additive `Person.lifecycleStatus` field, a lifecycle enum, and an organization+status index for MVP filtering, while intentionally deferring all lifecycle workflow execution to later Arc 17 phases.
