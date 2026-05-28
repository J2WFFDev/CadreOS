import { strict as assert } from "node:assert";
import test from "node:test";

import { HabitStatus } from "@prisma/client";

import {
  classifyHabitOperationalReadiness,
  labelForPromptAssignmentReadiness,
} from "../../lib/journals-habits/readiness-ux";

test("classifyHabitOperationalReadiness returns archived and paused states first", () => {
  assert.equal(classifyHabitOperationalReadiness(HabitStatus.ARCHIVED, 8), "Archived");
  assert.equal(classifyHabitOperationalReadiness(HabitStatus.PAUSED, 8), "Paused");
});

test("classifyHabitOperationalReadiness returns first-checkin state for empty active habits", () => {
  assert.equal(classifyHabitOperationalReadiness(HabitStatus.ACTIVE, 0), "Needs first check-in");
  assert.equal(classifyHabitOperationalReadiness(HabitStatus.ACTIVE, -2), "Needs first check-in");
});

test("classifyHabitOperationalReadiness returns on-track for active habits with completions", () => {
  assert.equal(classifyHabitOperationalReadiness(HabitStatus.ACTIVE, 1), "On track");
});

test("labelForPromptAssignmentReadiness maps all due states to operational labels", () => {
  assert.equal(labelForPromptAssignmentReadiness("overdue"), "At risk");
  assert.equal(labelForPromptAssignmentReadiness("due_soon"), "Due soon");
  assert.equal(labelForPromptAssignmentReadiness("closed"), "Complete");
  assert.equal(labelForPromptAssignmentReadiness("open"), "On track");
});
