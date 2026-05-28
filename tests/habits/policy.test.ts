import { strict as assert } from "node:assert";
import test from "node:test";

import { HabitFrequency } from "@prisma/client";

import {
  computeCompletionCount,
  computeCurrentStreak,
  deriveSafeHabitActivityText,
  normalizeCompletedOn,
} from "../../lib/habits/policy";

test("normalizeCompletedOn normalizes to UTC day start", () => {
  const normalized = normalizeCompletedOn(new Date("2026-05-28T19:42:10.000Z"));
  assert.equal(normalized.toISOString(), "2026-05-28T00:00:00.000Z");
});

test("computeCompletionCount de-duplicates same-day check-ins", () => {
  const dates = [
    new Date("2026-05-10T01:00:00.000Z"),
    new Date("2026-05-10T20:00:00.000Z"),
    new Date("2026-05-11T12:00:00.000Z"),
  ];
  assert.equal(computeCompletionCount(dates), 2);
});

test("computeCurrentStreak daily returns consecutive run ending today or yesterday", () => {
  const today = normalizeCompletedOn(new Date());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000);

  assert.equal(computeCurrentStreak([twoDaysAgo, yesterday, today], HabitFrequency.DAILY), 3);
  assert.equal(computeCurrentStreak([twoDaysAgo], HabitFrequency.DAILY), 0);
});

test("computeCurrentStreak weekly counts consecutive week buckets", () => {
  const today = normalizeCompletedOn(new Date());
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

  assert.equal(computeCurrentStreak([twoWeeksAgo, oneWeekAgo, today], HabitFrequency.WEEKLY), 3);
});

test("computeCurrentStreak custom falls back to completion count semantics", () => {
  assert.equal(
    computeCurrentStreak(
      [new Date("2026-05-01T00:00:00.000Z"), new Date("2026-05-15T00:00:00.000Z")],
      HabitFrequency.CUSTOM,
    ),
    2,
  );
});

test("deriveSafeHabitActivityText never echoes raw user content", () => {
  assert.equal(deriveSafeHabitActivityText("habit.created"), "Habit created");
  assert.equal(deriveSafeHabitActivityText("habit.checked_in"), "Habit check-in recorded");
  assert.equal(deriveSafeHabitActivityText("unknown.private.action"), "Habit event");
});
