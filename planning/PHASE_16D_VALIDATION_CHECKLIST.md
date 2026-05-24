# Phase 16D Validation Checklist

## GearCategory Create Workflow

- [ ] GET `/gear-ops/categories/new` renders form with name, inventoryType, description fields
- [ ] Submitting empty name shows "Category name is required." field error
- [ ] Submitting an invalid inventoryType value is rejected
- [ ] Submitting name > 100 characters shows length error
- [ ] Submitting description > 1000 characters shows length error
- [ ] Successful create redirects to `/gear-ops/categories/[new id]`
- [ ] New category appears on the categories list page
- [ ] Cancel link returns to `/gear-ops/categories`
- [ ] Non-staff user (PARENT_GUARDIAN/ATHLETE) sees access denial message, not the form
- [ ] COACH role receives "This action is not enabled in the current MVP authorization policy" after form submit (gearCategory.create is not available to COACH)

## GearCategory Edit Workflow

- [ ] GET `/gear-ops/categories/[id]/edit` pre-fills current name, inventoryType, description
- [ ] Accessing edit for a categoryId from a different organization returns not-found state
- [ ] Invalid categoryId (random string) returns not-found state with back link
- [ ] Submitting empty name shows field error and preserves other form values
- [ ] Successful update redirects to `/gear-ops/categories/[id]`
- [ ] Detail page shows updated values after redirect
- [ ] Cancel link returns to `/gear-ops/categories/[id]`

## GearItem Create Workflow

- [ ] GET `/gear-ops/items/new` renders form with all item fields
- [ ] If no categories exist, shows EmptyState with link to `/gear-ops/categories/new`
- [ ] Category dropdown lists only org-scoped categories
- [ ] Program dropdown lists only org-scoped programs
- [ ] Submitting without a category selection shows "Category selection is required."
- [ ] Submitting empty name shows "Item name is required."
- [ ] Submitting invalid lifecycleStatus is rejected
- [ ] Submitting invalid conditionStatus value is rejected
- [ ] Submitting quantityOnHand as a negative number shows error
- [ ] Submitting quantityOnHand as a decimal (e.g. 1.5) shows error
- [ ] Submitting quantityMin as a negative number shows error
- [ ] Submitting a cross-org gearCategoryId (crafted via form) shows "category does not exist in this organization"
- [ ] Submitting a cross-org programId (crafted via form) shows "program does not exist in this organization"
- [ ] Successful create redirects to `/gear-ops/items/[new id]`
- [ ] New item appears on the items list page
- [ ] Cancel link returns to `/gear-ops/items`
- [ ] Non-staff user sees access denial, not the form

## GearItem Edit Workflow

- [ ] GET `/gear-ops/items/[id]/edit` pre-fills all current field values
- [ ] Accessing edit for an itemId from a different organization returns not-found state
- [ ] Invalid itemId returns not-found state with back link
- [ ] Submitting empty name shows field error and preserves other values
- [ ] Changing category to one from a different org (crafted) is rejected
- [ ] Successful update redirects to `/gear-ops/items/[id]`
- [ ] Detail page shows updated values after redirect
- [ ] Cancel link returns to `/gear-ops/items/[id]`

## Entry Points

- [ ] Categories list page shows "New category" button for staff users
- [ ] Category detail page shows "Edit" link in header
- [ ] Items list page shows "New item" button for staff users
- [ ] Item detail page shows "Edit" link in header
- [ ] Edit links on detail pages navigate to correct edit form

## Authorization Boundary

- [ ] ORGANIZATION_ADMIN can create and edit categories and items
- [ ] PROGRAM_DIRECTOR can create and edit categories and items
- [ ] COACH can create and edit items but NOT categories
- [ ] ASSISTANT_COACH cannot create or edit categories or items
- [ ] PARENT_GUARDIAN cannot access new/edit pages (read access denied)
- [ ] ATHLETE cannot access new/edit pages (read access denied)

## Constraint Verification

- [ ] No assignment workflow routes exist in `/gear-ops/`
- [ ] No checkout/check-in workflow routes exist in `/gear-ops/`
- [ ] No maintenance write routes exist in `/gear-ops/`
- [ ] No consumable transaction write routes exist in `/gear-ops/`
- [ ] Prisma schema is unchanged from Arc 16B
- [ ] All Arc 16C read-only routes remain accessible and unmodified

## Build and Validation

- [ ] `npm run lint` — passes with no errors
- [ ] `npm run typecheck` — passes with no errors
- [ ] `npm run build` — all 13 GearOps routes compile successfully
- [ ] `DATABASE_URL=... ./node_modules/.bin/prisma validate` — schema is valid
