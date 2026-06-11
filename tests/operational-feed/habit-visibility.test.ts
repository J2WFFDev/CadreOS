import { strict as assert } from "node:assert";
import test from "node:test";

import { HabitFrequency, HabitStatus, RoleType, ScopeType } from "@prisma/client";

import type { HabitAccessContext } from "../../lib/habits/access";
import {
  buildActionableHabitsTodayItems,
  buildRecentHabitActivityItems,
} from "../../lib/operational-feed/queries";

const NOW = new Date("2026-05-31T10:00:00.000Z");

function buildContext(input: Partial<HabitAccessContext> = {}): HabitAccessContext {
  return {
    actorPersonId: "actor-1",
    assignments: [],
    linkedGuardianAthleteIds: new Set<string>(),
    ...input,
  };
}

function buildActionableHabitRow(overrides: Partial<Parameters<typeof buildActionableHabitsTodayItems>[0][number]> = {}) {
  return {
    id: "habit-1",
    title: "Morning stretching",
    trackingMode: "CHECKOFF",
    targetCount: null,
    targetUnit: null,
    athletePersonId: "actor-1",
    assignedToTeamId: "team-1",
    createdByPersonId: "coach-1",
    status: HabitStatus.ACTIVE,
    assignedToTeam: { programId: "program-1" },
    schedules: [
      {
        frequency: HabitFrequency.DAILY,
        daysOfWeek: null,
        startDate: new Date("2026-05-01T00:00:00.000Z"),
        endDate: null,
      },
    ],
    completions: [],
    ...overrides,
  };
}

function buildHabitActivityRow(overrides: Partial<Parameters<typeof buildRecentHabitActivityItems>[0][number]> = {}) {
  const { habit: habitOverrides, ...rowOverrides } = overrides;
  return {
    id: "activity-1",
    habitId: "habit-1",
    action: "habit.checked_in",
    actorPersonId: "actor-1",
    createdAt: NOW,
    habit: {
      title: "Morning stretching",
      athletePersonId: "athlete-1",
      assignedToTeamId: "team-1",
      createdByPersonId: "coach-1",
      status: HabitStatus.ACTIVE,
      assignedToTeam: { programId: "program-1" },
      ...(habitOverrides ?? {}),
    },
    ...rowOverrides,
  };
}

test("authorized athlete sees actionable habit with check-in enabled", () => {
  const items = buildActionableHabitsTodayItems(
    [buildActionableHabitRow({ athletePersonId: "actor-1" })],
    buildContext(),
    NOW,
  );

  assert.equal(items.length, 1);
  assert.equal(items[0]?.title, "Morning stretching");
  assert.equal(items[0]?.canCheckIn, true);
});

test("linked guardian can see readable habit without a check-in button", () => {
  const items = buildActionableHabitsTodayItems(
    [buildActionableHabitRow({ athletePersonId: "athlete-1" })],
    buildContext({
      actorPersonId: "guardian-1",
      linkedGuardianAthleteIds: new Set(["athlete-1"]),
    }),
    NOW,
  );

  assert.equal(items.length, 1);
  assert.equal(items[0]?.title, "Morning stretching");
  assert.equal(items[0]?.canCheckIn, false);
});

test("unauthorized scoped coach does not receive out-of-scope habits today", () => {
  const items = buildActionableHabitsTodayItems(
    [buildActionableHabitRow({ athletePersonId: "athlete-1", assignedToTeamId: "team-1" })],
    buildContext({
      actorPersonId: "coach-2",
      assignments: [
        {
          roleType: RoleType.COACH,
          scopeType: ScopeType.TEAM,
          teamId: "team-2",
          programId: null,
        },
      ],
    }),
    NOW,
  );

  assert.deepEqual(items, []);
});

test("organization admin can see habit activity across the organization", () => {
  const items = buildRecentHabitActivityItems(
    [buildHabitActivityRow()],
    buildContext({
      actorPersonId: "admin-1",
      assignments: [
        {
          roleType: RoleType.ORGANIZATION_ADMIN,
          scopeType: ScopeType.ORGANIZATION,
          teamId: null,
          programId: null,
        },
      ],
    }),
  );

  assert.equal(items.length, 1);
  assert.equal(items[0]?.entryTitle, "Habit occurrence completed: Morning stretching");
  assert.equal(items[0]?.entryType, "HABIT_ACTIVITY");
});

test("scoped users do not receive out-of-scope habit activity titles", () => {
  const items = buildRecentHabitActivityItems(
    [buildHabitActivityRow()],
    buildContext({
      actorPersonId: "coach-2",
      assignments: [
        {
          roleType: RoleType.COACH,
          scopeType: ScopeType.TEAM,
          teamId: "team-2",
          programId: null,
        },
      ],
    }),
  );

  assert.deepEqual(items, []);
});
