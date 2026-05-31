/**
 * Arc 23D / Arc 24D.8 — Habit Model, Recurrence, and Completion Tracking
 *
 * Pure display/computation helpers for the Habit domain.
 * No DB dependencies — fully testable.
 */

import { HabitFrequency, HabitStatus, HabitTrackingMode } from "@prisma/client";

export const MAX_HABIT_TITLE_LENGTH = 160;
export const MAX_HABIT_DESCRIPTION_LENGTH = 1000;
export const MAX_CHECKIN_NOTE_LENGTH = 500;

// ── Label helpers ─────────────────────────────────────────────────────────────

export function labelForHabitStatus(status: HabitStatus): string {
  if (status === HabitStatus.ACTIVE) return "Active";
  if (status === HabitStatus.PAUSED) return "Paused";
  if (status === HabitStatus.COMPLETED) return "Completed";
  return "Archived";
}

export function labelForHabitFrequency(frequency: HabitFrequency): string {
  if (frequency === HabitFrequency.DAILY) return "Daily";
  if (frequency === HabitFrequency.WEEKLY) return "Weekly";
  return "Custom";
}

// Arc 24D.8: Tracking mode labels
export function labelForHabitTrackingMode(mode: HabitTrackingMode): string {
  if (mode === HabitTrackingMode.CHECKOFF) return "Check-off";
  if (mode === HabitTrackingMode.COUNT) return "Count";
  return "Notes";
}

export function badgeVariantForHabitStatus(
  status: HabitStatus,
): "active" | "paused" | "completed" | "archived" {
  if (status === HabitStatus.ACTIVE) return "active";
  if (status === HabitStatus.PAUSED) return "paused";
  if (status === HabitStatus.COMPLETED) return "completed";
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

export function parseHabitCountValue(raw: string | null | undefined): number | null {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  if (!/^\d+$/.test(value)) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
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

// ── Actionable today helpers ──────────────────────────────────────────────────

/**
 * Arc 24D.8: Returns true if the habit has an actionable occurrence today.
 *
 * Rules:
 * - Habit must be ACTIVE.
 * - If no schedule, assume daily (always actionable when active).
 * - DAILY: always actionable on any day at or after startDate.
 * - WEEKLY: actionable if today's weekday abbreviation is in daysOfWeek, or if
 *   daysOfWeek is empty/absent (any day of week).
 * - CUSTOM: always actionable when active.
 * - endDate: if set and today is past endDate, not actionable.
 */
export function isHabitActionableToday(input: {
  status: HabitStatus;
  scheduleFrequency: HabitFrequency | null;
  scheduleDaysOfWeek: string | null; // comma or space-separated, e.g. "MON,WED,FRI"
  scheduleStartDate: Date | null;
  scheduleEndDate: Date | null;
  todayDate: Date;
}): boolean {
  if (input.status !== HabitStatus.ACTIVE) return false;

  const today = normalizeCompletedOn(input.todayDate);

  // startDate boundary
  if (input.scheduleStartDate) {
    const start = normalizeCompletedOn(input.scheduleStartDate);
    if (today.getTime() < start.getTime()) return false;
  }

  // endDate boundary
  if (input.scheduleEndDate) {
    const end = normalizeCompletedOn(input.scheduleEndDate);
    if (today.getTime() > end.getTime()) return false;
  }

  if (!input.scheduleFrequency || input.scheduleFrequency === HabitFrequency.DAILY || input.scheduleFrequency === HabitFrequency.CUSTOM) {
    return true;
  }

  if (input.scheduleFrequency === HabitFrequency.WEEKLY) {
    if (!input.scheduleDaysOfWeek) return true; // no day restriction → any day
    const dayAbbrevs = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const todayAbbrev = dayAbbrevs[today.getUTCDay()];
    const scheduledDays = input.scheduleDaysOfWeek
      .toUpperCase()
      .split(/[,\s]+/)
      .map((d) => d.trim())
      .filter(Boolean);
    return scheduledDays.includes(todayAbbrev);
  }

  return true;
}

// ── Safe activity text ─────────────────────────────────────────────────────────

/**
 * Arc 24D.8: Returns human-readable activity text for the feed.
 * Accepts an optional habit title for richer messages.
 * Habit titles are considered safe to surface in the activity feed.
 */
export function deriveSafeHabitActivityText(action: string, habitTitle?: string): string {
  const title = habitTitle ? `: ${habitTitle}` : "";
  if (action === "habit.created") return `Habit created${title}`;
  if (action === "habit.updated") return `Habit updated${title}`;
  if (action === "habit.assigned") return `Habit assigned${title}`;
  if (action === "habit.archived") return `Habit archived${title}`;
  if (action === "habit.restored") return `Habit restored${title}`;
  if (action === "habit.paused") return `Habit paused${title}`;
  if (action === "habit.resumed") return `Habit resumed${title}`;
  if (action === "habit.completed") return `Habit completed${title}`;
  if (action === "habit.checked_in") return `Habit occurrence completed${title}`;
  return "Habit event";
}

// ── Normalise tracking mode input ─────────────────────────────────────────────

export function normalizeTrackingMode(raw: string): HabitTrackingMode {
  if (raw === "COUNT") return HabitTrackingMode.COUNT;
  if (raw === "NOTES") return HabitTrackingMode.NOTES;
  return HabitTrackingMode.CHECKOFF;
}
