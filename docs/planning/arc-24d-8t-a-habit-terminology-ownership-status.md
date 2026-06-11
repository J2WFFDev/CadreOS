# Arc 24D.8T-A - Habit Terminology, Ownership, Editability, and Status Cleanup

## Decisions

- **My Habits** is the current page for Habits the actor created or that were
  assigned to them.
- **Habit Library** is reserved for a future predefined organized
  catalog/template surface. This arc does not implement that catalog.
- Athlete self-service Habit creation is self-only and cannot set a team
  assignment. The server enforces the same rule as the UI.
- Existing staff assignment behavior remains available without implementing
  team fan-out or a recurring assignment workflow.
- Authorized creators and admins retain existing editability. Athletes may
  check in assigned Habits but do not gain edit rights to staff-created Habits.
- Normal user-facing lifecycle is Active, Paused, and Archived. The existing
  `COMPLETED` enum and route remain for legacy/internal compatibility but are
  not exposed as a normal action.
- Target met, cadence end date, streaks, total check-ins, and last check-in are
  progress/schedule signals, not lifecycle statuses.
- Tracking units use controlled choices. Unknown legacy values are preserved
  until an authorized editor selects a controlled replacement.
- Cadence frequency and weekly days use controlled selections.
- Habit Context/List remains future work. Team assignment is not Context/List,
  and Program/Team placement must not imply visibility, assignment, or fan-out.

## Preserved Boundaries

- Habit check-ins remain `HabitCompletion` and `HabitActivity` history only.
- Active and archived Habit behavior in All Entries is unchanged.
- Guardian summary-only access is unchanged.
- Journal and generic Entry lifecycle behavior are unchanged.
- No schema, dependency, team fan-out, or predefined catalog changes.

## Manual Validation Checklist

- [ ] HAB-A-001: Sidebar Habits opens page titled My Habits.
- [ ] HAB-A-002: Current page copy does not call itself Habit Library.
- [ ] HAB-A-003: Active empty state offers creating a Habit for yourself.
- [ ] HAB-A-004: Athlete creates a Habit for self.
- [ ] HAB-A-005: Athlete cannot select another member or team.
- [ ] HAB-A-006: Server rejects Athlete cross-person/team assignment.
- [ ] HAB-A-007: Coach/Admin retains existing assignment capability.
- [ ] HAB-A-008: Athlete-created Habit detail opens.
- [ ] HAB-A-009: Authorized creator can edit supported fields.
- [ ] HAB-A-010: Unauthorized actor cannot edit.
- [ ] HAB-A-011: Normal lifecycle choices are Active, Paused, Archived.
- [ ] HAB-A-012: Completed is not shown as a normal lifecycle action.
- [ ] HAB-A-013: Progress/schedule signals do not change lifecycle.
- [ ] HAB-A-014: Tracking unit uses a controlled selection.
- [ ] HAB-A-015: Existing legacy unit values are preserved without allowing new
  free-text units.
- [ ] HAB-A-016: Check-in remains activity/history only.
- [ ] HAB-A-017: Check-in does not create a Task.
- [ ] HAB-A-018: Check-in does not create a separate All Entries row.
- [ ] HAB-A-019: Active Habit remains in All Entries.
- [ ] HAB-A-020: Archived Habit remains explicit-filter only.
- [ ] HAB-A-021: Guardian summary-only behavior is unchanged.
- [ ] HAB-A-022: Docs distinguish My Habits from future Habit Library.
- [ ] HAB-A-023: Docs record Habit Context/List as future work.
- [ ] HAB-A-024: No team fan-out was added.
