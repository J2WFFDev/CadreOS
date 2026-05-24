# Phase 16B Validation Checklist — GearOps Prisma Schema and Data Model

## Build / Schema Validation

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `DATABASE_URL=... ./node_modules/.bin/prisma validate`

## Schema Scope and Boundaries

- [ ] Exactly six GearOps models are present: `GearCategory`, `GearItem`, `GearAssignment`, `GearCheckout`, `GearMaintenanceLog`, `ConsumableTransaction`.
- [ ] All GearOps models are organization-scoped via `organizationId` + FK relation.
- [ ] Existing Core models were not behaviorally modified beyond required back-relations.
- [ ] GearOps remains additive and reference-based (no Core/FieldOps ownership takeover).

## Core Reference Integrity

- [ ] `Program` is referenced where appropriate for inventory scoping.
- [ ] `Team` is referenced where appropriate for assignment context.
- [ ] `Person` attribution exists for assignment, checkout/custody, maintenance, and consumable transactions.
- [ ] `Event` is referenced where appropriate for assignment/custody/consumption context.

## Durable vs Consumable Data Behavior

- [ ] Durable lifecycle/condition semantics are represented in gear enums and models.
- [ ] Consumable stock movement is represented as transaction log entries (`ConsumableTransaction`).
- [ ] Maintenance history is represented for durable accountability (`GearMaintenanceLog`).
- [ ] Custody transfer lifecycle is represented (`GearCheckout`).

## Index and Constraint Coverage

- [ ] MVP lookup indexes exist for organization-scoped list/filter usage.
- [ ] Required uniqueness constraints exist for category naming and durable identity fields.
- [ ] Assignment/checkout due-state queries are supported by indexes.
- [ ] Consumable activity timeline filtering is supported by indexes.

## Deferred Scope Confirmations

- [ ] No UI pages were added.
- [ ] No runtime workflows were added.
- [ ] No messaging/notifications were added.
- [ ] No purchasing/finance/depreciation was added.
- [ ] No automated replenishment behavior was added.
