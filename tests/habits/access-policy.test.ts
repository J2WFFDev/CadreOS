import { strict as assert } from "node:assert";
import test from "node:test";

import { HabitStatus, RoleType, ScopeType } from "@prisma/client";

import type { HabitAccessContext, HabitRecord } from "../../lib/habits/access";
import {
  canArchiveHabit,
  canAssignHabitToOthers,
  canCheckInHabit,
  canCompleteHabit,
  canCreateHabit,
  canEditHabit,
  canPauseHabit,
  canReadCompletionDetail,
  canReadHabit,
  canRestoreHabit,
  hasHabitAdminAccess,
  isHabitInMyHabits,
  isHabitAssignmentAllowed,
} from "../../lib/habits/access";

function buildContext(input?: Partial<HabitAccessContext>): HabitAccessContext {
  return {
    actorPersonId: "actor-1",
    assignments: [],
    linkedGuardianAthleteIds: new Set<string>(),
    ...input,
  };
}

function buildHabit(input?: Partial<HabitRecord>): HabitRecord {
  return {
    id: "habit-1",
    athletePersonId: "athlete-1",
    assignedToTeamId: "team-1",
    createdByPersonId: "actor-1",
    status: HabitStatus.ACTIVE,
    teamProgramId: "program-1",
    ...input,
  };
}

const adminAssignment = {
  roleType: RoleType.ORGANIZATION_ADMIN,
  scopeType: ScopeType.ORGANIZATION,
  teamId: null,
  programId: null,
};

const athleteAssignment = {
  roleType: RoleType.ATHLETE,
  scopeType: ScopeType.ORGANIZATION,
  teamId: null,
  programId: null,
};

const coachAssignment = {
  roleType: RoleType.COACH,
  scopeType: ScopeType.TEAM,
  teamId: "team-1",
  programId: null,
};

const guardianAssignment = {
  roleType: RoleType.PARENT_GUARDIAN,
  scopeType: ScopeType.ORGANIZATION,
  teamId: null,
  programId: null,
};

// ── hasHabitAdminAccess ──────────────────────────────────────────────────────

test("admin has habit admin access", () => {
  assert.equal(hasHabitAdminAccess(buildContext({ assignments: [adminAssignment] })), true);
});

test("program director has habit admin access", () => {
  const ctx = buildContext({
    assignments: [{ roleType: RoleType.PROGRAM_DIRECTOR, scopeType: ScopeType.ORGANIZATION, teamId: null, programId: null }],
  });
  assert.equal(hasHabitAdminAccess(ctx), true);
});

test("athlete does not have admin access", () => {
  assert.equal(hasHabitAdminAccess(buildContext({ assignments: [athleteAssignment] })), false);
});

test("unauthenticated user does not have admin access", () => {
  assert.equal(hasHabitAdminAccess(buildContext({ actorPersonId: null })), false);
});

// ── canCreateHabit ───────────────────────────────────────────────────────────

test("admin can create habit", () => {
  assert.equal(canCreateHabit(buildContext({ assignments: [adminAssignment] })), true);
});

test("coach can create habit", () => {
  assert.equal(canCreateHabit(buildContext({ assignments: [coachAssignment] })), true);
});

test("athlete can create habit", () => {
  assert.equal(canCreateHabit(buildContext({ assignments: [athleteAssignment] })), true);
});

test("guardian cannot create habit", () => {
  assert.equal(canCreateHabit(buildContext({ assignments: [guardianAssignment] })), false);
});

test("unauthenticated user cannot create habit", () => {
  assert.equal(canCreateHabit(buildContext({ actorPersonId: null })), false);
});

test("Athlete self-service assignment is limited to self with no team", () => {
  const context = buildContext({ assignments: [athleteAssignment] });

  assert.equal(canAssignHabitToOthers(context), false);
  assert.equal(isHabitAssignmentAllowed(context, { athletePersonId: "actor-1", assignedToTeamId: null }), true);
  assert.equal(isHabitAssignmentAllowed(context, { athletePersonId: "other-athlete", assignedToTeamId: null }), false);
  assert.equal(isHabitAssignmentAllowed(context, { athletePersonId: "actor-1", assignedToTeamId: "team-1" }), false);
});

test("Coach and Admin retain existing Habit assignment capability", () => {
  assert.equal(canAssignHabitToOthers(buildContext({ assignments: [coachAssignment] })), true);
  assert.equal(
    isHabitAssignmentAllowed(buildContext({ assignments: [adminAssignment] }), {
      athletePersonId: "other-athlete",
      assignedToTeamId: "team-1",
    }),
    true,
  );
});

test("My Habits includes only the current actor as Habit subject regardless of admin access", () => {
  const adminContext = buildContext({ assignments: [adminAssignment] });
  const coachContext = buildContext({ assignments: [coachAssignment] });

  assert.equal(isHabitInMyHabits(adminContext, buildHabit({ athletePersonId: "actor-1" })), true);
  assert.equal(isHabitInMyHabits(adminContext, buildHabit({ athletePersonId: "other-athlete" })), false);
  assert.equal(isHabitInMyHabits(coachContext, buildHabit({ athletePersonId: "actor-1" })), true);
  assert.equal(isHabitInMyHabits(coachContext, buildHabit({ athletePersonId: "other-athlete" })), false);
});

// ── canReadHabit ─────────────────────────────────────────────────────────────

test("admin can read any habit", () => {
  const habit = buildHabit({ athletePersonId: "other-athlete" });
  assert.equal(canReadHabit(buildContext({ assignments: [adminAssignment] }), habit), true);
});

test("athlete can read own habit", () => {
  const habit = buildHabit({ athletePersonId: "actor-1" });
  assert.equal(canReadHabit(buildContext({ assignments: [athleteAssignment] }), habit), true);
});

test("creator can read habit even when active persona is not the athlete", () => {
  const habit = buildHabit({ athletePersonId: "other-athlete", createdByPersonId: "actor-1" });
  assert.equal(canReadHabit(buildContext({ assignments: [athleteAssignment] }), habit), true);
});

test("athlete cannot read another athlete's habit", () => {
  const habit = buildHabit({ athletePersonId: "other-athlete", createdByPersonId: "other-creator" });
  assert.equal(canReadHabit(buildContext({ assignments: [athleteAssignment] }), habit), false);
});

test("scoped coach can read habit for their team", () => {
  const habit = buildHabit({ assignedToTeamId: "team-1" });
  assert.equal(canReadHabit(buildContext({ assignments: [coachAssignment] }), habit), true);
});

test("coach from different team cannot read habit", () => {
  const habit = buildHabit({
    assignedToTeamId: "other-team",
    athletePersonId: "other-athlete",
    createdByPersonId: "other-creator",
  });
  assert.equal(canReadHabit(buildContext({ assignments: [coachAssignment] }), habit), false);
});

test("Guardian can read habit of related athlete", () => {
  const habit = buildHabit({ athletePersonId: "athlete-1" });
  const ctx = buildContext({
    actorPersonId: "guardian-1",
    assignments: [guardianAssignment],
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });
  assert.equal(canReadHabit(ctx, habit), true);
});

test("Guardian cannot read habit of unrelated athlete", () => {
  const habit = buildHabit({ athletePersonId: "other-athlete", createdByPersonId: "other-creator" });
  const ctx = buildContext({
    actorPersonId: "guardian-1",
    assignments: [guardianAssignment],
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });
  assert.equal(canReadHabit(ctx, habit), false);
});

test("unauthenticated user cannot read habit", () => {
  assert.equal(canReadHabit(buildContext({ actorPersonId: null }), buildHabit()), false);
});

// ── canEditHabit ─────────────────────────────────────────────────────────────

test("admin can edit any active habit", () => {
  const habit = buildHabit({ createdByPersonId: "other-creator" });
  assert.equal(canEditHabit(buildContext({ assignments: [adminAssignment] }), habit), true);
});

test("creator can edit their own habit", () => {
  const habit = buildHabit({ createdByPersonId: "actor-1" });
  assert.equal(canEditHabit(buildContext({}), habit), true);
});

test("non-creator athlete cannot edit another's habit", () => {
  const habit = buildHabit({ createdByPersonId: "other-creator" });
  assert.equal(canEditHabit(buildContext({ assignments: [athleteAssignment] }), habit), false);
});

test("cannot edit archived habit", () => {
  const habit = buildHabit({ status: HabitStatus.ARCHIVED });
  assert.equal(canEditHabit(buildContext({ assignments: [adminAssignment] }), habit), false);
});

// ── canArchiveHabit ──────────────────────────────────────────────────────────

test("admin can archive any habit", () => {
  const habit = buildHabit({ createdByPersonId: "other" });
  assert.equal(canArchiveHabit(buildContext({ assignments: [adminAssignment] }), habit), true);
});

test("creator can archive their habit", () => {
  assert.equal(canArchiveHabit(buildContext({}), buildHabit()), true);
});

test("cannot archive already-archived habit", () => {
  const habit = buildHabit({ status: HabitStatus.ARCHIVED });
  assert.equal(canArchiveHabit(buildContext({ assignments: [adminAssignment] }), habit), false);
});

test("unrelated coach cannot archive habit", () => {
  const habit = buildHabit({ createdByPersonId: "other", assignedToTeamId: "other-team" });
  assert.equal(canArchiveHabit(buildContext({ assignments: [coachAssignment] }), habit), false);
});

// ── canPauseHabit ────────────────────────────────────────────────────────────

test("admin can pause active habit", () => {
  assert.equal(canPauseHabit(buildContext({ assignments: [adminAssignment] }), buildHabit()), true);
});

test("creator can pause their habit", () => {
  assert.equal(canPauseHabit(buildContext({}), buildHabit()), true);
});

test("cannot pause archived habit", () => {
  const habit = buildHabit({ status: HabitStatus.ARCHIVED });
  assert.equal(canPauseHabit(buildContext({ assignments: [adminAssignment] }), habit), false);
});

// ── canCheckInHabit ──────────────────────────────────────────────────────────

test("athlete can check in to their active habit", () => {
  const habit = buildHabit({ athletePersonId: "actor-1" });
  assert.equal(canCheckInHabit(buildContext({}), habit), true);
});

test("admin can check in on behalf of athlete", () => {
  const habit = buildHabit({ athletePersonId: "other-athlete" });
  assert.equal(canCheckInHabit(buildContext({ assignments: [adminAssignment] }), habit), true);
});

test("athlete cannot check in to another athlete's habit", () => {
  const habit = buildHabit({ athletePersonId: "other-athlete" });
  assert.equal(canCheckInHabit(buildContext({ assignments: [athleteAssignment] }), habit), false);
});

test("cannot check in to paused habit", () => {
  const habit = buildHabit({ athletePersonId: "actor-1", status: HabitStatus.PAUSED });
  assert.equal(canCheckInHabit(buildContext({}), habit), false);
});

test("cannot check in to archived habit", () => {
  const habit = buildHabit({ athletePersonId: "actor-1", status: HabitStatus.ARCHIVED });
  assert.equal(canCheckInHabit(buildContext({}), habit), false);
});

test("guardian cannot check in for athlete", () => {
  const habit = buildHabit({ athletePersonId: "athlete-1" });
  const ctx = buildContext({
    actorPersonId: "guardian-1",
    assignments: [guardianAssignment],
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });
  assert.equal(canCheckInHabit(ctx, habit), false);
});

// ── canReadCompletionDetail ──────────────────────────────────────────────────

test("athlete can read their own completion detail", () => {
  const habit = buildHabit({ athletePersonId: "actor-1" });
  assert.equal(canReadCompletionDetail(buildContext({}), habit), true);
});

test("admin can read completion detail", () => {
  const habit = buildHabit({ athletePersonId: "other-athlete" });
  assert.equal(canReadCompletionDetail(buildContext({ assignments: [adminAssignment] }), habit), true);
});

test("guardian cannot read completion detail — summary only", () => {
  const habit = buildHabit({ athletePersonId: "athlete-1" });
  const ctx = buildContext({
    actorPersonId: "guardian-1",
    assignments: [guardianAssignment],
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });
  assert.equal(canReadCompletionDetail(ctx, habit), false);
});

test("coach cannot read completion detail — summary only", () => {
  const habit = buildHabit({ athletePersonId: "athlete-1" });
  const ctx = buildContext({ actorPersonId: "coach-1", assignments: [coachAssignment] });
  assert.equal(canReadCompletionDetail(ctx, habit), false);
});

// ── Arc 24D.8: canCompleteHabit ───────────────────────────────────────────────

test("admin can complete an active habit", () => {
  assert.equal(canCompleteHabit(buildContext({ assignments: [adminAssignment] }), buildHabit()), true);
});

test("creator can complete their own active habit", () => {
  assert.equal(canCompleteHabit(buildContext({}), buildHabit()), true);
});

test("cannot complete an already-completed habit", () => {
  const habit = buildHabit({ status: HabitStatus.COMPLETED });
  assert.equal(canCompleteHabit(buildContext({ assignments: [adminAssignment] }), habit), false);
});

test("cannot complete an archived habit", () => {
  const habit = buildHabit({ status: HabitStatus.ARCHIVED });
  assert.equal(canCompleteHabit(buildContext({ assignments: [adminAssignment] }), habit), false);
});

test("unrelated athlete cannot complete another's habit", () => {
  const habit = buildHabit({ createdByPersonId: "other" });
  assert.equal(canCompleteHabit(buildContext({ assignments: [athleteAssignment] }), habit), false);
});

test("unrelated guardian cannot mutate dependent-only inaccessible habit actions", () => {
  const habit = buildHabit({ athletePersonId: "other-athlete", createdByPersonId: "other" });
  const ctx = buildContext({
    actorPersonId: "guardian-1",
    assignments: [guardianAssignment],
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });

  assert.equal(canArchiveHabit(ctx, habit), false);
  assert.equal(canPauseHabit(ctx, habit), false);
  assert.equal(canCompleteHabit(ctx, habit), false);
  assert.equal(canRestoreHabit(ctx, { ...habit, status: HabitStatus.ARCHIVED }), false);
  assert.equal(canCheckInHabit(ctx, habit), false);
});

// ── Arc 24D.8: canRestoreHabit ────────────────────────────────────────────────

test("admin can restore a completed habit", () => {
  const habit = buildHabit({ status: HabitStatus.COMPLETED });
  assert.equal(canRestoreHabit(buildContext({ assignments: [adminAssignment] }), habit), true);
});

test("admin can restore an archived habit", () => {
  const habit = buildHabit({ status: HabitStatus.ARCHIVED });
  assert.equal(canRestoreHabit(buildContext({ assignments: [adminAssignment] }), habit), true);
});

test("creator can restore their own completed habit", () => {
  const habit = buildHabit({ status: HabitStatus.COMPLETED });
  assert.equal(canRestoreHabit(buildContext({}), habit), true);
});

test("creator can restore their own archived habit", () => {
  const habit = buildHabit({ status: HabitStatus.ARCHIVED });
  assert.equal(canRestoreHabit(buildContext({}), habit), true);
});

test("cannot restore an already-active habit", () => {
  assert.equal(canRestoreHabit(buildContext({ assignments: [adminAssignment] }), buildHabit()), false);
});

// ── Arc 24D.8: canPauseHabit COMPLETED guard ──────────────────────────────────

test("cannot pause a completed habit", () => {
  const habit = buildHabit({ status: HabitStatus.COMPLETED });
  assert.equal(canPauseHabit(buildContext({ assignments: [adminAssignment] }), habit), false);
});

// ── Arc 24D.8: canCheckInHabit COMPLETED guard ────────────────────────────────

test("cannot check in to a completed habit", () => {
  const habit = buildHabit({ athletePersonId: "actor-1", status: HabitStatus.COMPLETED });
  assert.equal(canCheckInHabit(buildContext({}), habit), false);
});

// ── Arc 24D.8: canArchiveHabit COMPLETED guard ────────────────────────────────

test("admin can archive a completed habit (COMPLETED is not blocked by archive)", () => {
  const habit = buildHabit({ status: HabitStatus.COMPLETED });
  assert.equal(canArchiveHabit(buildContext({ assignments: [adminAssignment] }), habit), true);
});
