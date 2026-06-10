# Arc 24D.8Q-D Guardian List Context And Active Habits Validation

## Scope

- Separate a Guardian's Personal lists from linked athlete Personal list groups.
- Use explicit Personal, athlete, Admin, Program, Team, and Unlisted context labels.
- Allow Entry movement only to the actor's authorized organizational contexts.
- Include active Habit definitions as read-only Entry-like rows in All Entries.
- Keep Habit check-ins/activity, Today behavior, Entry visibility, and Entry assignment semantics unchanged.

## Validation

- Focused Entry list and All Entries regression tests: passed, 26/26.
- `npm run typecheck`: passed.
- `npm run build`: passed with the known Next.js middleware convention warning.
- `npm test`: ran 1,148 tests; 1,147 passed and one unrelated existing GearOps CSV header expectation failed because runtime output includes `asset_id`.
- `npx tsx --test tests/gear-bulk-ops/csv.test.ts`: independently reproduced the same unrelated GearOps failure.
