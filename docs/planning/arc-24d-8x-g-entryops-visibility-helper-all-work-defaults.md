# Arc 24D.8X-G - EntryOps Visibility Helper And All Work Defaults

## What Changed

This slice adds a centralized EntryOps visibility/default-filter helper:

- `lib/entryops/visibility.ts`

The helper separates access capability from default view filtering for All Work Items.

It provides:

- `resolveEntryOpsVisibilityContext()`
  - resolves the current actor person
  - loads `RoleAssignment` rows
  - loads guardian-linked athlete ids when the actor is a guardian
- `resolveEntryOpsAllWorkDefaultVisibility()`
  - pure/testable default visibility decision
  - determines whether the All Work Items default is organization-wide, person-scoped, or program/team-scoped
- `buildEntryOpsAllWorkDefaultWhere()`
  - converts the default decision into a Prisma Entry `where` fragment

## What Was Applied Now

Only `/entries` (All Work Items) was changed.

All Work Items now applies the default visibility helper before optional UI filters:

- Org Admin with organization scope defaults to organization-wide work.
- Program Director/Program Manager with program/team scoped assignments defaults to those program/team scopes plus own work.
- Guardian defaults to own work plus linked dependent athletes.
- Athlete defaults to own work.
- Coach and Assistant Coach default to own work; team/athlete expansion remains explicit/future.
- Actors without a schema-backed limited role default to own work when they have a linked person id.

The All Work Items assignee filter list is also constrained for non-org-wide defaults so personal/family default views do not expose every active person in the organization.

## Role Assumptions

Current schema roles are `RoleType` values:

- `ORGANIZATION_ADMIN`
- `PROGRAM_DIRECTOR`
- `COACH`
- `ASSISTANT_COACH`
- `PARENT_GUARDIAN`
- `ATHLETE`

The UI role `PROGRAM_MANAGER` maps to Prisma `PROGRAM_DIRECTOR`.

There is no Prisma `LIMITED_VIEWER` role today. This slice treats linked actors without EntryOps-expanding role assignments as own-work-only for the helper foundation. Future implementation can tighten or replace that behavior if a schema-backed limited role is added.

## What Remains Deferred

Deferred to later slices:

- Inbox/List role-safe defaults.
- List detail access enforcement.
- Entry detail direct URL enforcement.
- Explicit coach team/athlete filter expansion.
- Guardian filter UI:
  - All Family
  - Just Me
  - individual dependent athlete
- Habit list filtering UI changes.
- Journal Library / journal response visibility changes.
- Today/Review/Feed behavior changes.
- Broad permission rewrite.

## Risks

- All Work Items now allows guardian/athlete/own-only actors to read their own scoped default view instead of relying on staff-only `resolveEntryAccess()`.
- Program Directors with only organization-scoped assignments do not receive a special organization-wide default from this helper unless they are Org Admin; this preserves the product decision that Program Manager defaults should be program/team-scoped where current relationships support it.
- Current explicit filter UI is still basic. A user can request an assignee outside their default scope, but the default visibility `where` remains applied, so it should return no rows outside scope.

## Validation

Performed validation:

- `npm run typecheck`
- `npm run build`
- `npx tsx --test tests/entryops/visibility.test.ts`

## Recommended Next Slice

24D.8X-H - Inbox And Lists Role-Safe Defaults

Goal:

- Align Inbox and Lists with the EntryList-as-Inbox model and role-safe default visibility.

Allowed files/modules:

- `lib/entries/lists.ts`
- Inbox/List pages and related helpers
- Targeted list/default Inbox visibility tests
- Planning note

Non-goals:

- No schema changes
- No route deletion
- No broad data migration
- No Today/Review redesign
- No Habit/Journal behavior changes

Validation:

- `npm run typecheck`
- `npm run build`
- targeted EntryList/Inbox visibility tests

Acceptance criteria:

- Inbox defaults to the actor-safe Inbox scope.
- Lists page does not expose program/team lists outside actor scope.
- List detail enforces the same list visibility as the list index.
- Legacy `InboxRoutingItem` behavior is either preserved behind safe filters or documented for later removal.
