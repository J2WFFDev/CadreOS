import { strict as assert } from "node:assert";
import test from "node:test";

import { HabitFrequency, HabitStatus } from "@prisma/client";

import {
  badgeVariantForHabitStatus,
  computeCompletionCount,
  computeCurrentStreak,
  deriveSafeHabitActivityText,
  isHabitActionableToday,
  labelForHabitFrequency,
  labelForHabitStatus,
  labelForHabitTrackingMode,
  MAX_CHECKIN_NOTE_LENGTH,
  MAX_HABIT_DESCRIPTION_LENGTH,
  MAX_HABIT_TITLE_LENGTH,
  normalizeCompletedOn,
  normalizeTrackingMode,
} from "../../lib/habits/policy";

// ── Constants ────────────────────────────────────────────────────────────────

test("MAX_HABIT_TITLE_LENGTH is 160", () => {
  assert.equal(MAX_HABIT_TITLE_LENGTH, 160);
});

test("MAX_HABIT_DESCRIPTION_LENGTH is 1000", () => {
  assert.equal(MAX_HABIT_DESCRIPTION_LENGTH, 1000);
});

test("MAX_CHECKIN_NOTE_LENGTH is 500", () => {
  assert.equal(MAX_CHECKIN_NOTE_LENGTH, 500);
});

// ── labelForHabitStatus ───────────────────────────────────────────────────────

test("labelForHabitStatus returns Active for ACTIVE", () => {
  assert.equal(labelForHabitStatus("ACTIVE"), "Active");
});

test("labelForHabitStatus returns Paused for PAUSED", () => {
  assert.equal(labelForHabitStatus("PAUSED"), "Paused");
});

test("labelForHabitStatus returns Archived for ARCHIVED", () => {
  assert.equal(labelForHabitStatus("ARCHIVED"), "Archived");
});

// ── labelForHabitFrequency ────────────────────────────────────────────────────

test("labelForHabitFrequency returns Daily for DAILY", () => {
  assert.equal(labelForHabitFrequency(HabitFrequency.DAILY), "Daily");
});

test("labelForHabitFrequency returns Weekly for WEEKLY", () => {
  assert.equal(labelForHabitFrequency(HabitFrequency.WEEKLY), "Weekly");
});

test("labelForHabitFrequency returns Custom for CUSTOM", () => {
  assert.equal(labelForHabitFrequency(HabitFrequency.CUSTOM), "Custom");
});

// ── badgeVariantForHabitStatus ────────────────────────────────────────────────

test("badgeVariantForHabitStatus returns active for ACTIVE", () => {
  assert.equal(badgeVariantForHabitStatus("ACTIVE"), "active");
});

test("badgeVariantForHabitStatus returns paused for PAUSED", () => {
  assert.equal(badgeVariantForHabitStatus("PAUSED"), "paused");
});

test("badgeVariantForHabitStatus returns archived for ARCHIVED", () => {
  assert.equal(badgeVariantForHabitStatus("ARCHIVED"), "archived");
});

// ── normalizeCompletedOn ──────────────────────────────────────────────────────

test("normalizeCompletedOn zeros out time to UTC midnight", () => {
  const input = new Date("2026-05-28T15:30:00.000Z");
  const normalized = normalizeCompletedOn(input);
  assert.equal(normalized.getUTCHours(), 0);
  assert.equal(normalized.getUTCMinutes(), 0);
  assert.equal(normalized.getUTCSeconds(), 0);
  assert.equal(normalized.getUTCMilliseconds(), 0);
  assert.equal(normalized.getUTCFullYear(), 2026);
  assert.equal(normalized.getUTCMonth(), 4); // May = 4
  assert.equal(normalized.getUTCDate(), 28);
});

test("normalizeCompletedOn does not mutate the input date", () => {
  const input = new Date("2026-05-28T15:30:00.000Z");
  const inputTime = input.getTime();
  normalizeCompletedOn(input);
  assert.equal(input.getTime(), inputTime);
});

// ── computeCompletionCount ────────────────────────────────────────────────────

test("computeCompletionCount returns 0 for empty list", () => {
  assert.equal(computeCompletionCount([]), 0);
});

test("computeCompletionCount counts distinct days", () => {
  const dates = [
    new Date("2026-05-01T10:00:00.000Z"),
    new Date("2026-05-02T10:00:00.000Z"),
    new Date("2026-05-03T10:00:00.000Z"),
  ];
  assert.equal(computeCompletionCount(dates), 3);
});

test("computeCompletionCount deduplicates same-day completions", () => {
  const dates = [
    new Date("2026-05-01T08:00:00.000Z"),
    new Date("2026-05-01T20:00:00.000Z"), // same UTC day
    new Date("2026-05-02T10:00:00.000Z"),
  ];
  assert.equal(computeCompletionCount(dates), 2);
});

test("computeCompletionCount handles single completion", () => {
  assert.equal(computeCompletionCount([new Date("2026-05-01T00:00:00.000Z")]), 1);
});

// ── computeCurrentStreak (DAILY) ──────────────────────────────────────────────

test("computeCurrentStreak DAILY returns 0 for empty list", () => {
  assert.equal(computeCurrentStreak([], HabitFrequency.DAILY), 0);
});

test("computeCurrentStreak DAILY returns 0 when most recent is older than yesterday", () => {
  // We can't control "today" in the pure function without a now param, so
  // verify the streak is 0 if the last completion is far enough in the past.
  const pastDates = [new Date("2020-01-01T00:00:00.000Z")];
  assert.equal(computeCurrentStreak(pastDates, HabitFrequency.DAILY), 0);
});

test("computeCurrentStreak DAILY counts consecutive days ending today", () => {
  // Build 3 consecutive days including today (UTC)
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86400000);
  const dayBefore = new Date(today.getTime() - 2 * 86400000);
  const streak = computeCurrentStreak([dayBefore, yesterday, today], HabitFrequency.DAILY);
  assert.equal(streak, 3);
});

test("computeCurrentStreak DAILY deduplicates same-day entries in streak", () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86400000);
  // Two check-ins on today, one on yesterday
  const streak = computeCurrentStreak([yesterday, today, today], HabitFrequency.DAILY);
  assert.equal(streak, 2);
});

test("computeCurrentStreak DAILY breaks on a missing day", () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dayBefore = new Date(today.getTime() - 2 * 86400000); // skipped yesterday
  const streak = computeCurrentStreak([dayBefore, today], HabitFrequency.DAILY);
  // Gap between today and two days ago — streak is 1 (only today)
  assert.equal(streak, 1);
});

// ── computeCurrentStreak (CUSTOM) ────────────────────────────────────────────

test("computeCurrentStreak CUSTOM returns total distinct count", () => {
  const dates = [
    new Date("2026-01-01T00:00:00.000Z"),
    new Date("2026-01-05T00:00:00.000Z"),
    new Date("2026-01-10T00:00:00.000Z"),
  ];
  assert.equal(computeCurrentStreak(dates, HabitFrequency.CUSTOM), 3);
});

test("computeCurrentStreak CUSTOM returns 0 for empty list", () => {
  assert.equal(computeCurrentStreak([], HabitFrequency.CUSTOM), 0);
});

// ── deriveSafeHabitActivityText ───────────────────────────────────────────────

test("deriveSafeHabitActivityText returns safe label for habit.created", () => {
  assert.equal(deriveSafeHabitActivityText("habit.created"), "Habit created");
});

test("deriveSafeHabitActivityText returns safe label for habit.updated", () => {
  assert.equal(deriveSafeHabitActivityText("habit.updated"), "Habit updated");
});

test("deriveSafeHabitActivityText returns safe label for habit.assigned", () => {
  assert.equal(deriveSafeHabitActivityText("habit.assigned"), "Habit assigned");
});

test("deriveSafeHabitActivityText returns safe label for habit.archived", () => {
  assert.equal(deriveSafeHabitActivityText("habit.archived"), "Habit archived");
});

test("deriveSafeHabitActivityText returns safe label for habit.paused", () => {
  assert.equal(deriveSafeHabitActivityText("habit.paused"), "Habit paused");
});

test("deriveSafeHabitActivityText returns safe label for habit.resumed", () => {
  assert.equal(deriveSafeHabitActivityText("habit.resumed"), "Habit resumed");
});

test("deriveSafeHabitActivityText returns safe label for habit.checked_in", () => {
  assert.equal(deriveSafeHabitActivityText("habit.checked_in"), "Habit occurrence completed");
});

test("deriveSafeHabitActivityText falls back to generic label for unknown action", () => {
  assert.equal(deriveSafeHabitActivityText("unknown.habit.action"), "Habit event");
  assert.equal(deriveSafeHabitActivityText(""), "Habit event");
});

// ── Arc 24D.8: labelForHabitStatus COMPLETED ──────────────────────────────────

test("labelForHabitStatus returns Completed for COMPLETED", () => {
  assert.equal(labelForHabitStatus("COMPLETED"), "Completed");
});

test("badgeVariantForHabitStatus returns completed for COMPLETED", () => {
  assert.equal(badgeVariantForHabitStatus("COMPLETED"), "completed");
});

// ── Arc 24D.8: deriveSafeHabitActivityText with habitTitle ────────────────────

test("deriveSafeHabitActivityText includes title when provided for habit.created", () => {
  assert.equal(deriveSafeHabitActivityText("habit.created", "Dry fire practice"), "Habit created: Dry fire practice");
});

test("deriveSafeHabitActivityText includes title when provided for habit.checked_in", () => {
  assert.equal(deriveSafeHabitActivityText("habit.checked_in", "Morning stretching"), "Habit occurrence completed: Morning stretching");
});

test("deriveSafeHabitActivityText includes title when provided for habit.paused", () => {
  assert.equal(deriveSafeHabitActivityText("habit.paused", "Weekly gear check"), "Habit paused: Weekly gear check");
});

test("deriveSafeHabitActivityText returns safe label for habit.completed without title", () => {
  assert.equal(deriveSafeHabitActivityText("habit.completed"), "Habit completed");
});

test("deriveSafeHabitActivityText returns safe label for habit.restored without title", () => {
  assert.equal(deriveSafeHabitActivityText("habit.restored"), "Habit restored");
});

// ── Arc 24D.8: labelForHabitTrackingMode ──────────────────────────────────────

test("labelForHabitTrackingMode returns Check-off for CHECKOFF", () => {
  assert.equal(labelForHabitTrackingMode("CHECKOFF"), "Check-off");
});

test("labelForHabitTrackingMode returns Count for COUNT", () => {
  assert.equal(labelForHabitTrackingMode("COUNT"), "Count");
});

test("labelForHabitTrackingMode returns Notes for NOTES", () => {
  assert.equal(labelForHabitTrackingMode("NOTES"), "Notes");
});

// ── Arc 24D.8: normalizeTrackingMode ─────────────────────────────────────────

test("normalizeTrackingMode returns CHECKOFF for CHECKOFF", () => {
  assert.equal(normalizeTrackingMode("CHECKOFF"), "CHECKOFF");
});

test("normalizeTrackingMode returns COUNT for COUNT", () => {
  assert.equal(normalizeTrackingMode("COUNT"), "COUNT");
});

test("normalizeTrackingMode returns NOTES for NOTES", () => {
  assert.equal(normalizeTrackingMode("NOTES"), "NOTES");
});

test("normalizeTrackingMode defaults to CHECKOFF for unknown input", () => {
  assert.equal(normalizeTrackingMode("UNKNOWN"), "CHECKOFF");
  assert.equal(normalizeTrackingMode(""), "CHECKOFF");
});

// ── Arc 24D.8: isHabitActionableToday ────────────────────────────────────────

const TODAY = new Date("2026-05-31T00:00:00.000Z"); // Saturday

function makeActionableInput(overrides: Partial<Parameters<typeof isHabitActionableToday>[0]> = {}): Parameters<typeof isHabitActionableToday>[0] {
  return {
    status: HabitStatus.ACTIVE,
    scheduleFrequency: HabitFrequency.DAILY,
    scheduleDaysOfWeek: null,
    scheduleStartDate: null,
    scheduleEndDate: null,
    todayDate: TODAY,
    ...overrides,
  };
}

test("isHabitActionableToday returns false for PAUSED habit", () => {
  assert.equal(isHabitActionableToday(makeActionableInput({ status: HabitStatus.PAUSED })), false);
});

test("isHabitActionableToday returns false for ARCHIVED habit", () => {
  assert.equal(isHabitActionableToday(makeActionableInput({ status: HabitStatus.ARCHIVED })), false);
});

test("isHabitActionableToday returns false for COMPLETED habit", () => {
  assert.equal(isHabitActionableToday(makeActionableInput({ status: HabitStatus.COMPLETED })), false);
});

test("isHabitActionableToday returns true for ACTIVE DAILY habit with no schedule boundaries", () => {
  assert.equal(isHabitActionableToday(makeActionableInput()), true);
});

test("isHabitActionableToday returns false when today is before startDate", () => {
  assert.equal(
    isHabitActionableToday(makeActionableInput({ scheduleStartDate: new Date("2026-06-01T00:00:00.000Z") })),
    false,
  );
});

test("isHabitActionableToday returns false when today is after endDate", () => {
  assert.equal(
    isHabitActionableToday(makeActionableInput({ scheduleEndDate: new Date("2026-05-30T00:00:00.000Z") })),
    false,
  );
});

test("isHabitActionableToday returns true for WEEKLY habit on a matching day (SUN)", () => {
  // TODAY = 2026-05-31 = Sunday (SUN)
  assert.equal(
    isHabitActionableToday(makeActionableInput({
      scheduleFrequency: HabitFrequency.WEEKLY,
      scheduleDaysOfWeek: "MON,WED,SUN",
    })),
    true,
  );
});

test("isHabitActionableToday returns false for WEEKLY habit on a non-matching day", () => {
  // TODAY = 2026-05-31 = Sunday, schedule only has MON,WED
  assert.equal(
    isHabitActionableToday(makeActionableInput({
      scheduleFrequency: HabitFrequency.WEEKLY,
      scheduleDaysOfWeek: "MON,WED",
    })),
    false,
  );
});

test("isHabitActionableToday returns true for WEEKLY habit with no daysOfWeek restriction", () => {
  assert.equal(
    isHabitActionableToday(makeActionableInput({
      scheduleFrequency: HabitFrequency.WEEKLY,
      scheduleDaysOfWeek: null,
    })),
    true,
  );
});

test("isHabitActionableToday returns true for ACTIVE habit with no schedule (null frequency)", () => {
  assert.equal(
    isHabitActionableToday(makeActionableInput({ scheduleFrequency: null })),
    true,
  );
});
