import { strict as assert } from "node:assert";
import test from "node:test";

import { HabitFrequency, HabitTrackingMode } from "@prisma/client";

import {
  buildTaskToHabitCreateData,
  resolveTaskToHabitAthletePersonId,
  resolveTaskToHabitSchedule,
} from "../../lib/habits/task-conversion";

test("resolveTaskToHabitAthletePersonId prefers assignee, then creator, then actor", () => {
  assert.equal(
    resolveTaskToHabitAthletePersonId({
      assignedToPersonId: "assignee-1",
      createdByPersonId: "creator-1",
      actorPersonId: "actor-1",
    }),
    "assignee-1",
  );
  assert.equal(
    resolveTaskToHabitAthletePersonId({
      assignedToPersonId: null,
      createdByPersonId: "creator-1",
      actorPersonId: "actor-1",
    }),
    "creator-1",
  );
  assert.equal(
    resolveTaskToHabitAthletePersonId({
      assignedToPersonId: null,
      createdByPersonId: null,
      actorPersonId: "actor-1",
    }),
    "actor-1",
  );
});

test("resolveTaskToHabitSchedule maps only safe task recurrence rules", () => {
  const now = new Date("2026-06-04T12:00:00.000Z");

  const daily = resolveTaskToHabitSchedule({
    taskRecurrenceRule: "FREQ=DAILY",
    dueDate: null,
    now,
  });
  assert.equal(daily?.frequency, HabitFrequency.DAILY);
  assert.equal(daily?.interval, 1);
  assert.equal(daily?.startDate.toISOString(), "2026-06-04T00:00:00.000Z");

  const weekly = resolveTaskToHabitSchedule({
    taskRecurrenceRule: "FREQ=WEEKLY",
    dueDate: new Date("2026-06-08T18:30:00.000Z"),
    now,
  });
  assert.equal(weekly?.frequency, HabitFrequency.WEEKLY);
  assert.equal(weekly?.startDate.toISOString(), "2026-06-08T00:00:00.000Z");

  assert.equal(
    resolveTaskToHabitSchedule({
      taskRecurrenceRule: "FREQ=MONTHLY",
      dueDate: null,
      now,
    }),
    null,
  );
});

test("buildTaskToHabitCreateData transfers task fields into a real Habit create shape", () => {
  const data = buildTaskToHabitCreateData(
    {
      title: "Hydrate after training",
      content: "Drink water after each session.",
      assignedToPersonId: "athlete-1",
      createdByPersonId: "coach-1",
      teamId: "team-1",
      taskRecurrenceRule: "FREQ=DAILY",
    },
    {
      organizationId: "org-1",
      actorPersonId: "actor-1",
    },
    { now: new Date("2026-06-04T12:00:00.000Z") },
  );

  assert.equal(data.organizationId, "org-1");
  assert.equal(data.title, "Hydrate after training");
  assert.equal(data.description, "Drink water after each session.");
  assert.equal(data.athletePersonId, "athlete-1");
  assert.equal(data.assignedToTeamId, "team-1");
  assert.equal(data.createdByPersonId, "coach-1");
  assert.equal(data.trackingMode, HabitTrackingMode.CHECKOFF);
  assert.equal(data.targetCount, null);
  assert.equal(data.targetUnit, null);
  const schedule = "schedules" in data ? data.schedules : null;
  assert.equal(schedule?.create.frequency, HabitFrequency.DAILY);
});
