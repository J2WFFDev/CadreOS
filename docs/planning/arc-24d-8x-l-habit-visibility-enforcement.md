# Arc 24D.8X-L — Enforce Habit Visibility Rules

## Summary

This slice audits Habit visibility after real Task-to-Habit conversion and tightens the Habit read policy so ownership follows the person consistently.

The Habit module already had a dedicated access helper and most pages/actions routed through it. The gap found in this audit was that creators could edit/archive lifecycle state but were not always guaranteed read/list/detail visibility unless they were also the assigned athlete, an admin, a scoped coach, or a linked guardian.

## Current State

Habit records use these ownership and scope fields:

- `createdByPersonId`
- `athletePersonId`
- `assignedToTeamId`
- assigned team program scope through `assignedToTeam.programId`

Habit pages/actions use `resolveHabitAccessContext`, which loads role assignments and guardian-dependent athlete links for the current person. Dev persona support flows through the same current-user/person resolution used by organization scope.

## Enforcement Changes

Updated `canReadHabit` so the creator can read their own Habit even if their active persona changes or the Habit is assigned to another athlete/person context.

This preserves:

- creator/owner visibility
- athlete self visibility
- guardian dependent read visibility
- org admin/program director elevated read visibility
- scoped coach/team/program read visibility where currently supported

This does not broaden mutation permissions. Habit actions continue to use their existing action-specific helpers such as `canCheckInHabit`, `canArchiveHabit`, `canPauseHabit`, `canCompleteHabit`, and `canRestoreHabit`.

## Routes Audited

- `/habits`
- `/habits/[habitId]`
- `/habits/create`
- `/habits/create/save`
- `/habits/[habitId]/edit`
- `/habits/[habitId]/edit/update`
- `/habits/[habitId]/check-in`
- `/habits/[habitId]/complete`
- `/habits/[habitId]/pause`
- `/habits/[habitId]/archive`
- `/habits/[habitId]/restore`

## Routes Changed

No route file changes were required.

The shared Habit access helper changed:

- `lib/habits/access.ts`

The list and detail pages already filter through `canReadHabit`. Action routes already load the Habit and check the relevant action-specific policy helper before mutating.

## Tests

Added targeted access-policy coverage for:

- creator read visibility when active persona is not the athlete
- unrelated athlete blocked from another creator's Habit
- unrelated guardian blocked from unrelated athlete Habit
- unrelated guardian blocked from Habit mutation actions

## Deferred Items

- Habit DB queries still fetch candidate rows and filter through the policy helper in application code. A future performance slice could add a Prisma `where` builder for Habit visibility.
- Guardian access remains summary/read-only. Guardian check-in or dependent assignment workflows remain deferred.
- Non-Habit route trees that point at Habits through operational relationships remain governed by their existing relationship/domain helpers.

## Validation

- `npm run typecheck`
- `npm run build`
- Targeted habit visibility tests:
  - `npx tsx --test tests/habits/access-policy.test.ts`

## Recommended Next Slice

24D.8X-M — Audit Journal and Task direct-route visibility.

Goal: apply the same direct-route audit pattern to Journal and legacy Task surfaces now that Entry and Habit visibility have been tightened.
