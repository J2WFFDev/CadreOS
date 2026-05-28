/**
 * Arc 23D — Habit Model, Recurrence, and Completion Tracking
 *
 * Pure display/computation helpers for the Habit domain.
 * No DB dependencies — fully testable.
 */

import { HabitFrequency, HabitStatus } from "@prisma/client";

export const MAX_HABIT_TITLE_LENGTH = 160;
export const MAX_HABIT_DESCRIPTION_LENGTH = 1000;
export const MAX_CHECKIN_NOTE_LENGTH = 500;

// ── Label helpers ─────────────────────────────────────────────────────────────

export function labelForHabitStatus(status: HabitStatus): string {
  if (status === HabitStatus.ACTIVE) return "Active";
  if (status === HabitStatus.PAUSED) return "Paused";
  return "Archived";
}

export function labelForHabitFrequency(frequency: HabitFrequency): string {
  if (frequency === HabitFrequency.DAILY) return "Daily";
  if (frequency === HabitFrequency.WEEKLY) return "Weekly";
  return "Custom";
}

export function badgeVariantForHabitStatus(status: HabitStatus): "active" | "paused" | "archived" {
  if (status === HabitStatus.ACTIVE) return "active";
  if (status === HabitStatus.PAUSED) return "paused";
  return "archived";
}

// ── Streak and completion count helpers ───────────────────────────────────────

/**
 * Normalize a date to start-of-day UTC for consistent deduplication.
 * Stored dates use this normalization so completedOn comparisons are exact.
 */
export function normalizeCompletedOn(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Given a sorted-ascending list of completedOn dates and a frequency,
 * compute the current streak (consecutive periods from today backwards).
 *
 * For DAILY: consecutive days ending today or yesterday.
 * For WEEKLY: consecutive calendar weeks ending this week or last week.
 * For CUSTOM: total distinct completion count (streaks are not meaningful).
 */
export function computeCurrentStreak(
  completedDates: Date[],
  frequency: HabitFrequency,
): number {
  if (completedDates.length === 0) return 0;

  if (frequency === HabitFrequency.CUSTOM) {
    return completedDates.length;
  }

  // Work with normalized day-start UTC timestamps
  const days = completedDates.map((d) => normalizeCompletedOn(d).getTime());
  const uniqueDays = Array.from(new Set(days)).sort((a, b) => b - a); // descending

  const today = normalizeCompletedOn(new Date()).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const oneWeekMs = 7 * oneDayMs;

  if (frequency === HabitFrequency.DAILY) {
    // The most recent completion must be today or yesterday to have an active streak
    if (uniqueDays[0] < today - oneDayMs) return 0;
    let streak = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      const diff = uniqueDays[i - 1] - uniqueDays[i];
      if (diff === oneDayMs) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  if (frequency === HabitFrequency.WEEKLY) {
    // Map each date to its ISO week start (Monday UTC)
    const getWeekStart = (ts: number): number => {
      const d = new Date(ts);
      const dow = d.getUTCDay(); // 0=Sun, 1=Mon...
      const diff = (dow === 0 ? 6 : dow - 1); // days since Monday
      return ts - diff * oneDayMs;
    };

    const weekStarts = Array.from(new Set(uniqueDays.map(getWeekStart))).sort((a, b) => b - a);
    const thisWeekStart = getWeekStart(today);

    // The most recent week with a completion must be this week or last week
    if (weekStarts[0] < thisWeekStart - oneWeekMs) return 0;

    let streak = 1;
    for (let i = 1; i < weekStarts.length; i++) {
      const diff = weekStarts[i - 1] - weekStarts[i];
      if (diff === oneWeekMs) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  return 0;
}

/**
 * Return the count of distinct completion dates for a habit.
 * This is a simple aggregation used in summary displays.
 */
export function computeCompletionCount(completedDates: Date[]): number {
  const unique = new Set(completedDates.map((d) => normalizeCompletedOn(d).getTime()));
  return unique.size;
}

// ── Safe activity text (no private content) ───────────────────────────────────

export function deriveSafeHabitActivityText(action: string): string {
  if (action === "habit.created") return "Habit created";
  if (action === "habit.updated") return "Habit updated";
  if (action === "habit.assigned") return "Habit assigned";
  if (action === "habit.archived") return "Habit archived";
  if (action === "habit.paused") return "Habit paused";
  if (action === "habit.resumed") return "Habit resumed";
  if (action === "habit.checked_in") return "Habit check-in recorded";
  return "Habit event";
}
