# Arc 24D.8B Habit Schedule and Check-In Semantics

Date: 2026-06-03

Branch: arc-24d-8b-stabilize-habit-schedule-checkin

## Summary

Arc 24D.8B stabilizes the existing Habit foundation without adding a recurrence engine or recurring task runtime integration. The work keeps Habit as the source of truth for current habit check-ins and lifecycle state.

## What Changed

- Added shared Habit policy helpers for:
  - normalizing weekly cadence days into canonical comma-separated weekday abbreviations
  - rendering weekly cadence days in user-friendly labels
  - rendering cadence labels consistently across Habit list, detail, and Today views
  - describing Habit lifecycle states in terms of check-in availability
- Normalized weekly cadence day input in Habit create and edit actions before persistence.
- Updated create/edit copy from recurrence wording to cadence wording.
- Clarified tracking mode labels as one check-in per day for checkoff, count, and notes modes.
- Surfaced duplicate same-day check-ins on the Habit detail page.
- Added an invalid check-in date guard before attempting to create a HabitCompletion.
- Added targeted Habit policy/create tests for cadence day normalization, cadence labels, lifecycle descriptions, and create payload normalization.

## Confirmed Behavior

- Habit check-ins are idempotent by date at the database level through the existing unique `(habitId, completedOn)` constraint.
- Duplicate same-day check-ins now redirect back to the Habit detail page with a visible message instead of feeling like a silent no-op.
- Check-ins are stored as `HabitCompletion` records and do not create Entry, Task, EntryRuntimeRef, notification, reminder, or recurring task records.
- Paused, completed, and archived habits do not accept check-ins through the existing `canCheckInHabit` policy.
- Completing a habit marks the Habit lifecycle as finished. It is separate from recording a scheduled check-in occurrence.
- Restoring an archived or completed habit returns it to `ACTIVE` and clears the archived/completed timestamp fields already handled by the existing route.
- No schema, route structure, auth/role policy, package, or dependency changes were made.

## Deferred To 24D.8C

- Deciding whether Habit check-ins should remain separate from EntryOps runtime records or create EntryRuntimeRef-backed work objects.
- Designing any recurring task instance generation.
- Adding notifications or reminders for habit cadence.
- Adding timezone-aware local-day scheduling and check-in dedupe.
- Deciding whether multiple HabitSchedule records should become schedule history or active schedule versions.
- Deciding whether Notes tracking should require a note, or remain an optional note-based check-in.
- Deciding whether `interval` should be exposed in UI or remain a placeholder.

## Risks And Follow-Up Test Cases

- Weekly cadence currently stores normalized comma-separated weekday abbreviations. Existing data using another format may need a later data normalization plan before richer recurrence logic.
- Today view labels do not show weekly day detail yet because the current actionable habit feed item exposes only frequency.
- UTC-normalized check-in dates may not match athlete-local day expectations in every timezone.
- Route handler integration tests would be useful for duplicate check-ins, invalid dates, lifecycle transitions, and status-specific action visibility.
- Browser-level tests would be useful for create/edit/detail copy and Today quick check-in behavior.
