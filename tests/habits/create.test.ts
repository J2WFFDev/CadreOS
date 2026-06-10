import { strict as assert } from "node:assert";
import test from "node:test";

import { HabitFrequency, HabitTrackingMode } from "@prisma/client";

import {
  buildHabitCreateData,
  createHabitActivitySafely,
  getHabitCreateErrorMessage,
  getHabitCreateValidationError,
  normalizeHabitCreateFormInput,
} from "../../lib/habits/create";

function makeFormData(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

test("HBT-CREATE-001: defaults to CHECKOFF and supports minimal required create payload", () => {
  const input = normalizeHabitCreateFormInput(
    makeFormData({
      title: "Morning stretch",
      athletePersonId: "athlete-1",
    }),
  );

  assert.equal(getHabitCreateValidationError(input), null);
  assert.equal(input.trackingMode, HabitTrackingMode.CHECKOFF);

  const createData = buildHabitCreateData(input, {
    organizationId: "org-1",
    actorPersonId: "person-1",
  });
  assert.equal(createData.title, "Morning stretch");
  assert.equal(createData.createdByPersonId, "person-1");
  assert.equal("completions" in createData, false);
});

test("HBT-CREATE-002: daily schedule defaults safely when frequency is selected without start date", () => {
  const input = normalizeHabitCreateFormInput(
    makeFormData({
      title: "Hydration",
      athletePersonId: "athlete-1",
      frequency: "DAILY",
      trackingMode: "CHECKOFF",
      description: "Drink water",
    }),
  );

  assert.equal(input.frequency, HabitFrequency.DAILY);
  assert.equal(input.interval, 1);
  assert.ok(input.startDate instanceof Date);

  const createData = buildHabitCreateData(input, {
    organizationId: "org-1",
    actorPersonId: "person-1",
  });
  assert.equal(createData.schedules?.create.frequency, HabitFrequency.DAILY);
  assert.equal(createData.schedules?.create.interval, 1);
});

test("HBT-CREATE-003: count tracking persists target fields", () => {
  const input = normalizeHabitCreateFormInput(
    makeFormData({
      title: "Pushups",
      athletePersonId: "athlete-1",
      trackingMode: "COUNT",
      targetCount: "25",
      targetUnitOption: "reps",
    }),
  );

  assert.equal(input.trackingMode, HabitTrackingMode.COUNT);
  assert.equal(input.targetCount, 25);
  assert.equal(input.targetUnit, "reps");
});

test("HBT-CREATE-003b: controlled Custom unit preserves the supplied label", () => {
  const input = normalizeHabitCreateFormInput(
    makeFormData({
      title: "Hydration",
      athletePersonId: "athlete-1",
      trackingMode: "COUNT",
      targetCount: "8",
      targetUnitOption: "__CUSTOM__",
      targetUnitCustom: "bottles",
    }),
  );

  assert.equal(input.targetUnit, "bottles");
});

test("HBT-CREATE-003c: legacy free-text unit remains accepted without data loss", () => {
  const input = normalizeHabitCreateFormInput(
    makeFormData({
      title: "Legacy Habit",
      athletePersonId: "athlete-1",
      trackingMode: "COUNT",
      targetUnit: "laps",
    }),
  );

  assert.equal(input.targetUnit, "laps");
});

test("HBT-CREATE-004: notes tracking mode is normalized safely", () => {
  const input = normalizeHabitCreateFormInput(
    makeFormData({
      title: "Technique reflection",
      athletePersonId: "athlete-1",
      trackingMode: "NOTES",
      targetCount: "99",
      targetUnit: "ignored",
    }),
  );

  assert.equal(input.trackingMode, HabitTrackingMode.NOTES);
  assert.equal(input.targetCount, null);
  assert.equal(input.targetUnit, null);
});

test("HBT-CREATE-005: missing title returns validation error and user-safe feedback message", () => {
  const input = normalizeHabitCreateFormInput(
    makeFormData({
      athletePersonId: "athlete-1",
    }),
  );

  assert.equal(getHabitCreateValidationError(input), "missing_title");
  assert.equal(getHabitCreateErrorMessage("missing_title"), "Habit title is required.");
});

test("HBT-CREATE-006: explicit schedule values are preserved in create payload", () => {
  const input = normalizeHabitCreateFormInput(
    makeFormData({
      title: "Sprint intervals",
      athletePersonId: "athlete-1",
      frequency: "WEEKLY",
      interval: "2",
      daysOfWeek: "MON,WED,FRI",
      startDate: "2026-05-31",
      endDate: "2026-06-30",
    }),
  );

  const createData = buildHabitCreateData(input, {
    organizationId: "org-1",
    actorPersonId: "person-1",
  });
  assert.equal(createData.schedules?.create.frequency, HabitFrequency.WEEKLY);
  assert.equal(createData.schedules?.create.interval, 2);
  assert.equal(createData.schedules?.create.daysOfWeek, "MON,WED,FRI");
});

test("HBT-CREATE-006b: weekly schedule days are normalized before persistence", () => {
  const input = normalizeHabitCreateFormInput(
    makeFormData({
      title: "Sprint intervals",
      athletePersonId: "athlete-1",
      frequency: "WEEKLY",
      daysOfWeek: "fri, bad-day mon",
      startDate: "2026-05-31",
    }),
  );

  const createData = buildHabitCreateData(input, {
    organizationId: "org-1",
    actorPersonId: "person-1",
  });
  assert.equal(createData.schedules?.create.daysOfWeek, "MON,FRI");
});

test("HBT-CREATE-007: activity creation is non-blocking when activity write fails", async () => {
  let attempted = 0;
  const loggedErrors: unknown[] = [];
  const result = await createHabitActivitySafely({
    createActivity: async () => {
      attempted += 1;
      throw new Error("activity table missing");
    },
    organizationId: "org-1",
    habitId: "habit-1",
    actorPersonId: "person-1",
    logError: (error) => loggedErrors.push(error),
  });

  assert.equal(result, false);
  assert.equal(attempted, 1);
  assert.equal(loggedErrors.length, 1);
});

test("HBT-CREATE-008: activity creation requires scoped organization and actor context", async () => {
  let attempted = 0;
  const result = await createHabitActivitySafely({
    createActivity: async () => {
      attempted += 1;
      return {};
    },
    organizationId: "org-1",
    habitId: "habit-1",
    actorPersonId: null,
    logError: () => undefined,
  });

  assert.equal(result, false);
  assert.equal(attempted, 0);
});
