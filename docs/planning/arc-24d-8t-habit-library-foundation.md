# Arc 24D.8T - Habit Library Foundation

## Root Model Audit

- Habit definitions are separate `Habit` records, not Entries.
- Habit schedules are separate `HabitSchedule` records.
- Habit check-ins are dated `HabitCompletion` records. A successful check-in
  also writes `HabitActivity` and updates `Habit.lastCompletedAt`.
- Check-ins do not create Tasks, Entries, or separate All Entries rows.
- Habit lifecycle uses `ACTIVE`, `PAUSED`, `COMPLETED`, and `ARCHIVED`.
  Archive preserves the Habit record, schedules, metadata, completions, and
  activity. Restore returns archived/completed Habits to `ACTIVE`.
- Active Habit definitions appear in All Entries by default. Archived Habit
  definitions appear through the explicit archived status filter.
- Habit access is governed by `lib/habits/access.ts`: admins/directors have
  broad management access; creators manage their records; the tracked Athlete
  and admins/directors may check in; linked Guardians receive summary-only
  read access and cannot mutate.
- Habit definitions do not currently have Entry Context/List or explicit
  visibility fields. `assignedToTeamId` is an existing assignment field, not a
  Program/Team Context/List field and not a fan-out mechanism.

## Delivered Foundation

- Habit sidebar route opens the Habit Library.
- Active Habits are the default library view; archived Habits have an explicit
  filter.
- Direct Create Habit flow persists a Habit without creating a Task or Entry.
- Library rows show title, cadence, status, last check-in, check-in count,
  Context/List model availability, and visibility-policy summary.
- Detail shows Created by, lifecycle, cadence, last check-in, Context/List
  availability, visibility-policy summary, check-in history, and recorded-by
  metadata where completion detail is authorized.
- All Entries includes active Habit definitions by default and archived Habit
  definitions under the archived filter. Habit check-ins remain excluded.

## Deferred

- Program/Team Context/List modeling for Habits.
- Team recurring Habit assignment and fan-out.
- Compliance dashboards.
- Advanced streak analytics.
- Today redesign or generated Habit occurrence Entries.

## Manual Validation Checklist

- [ ] HAB-001: EntryOps sidebar Habits opens Habit Library.
- [ ] HAB-002: Habit Library shows active Habits by default.
- [ ] HAB-003: Habit Library has Create habit action.
- [ ] HAB-004: Create a Habit directly.
- [ ] HAB-005: New Habit appears in Habit Library.
- [ ] HAB-006: New Habit appears in All Entries with Type Habit.
- [ ] HAB-007: Type filter Habit finds Habit definitions.
- [ ] HAB-008: Habit detail opens.
- [ ] HAB-009: Habit detail shows Created by metadata.
- [ ] HAB-010: Habit detail explains Context/List model availability.
- [ ] HAB-011: Habit detail explains visibility policy.
- [ ] HAB-012: Check-in action appears for an authorized active Habit.
- [ ] HAB-013: Check-in records completion/activity history.
- [ ] HAB-014: Check-in updates Last check-in.
- [ ] HAB-015: Check-in does not create a Task.
- [ ] HAB-016: Check-in does not create a separate All Entries row.
- [ ] HAB-017: Archive removes Habit from Habit Library default.
- [ ] HAB-018: Archive removes Habit from All Entries default.
- [ ] HAB-019: Archived Habit does not allow check-in.
- [ ] HAB-020: Restore returns Habit to Habit Library default.
- [ ] HAB-021: Restore returns Habit to All Entries default.
- [ ] HAB-022: Guardian does not see an unrelated Habit.
- [ ] HAB-023: No Program/Team Context/List or team fan-out is implied.
- [ ] HAB-024: No Dev Persona behavior is present.
