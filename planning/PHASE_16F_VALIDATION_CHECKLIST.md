# Phase 16F Validation Checklist: GearOps Checkout and Check-in Workflows

## Build Validation

- [ ] `npm run lint` — no new lint errors
- [ ] `npm run typecheck` — no new TypeScript errors
- [ ] `npm run build` — build succeeds without errors
- [ ] `DATABASE_URL=... ./node_modules/.bin/prisma validate` — schema validation passes (schema unchanged)

---

## Permissions and Authorization

- [ ] `gearCheckout.create` added to `SupportedAction` union in `lib/permissions/index.ts`
- [ ] `gearCheckout.update` added to `SupportedAction` union in `lib/permissions/index.ts`
- [ ] Both actions added to `ORGANIZATION_ADMIN` role set
- [ ] Both actions added to `PROGRAM_DIRECTOR` role set
- [ ] Both actions added to `COACH` role set
- [ ] Neither action added to `ASSISTANT_COACH`, `PARENT_GUARDIAN`, or `ATHLETE` role sets
- [ ] Neither action added to `SCOPED_ACTIONS` (org-scoped only)
- [ ] Both actions added to `SUPPORTED_ACTIONS`
- [ ] `requirePhase1CMutationPermission` action union includes `gearCheckout.create` and `gearCheckout.update`

---

## Workflow Schema

- [ ] `gearCheckoutWorkflowSchema` added to `lib/workflows/index.ts`
- [ ] `GearCheckoutWorkflowInput` type exported
- [ ] `GearCheckoutStatus` imported in workflows module
- [ ] `checkedOutById`, `issuedById`, and `checkedOutAt` enforced server-side
- [ ] `status` field validates against `GearCheckoutStatus` enum
- [ ] Checkout/check-in dates validate `YYYY-MM-DDTHH:mm` format
- [ ] Date ordering prevents expected/returned timestamps earlier than checkout timestamp
- [ ] `RETURNED` status requires check-in metadata (`returnedAt`, `returnedById`, `receivedById`)
- [ ] Non-`RETURNED` statuses block check-in-only fields
- [ ] `conditionOnReturn` validates against `GearConditionStatus` enum when present

---

## Checkout Create Form (`/gear-ops/items/[itemId]/checkout`)

- [ ] Page renders when item exists and user has staff read access
- [ ] `resolveGearOpsReadAccess` is called and access denial is handled
- [ ] Form displays item and organization context
- [ ] Status dropdown shows all `GearCheckoutStatus` values
- [ ] Person selectors populate from organization people
- [ ] Event selector populates from organization events
- [ ] Form posts to `/gear-ops/items/[itemId]/checkout/create`
- [ ] Cancel link returns to item detail
- [ ] Form preserves values and field errors from validation redirects
- [ ] Not-found state shown for invalid item id with safe back link

---

## Checkout Create Route (`POST /gear-ops/items/[itemId]/checkout/create`)

- [ ] Requires `gearCheckout.create` permission via `requirePhase1CMutationPermission`
- [ ] Returns 303 redirect with error when database is not ready
- [ ] Returns 303 redirect with error when organization context is missing
- [ ] Returns 303 redirect with field errors when validation fails
- [ ] Verifies `gearItemId` belongs to authenticated organization
- [ ] Cross-org guards enforce organization membership for all referenced person ids
- [ ] Cross-org guard enforces organization membership for optional event id
- [ ] Creates `GearCheckout` with organization-scoped references
- [ ] Redirects to `/gear-ops/items/[itemId]` on success
- [ ] Permission denied and schema-unavailable errors return safe user-facing messages

---

## Checkout Edit/Check-in Form (`/gear-ops/items/[itemId]/checkouts/[checkoutId]/edit`)

- [ ] Page renders when item and checkout exist and user has staff read access
- [ ] `resolveGearOpsReadAccess` is called and access denial is handled
- [ ] Form pre-fills from existing checkout values
- [ ] Form preserves query param values/errors after failed updates
- [ ] Form posts to `/gear-ops/items/[itemId]/checkouts/[checkoutId]/edit/update`
- [ ] Cancel link returns to item detail
- [ ] Not-found state shown for invalid item id with safe back link
- [ ] Not-found state shown for invalid checkout id with safe back link to item

---

## Checkout Update Route (`POST /gear-ops/items/[itemId]/checkouts/[checkoutId]/edit/update`)

- [ ] Requires `gearCheckout.update` permission via `requirePhase1CMutationPermission`
- [ ] Returns 303 redirect with error when database is not ready
- [ ] Returns 303 redirect with error when organization context is missing
- [ ] Returns 303 redirect with field errors when validation fails
- [ ] Cross-org guards enforce organization membership for referenced person ids and event id
- [ ] Uses `updateMany` with `id + gearItemId + organizationId` filter to prevent cross-org writes
- [ ] Returns error redirect when no matching checkout row is updated
- [ ] Redirects to `/gear-ops/items/[itemId]` on success
- [ ] Permission denied and schema-unavailable errors return safe user-facing messages

---

## Item Detail Checkout Visibility

- [ ] Checkouts section includes a **Check out gear** entry link
- [ ] Checkout cards include **Edit** links for check-in/update flow
- [ ] Checkouts split into **Current open checkouts** and **Checkout history**
- [ ] Current/open section shows `OPEN` and `OVERDUE` records only
- [ ] History section shows non-open records
- [ ] Checkout cards show checked-out-to person plus event/team/program labels where derivable
- [ ] Safe empty state shown when no checkout records exist

---

## Preserved Behavior

- [ ] Arc 16C GearOps read-only catalog routes still render correctly
- [ ] Arc 16D category/item create/edit workflows still function
- [ ] Arc 16E assignment workflows still function
- [ ] Core and FieldOps routes remain unaffected
- [ ] Prisma schema remains unchanged

---

## Planning Documentation

- [ ] `planning/PHASE_16F_GEAROPS_CHECKOUT_CHECKIN_WORKFLOWS.md` created
- [ ] `planning/PHASE_16F_VALIDATION_CHECKLIST.md` created (this file)
- [ ] `planning/README.md` updated with Arc 16F planning docs

