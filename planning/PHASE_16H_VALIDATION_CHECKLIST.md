# Phase 16H Validation Checklist: GearOps Consumable Transaction Workflows

## Build Validation

- [ ] `npm run lint` — no new lint errors
- [ ] `npm run typecheck` — no new TypeScript errors
- [ ] `npm run build` — build succeeds without errors
- [ ] `DATABASE_URL=... ./node_modules/.bin/prisma validate` — schema validation passes (schema unchanged)

---

## Permissions and Authorization

- [ ] `gearConsumableTransaction.create` added to `SupportedAction` union in `lib/permissions/index.ts`
- [ ] `gearConsumableTransaction.update` added to `SupportedAction` union in `lib/permissions/index.ts`
- [ ] Both actions added to `ORGANIZATION_ADMIN` role set
- [ ] Both actions added to `PROGRAM_DIRECTOR` role set
- [ ] Both actions added to `COACH` role set
- [ ] Neither action added to `ASSISTANT_COACH`, `PARENT_GUARDIAN`, or `ATHLETE` role sets
- [ ] Neither action added to `SCOPED_ACTIONS` (org-scoped only)
- [ ] Both actions added to `SUPPORTED_ACTIONS`
- [ ] `requirePhase1CMutationPermission` action union includes `gearConsumableTransaction.create` and `gearConsumableTransaction.update`

---

## Workflow Schema

- [ ] `gearConsumableTransactionWorkflowSchema` added to `lib/workflows/index.ts`
- [ ] `GearConsumableTransactionWorkflowInput` type exported
- [ ] `ConsumableTransactionType` imported in workflows module
- [ ] `transactionType` validates against `ConsumableTransactionType` enum
- [ ] `quantityDelta` validates as non-zero integer server-side
- [ ] Quantity sign/meaning validation enforced by transaction type where practical
- [ ] `recordedAt` required and validates `YYYY-MM-DDTHH:mm` format
- [ ] `notes` max length enforced server-side

---

## Consumable Transaction Create Form (`/gear-ops/items/[itemId]/consumables/new`)

- [ ] Page renders when item exists and user has staff read access
- [ ] `resolveGearOpsReadAccess` is called and access denial is handled
- [ ] Form displays item and organization context
- [ ] Form includes transaction type, quantity delta, recorded date/time, optional event, and optional notes
- [ ] Form posts to `/gear-ops/items/[itemId]/consumables/create`
- [ ] Cancel link returns to item detail
- [ ] Form preserves values and field errors from validation redirects
- [ ] Not-found state shown for invalid item id with safe back link
- [ ] Durable item requests show clear non-applicable messaging

---

## Consumable Transaction Create Route (`POST /gear-ops/items/[itemId]/consumables/create`)

- [ ] Requires `gearConsumableTransaction.create` permission via `requirePhase1CMutationPermission`
- [ ] Returns 303 redirect with error when database is not ready
- [ ] Returns 303 redirect with error when organization context is missing
- [ ] Returns 303 redirect with field errors when validation fails
- [ ] Verifies `gearItemId` belongs to authenticated organization
- [ ] Verifies target item is `CONSUMABLE`
- [ ] Cross-org guard enforces organization membership for optional event id
- [ ] Resolves actor attribution for `recordedByPersonId`
- [ ] Creates `ConsumableTransaction` with organization-scoped references
- [ ] Updates `GearItem.quantityOnHand` by transaction delta
- [ ] Redirects to `/gear-ops/items/[itemId]` on success
- [ ] Permission denied and schema-unavailable errors return safe user-facing messages

---

## Consumable Transaction Edit Form (`/gear-ops/items/[itemId]/consumables/[transactionId]/edit`)

- [ ] Page renders when item and transaction exist and user has staff read access
- [ ] `resolveGearOpsReadAccess` is called and access denial is handled
- [ ] Form pre-fills from existing transaction values
- [ ] Form preserves query param values/errors after failed updates
- [ ] Form posts to `/gear-ops/items/[itemId]/consumables/[transactionId]/edit/update`
- [ ] Cancel link returns to item detail
- [ ] Not-found state shown for invalid item id with safe back link
- [ ] Not-found state shown for invalid transaction id with safe back link to item
- [ ] Durable item requests show clear non-applicable messaging

---

## Consumable Transaction Update Route (`POST /gear-ops/items/[itemId]/consumables/[transactionId]/edit/update`)

- [ ] Requires `gearConsumableTransaction.update` permission via `requirePhase1CMutationPermission`
- [ ] Returns 303 redirect with error when database is not ready
- [ ] Returns 303 redirect with error when organization context is missing
- [ ] Returns 303 redirect with field errors when validation fails
- [ ] Verifies `gearItemId` belongs to authenticated organization
- [ ] Verifies target item is `CONSUMABLE`
- [ ] Cross-org guard enforces organization membership for optional event id
- [ ] Uses `id + gearItemId + organizationId` filter to prevent cross-org writes
- [ ] Returns error redirect when no matching transaction row is updated
- [ ] Applies stock correction to `GearItem.quantityOnHand` using quantity delta difference
- [ ] Redirects to `/gear-ops/items/[itemId]` on success
- [ ] Permission denied and schema-unavailable errors return safe user-facing messages

---

## Item Detail Consumable Visibility

- [ ] Consumable section shows **New transaction** entry link for consumable items
- [ ] Transaction cards include **Edit** links
- [ ] Consumable display is split into **Recent transactions** and **Transaction history**
- [ ] Cards show transaction type, quantity, unit label, related context, notes, and actor/created context
- [ ] Safe empty state shown when no consumable transactions exist for a consumable item
- [ ] Durable items show clear non-applicable messaging instead of consumable transaction cards

---

## Preserved Behavior

- [ ] Arc 16C GearOps read-only catalog routes still render correctly
- [ ] Arc 16D category/item create/edit workflows still function
- [ ] Arc 16E assignment workflows still function
- [ ] Arc 16F checkout/check-in workflows still function
- [ ] Arc 16G maintenance workflows still function
- [ ] Core and FieldOps routes remain unaffected
- [ ] Prisma schema remains unchanged

---

## Planning Documentation

- [ ] `planning/PHASE_16H_GEAROPS_CONSUMABLE_TRANSACTION_WORKFLOWS.md` created
- [ ] `planning/PHASE_16H_VALIDATION_CHECKLIST.md` created (this file)
- [ ] `planning/README.md` updated with Arc 16H planning docs

