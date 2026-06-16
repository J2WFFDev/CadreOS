import { strict as assert } from "node:assert";
import test from "node:test";

import { JournalAssignmentStatus, RoleType, ScopeType } from "@prisma/client";

import type { JournalAccessContext } from "../../lib/journals/access";
import {
  canAssignPrompt,
  canCancelAssignment,
  canManagePromptLibrary,
  canReadAssignment,
  canReadPromptLibrary,
  canRespondToAssignment,
  computeAssignmentDueState,
  isAssignmentOpen,
  labelForAssignmentStatus,
  type PromptAssignmentContext,
} from "../../lib/journals/prompt-access";

function buildContext(input?: Partial<JournalAccessContext>): JournalAccessContext {
  return {
    actorPersonId: "actor-1",
    assignments: [],
    linkedGuardianAthleteIds: new Set<string>(),
    ...input,
  };
}

function buildAssignment(input?: Partial<PromptAssignmentContext>): PromptAssignmentContext {
  return {
    promptId: "prompt-1",
    assignedToAthletePersonId: "athlete-1",
    assignedToTeamId: null,
    assignedByPersonId: "coach-1",
    status: JournalAssignmentStatus.ACTIVE,
    ...input,
  };
}

// ── canManagePromptLibrary ───────────────────────────────────────────────────

test("admin can manage prompt library", () => {
  const context = buildContext({
    assignments: [
      { roleType: RoleType.ORGANIZATION_ADMIN, scopeType: ScopeType.ORGANIZATION, teamId: null, programId: null },
    ],
  });
  assert.equal(canManagePromptLibrary(context), true);
});

test("program director can manage prompt library", () => {
  const context = buildContext({
    assignments: [
      { roleType: RoleType.PROGRAM_DIRECTOR, scopeType: ScopeType.ORGANIZATION, teamId: null, programId: null },
    ],
  });
  assert.equal(canManagePromptLibrary(context), true);
});

test("coach cannot manage prompt library", () => {
  const context = buildContext({
    assignments: [
      { roleType: RoleType.COACH, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null },
    ],
  });
  assert.equal(canManagePromptLibrary(context), false);
});

test("athlete cannot manage prompt library", () => {
  const context = buildContext({
    assignments: [
      { roleType: RoleType.ATHLETE, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null },
    ],
  });
  assert.equal(canManagePromptLibrary(context), false);
});

test("unauthenticated actor cannot manage prompt library", () => {
  const context = buildContext({ actorPersonId: null });
  assert.equal(canManagePromptLibrary(context), false);
});

// ── canReadPromptLibrary ─────────────────────────────────────────────────────

test("coach can read prompt library", () => {
  const context = buildContext({
    assignments: [
      { roleType: RoleType.COACH, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null },
    ],
  });
  assert.equal(canReadPromptLibrary(context), true);
});

test("athlete can read prompt library", () => {
  const context = buildContext({
    assignments: [
      { roleType: RoleType.ATHLETE, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null },
    ],
  });
  assert.equal(canReadPromptLibrary(context), true);
});

test("guardian cannot read prompt library", () => {
  const context = buildContext({
    assignments: [
      { roleType: RoleType.PARENT_GUARDIAN, scopeType: ScopeType.ORGANIZATION, teamId: null, programId: null },
    ],
  });
  assert.equal(canReadPromptLibrary(context), false);
});

// ── canAssignPrompt ──────────────────────────────────────────────────────────

test("admin can assign prompts", () => {
  const context = buildContext({
    assignments: [
      { roleType: RoleType.ORGANIZATION_ADMIN, scopeType: ScopeType.ORGANIZATION, teamId: null, programId: null },
    ],
  });
  assert.equal(canAssignPrompt(context), true);
});

test("coach can assign prompts", () => {
  const context = buildContext({
    assignments: [
      { roleType: RoleType.COACH, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null },
    ],
  });
  assert.equal(canAssignPrompt(context), true);
});

test("assistant coach can assign prompts", () => {
  const context = buildContext({
    assignments: [
      {
        roleType: RoleType.ASSISTANT_COACH,
        scopeType: ScopeType.TEAM,
        teamId: "team-1",
        programId: null,
      },
    ],
  });
  assert.equal(canAssignPrompt(context), true);
});

test("athlete cannot assign prompts to others", () => {
  const context = buildContext({
    assignments: [
      { roleType: RoleType.ATHLETE, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null },
    ],
  });
  assert.equal(canAssignPrompt(context), false);
});

test("guardian cannot assign prompts", () => {
  const context = buildContext({
    assignments: [
      { roleType: RoleType.PARENT_GUARDIAN, scopeType: ScopeType.ORGANIZATION, teamId: null, programId: null },
    ],
  });
  assert.equal(canAssignPrompt(context), false);
});

// ── canReadAssignment ────────────────────────────────────────────────────────

test("staff can read any assignment", () => {
  const context = buildContext({
    actorPersonId: "coach-1",
    assignments: [
      { roleType: RoleType.COACH, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null },
    ],
  });
  const assignment = buildAssignment({ assignedToAthletePersonId: "athlete-99" });
  assert.equal(canReadAssignment(context, assignment), true);
});

test("athlete can read their own assignment", () => {
  const context = buildContext({ actorPersonId: "athlete-1" });
  const assignment = buildAssignment({ assignedToAthletePersonId: "athlete-1" });
  assert.equal(canReadAssignment(context, assignment), true);
});

test("athlete cannot read another athlete's assignment", () => {
  const context = buildContext({ actorPersonId: "athlete-2" });
  const assignment = buildAssignment({ assignedToAthletePersonId: "athlete-1" });
  assert.equal(canReadAssignment(context, assignment), false);
});

test("Guardian can read assignment for related athlete", () => {
  const context = buildContext({
    actorPersonId: "guardian-1",
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });
  const assignment = buildAssignment({ assignedToAthletePersonId: "athlete-1" });
  assert.equal(canReadAssignment(context, assignment), true);
});

test("guardian cannot read assignment for unrelated athlete", () => {
  const context = buildContext({
    actorPersonId: "guardian-1",
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });
  const assignment = buildAssignment({ assignedToAthletePersonId: "athlete-99" });
  assert.equal(canReadAssignment(context, assignment), false);
});

// ── canRespondToAssignment ───────────────────────────────────────────────────

test("directly assigned athlete can respond to ACTIVE assignment", () => {
  const context = buildContext({
    actorPersonId: "athlete-1",
    assignments: [
      { roleType: RoleType.ATHLETE, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null },
    ],
  });
  const assignment = buildAssignment({
    assignedToAthletePersonId: "athlete-1",
    status: JournalAssignmentStatus.ACTIVE,
  });
  assert.equal(canRespondToAssignment(context, assignment, ["team-1"]), true);
});

test("athlete on assigned team can respond", () => {
  const context = buildContext({
    actorPersonId: "athlete-1",
    assignments: [
      { roleType: RoleType.ATHLETE, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null },
    ],
  });
  const assignment = buildAssignment({
    assignedToAthletePersonId: null,
    assignedToTeamId: "team-1",
    status: JournalAssignmentStatus.ACTIVE,
  });
  assert.equal(canRespondToAssignment(context, assignment, ["team-1"]), true);
});

test("athlete not on assigned team cannot respond", () => {
  const context = buildContext({
    actorPersonId: "athlete-1",
    assignments: [
      { roleType: RoleType.ATHLETE, scopeType: ScopeType.TEAM, teamId: "team-2", programId: null },
    ],
  });
  const assignment = buildAssignment({
    assignedToAthletePersonId: null,
    assignedToTeamId: "team-1",
    status: JournalAssignmentStatus.ACTIVE,
  });
  assert.equal(canRespondToAssignment(context, assignment, ["team-2"]), false);
});

test("athlete cannot respond to COMPLETED assignment", () => {
  const context = buildContext({
    actorPersonId: "athlete-1",
    assignments: [
      { roleType: RoleType.ATHLETE, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null },
    ],
  });
  const assignment = buildAssignment({
    assignedToAthletePersonId: "athlete-1",
    status: JournalAssignmentStatus.COMPLETED,
  });
  assert.equal(canRespondToAssignment(context, assignment, ["team-1"]), false);
});

test("athlete cannot respond to CANCELLED assignment", () => {
  const context = buildContext({
    actorPersonId: "athlete-1",
    assignments: [
      { roleType: RoleType.ATHLETE, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null },
    ],
  });
  const assignment = buildAssignment({
    assignedToAthletePersonId: "athlete-1",
    status: JournalAssignmentStatus.CANCELLED,
  });
  assert.equal(canRespondToAssignment(context, assignment, ["team-1"]), false);
});

test("coach role cannot respond to assignment", () => {
  const context = buildContext({
    actorPersonId: "coach-1",
    assignments: [
      { roleType: RoleType.COACH, scopeType: ScopeType.TEAM, teamId: "team-1", programId: null },
    ],
  });
  const assignment = buildAssignment({
    assignedToAthletePersonId: "coach-1",
    status: JournalAssignmentStatus.ACTIVE,
  });
  assert.equal(canRespondToAssignment(context, assignment, ["team-1"]), false);
});

// ── canCancelAssignment ──────────────────────────────────────────────────────

test("admin can cancel any assignment", () => {
  const context = buildContext({
    actorPersonId: "admin-1",
    assignments: [
      { roleType: RoleType.ORGANIZATION_ADMIN, scopeType: ScopeType.ORGANIZATION, teamId: null, programId: null },
    ],
  });
  const assignment = buildAssignment({ assignedByPersonId: "coach-99" });
  assert.equal(canCancelAssignment(context, assignment), true);
});

test("assigning coach can cancel their own assignment", () => {
  const context = buildContext({ actorPersonId: "coach-1" });
  const assignment = buildAssignment({ assignedByPersonId: "coach-1" });
  assert.equal(canCancelAssignment(context, assignment), true);
});

test("different coach cannot cancel another coach's assignment", () => {
  const context = buildContext({ actorPersonId: "coach-2" });
  const assignment = buildAssignment({ assignedByPersonId: "coach-1" });
  assert.equal(canCancelAssignment(context, assignment), false);
});

// ── labelForAssignmentStatus ─────────────────────────────────────────────────

test("labelForAssignmentStatus returns correct labels", () => {
  assert.equal(labelForAssignmentStatus(JournalAssignmentStatus.PENDING), "Pending");
  assert.equal(labelForAssignmentStatus(JournalAssignmentStatus.ACTIVE), "Active");
  assert.equal(labelForAssignmentStatus(JournalAssignmentStatus.COMPLETED), "Completed");
  assert.equal(labelForAssignmentStatus(JournalAssignmentStatus.CANCELLED), "Cancelled");
  assert.equal(labelForAssignmentStatus(JournalAssignmentStatus.EXPIRED), "Expired");
});

// ── isAssignmentOpen ─────────────────────────────────────────────────────────

test("ACTIVE and PENDING are open; others are closed", () => {
  assert.equal(isAssignmentOpen(JournalAssignmentStatus.ACTIVE), true);
  assert.equal(isAssignmentOpen(JournalAssignmentStatus.PENDING), true);
  assert.equal(isAssignmentOpen(JournalAssignmentStatus.COMPLETED), false);
  assert.equal(isAssignmentOpen(JournalAssignmentStatus.CANCELLED), false);
  assert.equal(isAssignmentOpen(JournalAssignmentStatus.EXPIRED), false);
});

// ── computeAssignmentDueState ─────────────────────────────────────────────────

test("computeAssignmentDueState returns closed for non-open status", () => {
  const now = new Date("2025-01-15T00:00:00Z");
  const dueAt = new Date("2025-01-20T00:00:00Z");
  assert.equal(computeAssignmentDueState(JournalAssignmentStatus.COMPLETED, dueAt, now), "closed");
  assert.equal(computeAssignmentDueState(JournalAssignmentStatus.CANCELLED, dueAt, now), "closed");
});

test("computeAssignmentDueState returns open when no due date", () => {
  const now = new Date("2025-01-15T00:00:00Z");
  assert.equal(computeAssignmentDueState(JournalAssignmentStatus.ACTIVE, null, now), "open");
});

test("computeAssignmentDueState returns overdue when past due date", () => {
  const now = new Date("2025-01-15T00:00:00Z");
  const dueAt = new Date("2025-01-10T00:00:00Z");
  assert.equal(computeAssignmentDueState(JournalAssignmentStatus.ACTIVE, dueAt, now), "overdue");
});

test("computeAssignmentDueState returns due_soon when within 3 days", () => {
  const now = new Date("2025-01-15T00:00:00Z");
  const dueAt = new Date("2025-01-17T00:00:00Z");
  assert.equal(computeAssignmentDueState(JournalAssignmentStatus.ACTIVE, dueAt, now), "due_soon");
});

test("computeAssignmentDueState returns open when due is more than 3 days away", () => {
  const now = new Date("2025-01-15T00:00:00Z");
  const dueAt = new Date("2025-01-20T00:00:00Z");
  assert.equal(computeAssignmentDueState(JournalAssignmentStatus.ACTIVE, dueAt, now), "open");
});
