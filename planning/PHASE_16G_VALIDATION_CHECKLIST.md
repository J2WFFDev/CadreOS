# Phase 16G Validation Checklist: GearOps Maintenance and Condition Logging Workflows

## Build Validation

- [ ] `npm run lint` — no new lint errors
- [ ] `npm run typecheck` — no new TypeScript errors
- [ ] `npm run build` — build succeeds without errors
- [ ] `DATABASE_URL=... ./node_modules/.bin/prisma validate` — schema validation passes (schema unchanged)

---

## Permissions and Authorization

- [ ] `gearMaintenance.create` added to `SupportedAction` union in `lib/permissions/index.ts`
- [ ] `gearMaintenance.update` added to `SupportedAction` union in `lib/permissions/index.ts`
- [ ] Both actions added to `ORGANIZATION_ADMIN` role set
- [ ] Both actions added to `PROGRAM_DIRECTOR` role set
- [ ] Both actions added to `COACH` role set
- [ ] Neither action added to `ASSISTANT_COACH`, `PARENT_GUARDIAN`, or `ATHLETE` role sets
- [ ] Neither action added to `SCOPED_ACTIONS` (org-scoped only)
- [ ] Both actions added to `SUPPORTED_ACTIONS`
- [ ] `requirePhase1CMutationPermission` action union includes `gearMaintenance.create` and `gearMaintenance.update`

---

## Workflow Schema

- [ ] `gearMaintenanceWorkflowSchema` added to `lib/workflows/index.ts`
- [ ] `GearMaintenanceWorkflowInput` type exported
- [ ] `GearMaintenanceType` imported in workflows module
- [ ] `maintenanceType` validates against `GearMaintenanceType` enum
- [ ] `performedByPersonId` enforced server-side
- [ ] `performedAt` required and validates `YYYY-MM-DDTHH:mm` format
- [ ] `conditionBefore` validates against `GearConditionStatus` enum when provided
- [ ] `conditionAfter` validates against `GearConditionStatus` enum when provided
- [ ] `notes` required and max 4000 characters

---

## Maintenance Create Form (`/gear-ops/items/[itemId]/maintenance/new`)

- [ ] Page renders when item exists and user has staff read access
- [ ] `resolveGearOpsReadAccess` is called and access denial is handled
- [ ] Form displays item and organization context
- [ ] Form includes maintenance type, performed-by, service date/time, condition before/after, and notes
- [ ] Form posts to `/gear-ops/items/[itemId]/maintenance/create`
- [ ] Cancel link returns to item detail
- [ ] Form preserves values and field errors from validation redirects
- [ ] Not-found state shown for invalid item id with safe back link

---

## Maintenance Create Route (`POST /gear-ops/items/[itemId]/maintenance/create`)

- [ ] Requires `gearMaintenance.create` permission via `requirePhase1CMutationPermission`
- [ ] Returns 303 redirect with error when database is not ready
- [ ] Returns 303 redirect with error when organization context is missing
- [ ] Returns 303 redirect with field errors when validation fails
- [ ] Verifies `gearItemId` belongs to authenticated organization
- [ ] Cross-org guard enforces organization membership for `performedByPersonId`
- [ ] Creates `GearMaintenanceLog` with organization-scoped references
- [ ] Redirects to `/gear-ops/items/[itemId]` on success
- [ ] Permission denied and schema-unavailable errors return safe user-facing messages

---

## Maintenance Edit Form (`/gear-ops/items/[itemId]/maintenance/[maintenanceLogId]/edit`)

- [ ] Page renders when item and maintenance log exist and user has staff read access
- [ ] `resolveGearOpsReadAccess` is called and access denial is handled
- [ ] Form pre-fills from existing maintenance values
- [ ] Form preserves query param values/errors after failed updates
- [ ] Form posts to `/gear-ops/items/[itemId]/maintenance/[maintenanceLogId]/edit/update`
- [ ] Cancel link returns to item detail
- [ ] Not-found state shown for invalid item id with safe back link
- [ ] Not-found state shown for invalid maintenance id with safe back link to item

---

## Maintenance Update Route (`POST /gear-ops/items/[itemId]/maintenance/[maintenanceLogId]/edit/update`)

- [ ] Requires `gearMaintenance.update` permission via `requirePhase1CMutationPermission`
- [ ] Returns 303 redirect with error when database is not ready
- [ ] Returns 303 redirect with error when organization context is missing
- [ ] Returns 303 redirect with field errors when validation fails
- [ ] Cross-org guard enforces organization membership for `performedByPersonId`
- [ ] Uses `updateMany` with `id + gearItemId + organizationId` filter to prevent cross-org writes
- [ ] Returns error redirect when no matching maintenance row is updated
- [ ] Redirects to `/gear-ops/items/[itemId]` on success
- [ ] Permission denied and schema-unavailable errors return safe user-facing messages

---

## Item Detail Maintenance Visibility

- [ ] Maintenance section shows **New maintenance log** entry link
- [ ] Maintenance cards include **Edit** links
- [ ] Maintenance display is split into **Recent logs** and **Maintenance history**
- [ ] Cards show maintenance type, service date/time, condition before/after, notes, and actor context
- [ ] Cards show log created/recorded context where available
- [ ] Safe empty state shown when no maintenance logs exist

---

## Preserved Behavior

- [ ] Arc 16C GearOps read-only catalog routes still render correctly
- [ ] Arc 16D category/item create/edit workflows still function
- [ ] Arc 16E assignment workflows still function
- [ ] Arc 16F checkout/check-in workflows still function
- [ ] Core and FieldOps routes remain unaffected
- [ ] Prisma schema remains unchanged

---

## Planning Documentation

- [ ] `planning/PHASE_16G_GEAROPS_MAINTENANCE_CONDITION_LOGS.md` created
- [ ] `planning/PHASE_16G_VALIDATION_CHECKLIST.md` created (this file)
- [ ] `planning/README.md` updated with Arc 16G planning docs

