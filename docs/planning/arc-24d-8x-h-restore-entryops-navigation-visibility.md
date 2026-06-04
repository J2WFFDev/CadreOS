# Arc 24D.8X-H - Restore EntryOps Navigation Visibility

## What Navigation Was Restored

This slice restores visible EntryOps navigation for personas that can see the EntryOps group.

The simplified EntryOps navigation remains:

- Inbox
- Lists
- All Work Items
- Habits
- Journal Library

The item-level staff-only role gates were removed from:

- `ENTRY_INBOX`
- `ENTRY_LISTS`
- `ENTRY_ALL`
- `ENTRY_PROMPTS`

`ENTRY_HABITS` was already visible through the EntryOps group policy.

The EntryOps group itself remains unavailable to `LIMITED_VIEWER` because no supported EntryOps UX path has been approved for that role yet.

## What Remains Protected By Filtering And Query Rules

Navigation visibility is not the privacy/security boundary.

Record-level protections remain in server-side logic, including:

- All Work Items default filtering through `lib/entryops/visibility.ts`.
- Habit access through `lib/habits/access.ts`.
- Journal response/detail access through `lib/journals/access.ts`.
- Journal prompt library access through `lib/journals/prompt-access.ts`.
- Route-level and action-level permission checks where already present.

This PR does not change Entry queries, Habit queries, Journal queries, Inbox behavior, List behavior, or the All Work Items visibility helper.

## Why Menu Hiding Is Not The Security Model

Hiding menu items can make useful UX paths disappear for personas such as Athlete and Guardian, but it does not protect direct routes.

The corrected model is:

- Navigation exposes supported UX entry points.
- Server-side queries decide which records are visible.
- Direct-route access checks prevent record leakage.
- Future filters should make the scoped view understandable to the user.

## What Remains Deferred

Deferred to later slices:

- Inbox/List role-safe defaults and list detail enforcement.
- Entry detail direct-route access enforcement.
- Guardian filter UI:
  - All Family
  - Just Me
  - individual dependent athlete
- Explicit coach team/athlete filter expansion.
- Journal Library UX policy for guardian/athlete if route-level prompt access remains narrower than navigation visibility.

## Validation

Performed validation:

- `npm run typecheck`
- `npm run build`
- targeted navigation tests:
  - `tests/entry-ops-navigation/nav-workflow-views.test.ts`
  - `tests/navigation/nav-sidebar.test.ts`

## Recommended Next Slice

24D.8X-I - Entry Detail Direct-Route Access Enforcement

Goal:

- Enforce Entry detail access using the same record-level visibility direction established for All Work Items.

Allowed files/modules:

- EntryOps visibility helper
- Entry detail page/access helper
- targeted Entry detail visibility tests
- planning note

Non-goals:

- No schema changes
- No navigation changes
- No broad permission rewrite
- No Habit/Journal behavior rewrite

Validation:

- `npm run typecheck`
- `npm run build`
- targeted Entry detail visibility tests

Acceptance criteria:

- Direct `/entries/[entryId]` access cannot reveal unrelated records.
- Org Admin retains broad detail access.
- Guardian/athlete/coach defaults align with record-level visibility rules.
- Journal and Habit details remain governed by their existing domain-specific access helpers.
