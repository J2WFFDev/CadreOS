import { strict as assert } from "node:assert";
import test from "node:test";

import { RoleType } from "@prisma/client";

import {
  findRosterMembershipDuplicate,
  type RosterMembershipDuplicateCandidate,
} from "../../lib/member-ops-duplicate-guardrails";

function membership(
  overrides: Partial<RosterMembershipDuplicateCandidate> = {},
): RosterMembershipDuplicateCandidate {
  return {
    id: overrides.id ?? "membership-1",
    personId: overrides.personId ?? "person-1",
    teamId: overrides.teamId ?? "team-1",
    seasonId: overrides.seasonId ?? "season-1",
    rosterRole: overrides.rosterRole ?? RoleType.ATHLETE,
    team: overrides.team ?? {
      name: "Precision A",
      programId: "program-1",
    },
  };
}

test("ARC-MEMBER-03: exact team-season roster duplicate is blocked", () => {
  const decision = findRosterMembershipDuplicate({
    existingMemberships: [membership()],
    target: {
      personId: "person-1",
      teamId: "team-1",
      seasonId: "season-1",
      rosterRole: RoleType.ATHLETE,
      programId: "program-1",
      seasonName: "Spring 2026",
    },
  });

  assert.equal(decision.duplicate, true);
  assert.equal(decision.duplicate && decision.kind, "TEAM_SEASON");
  assert.match(decision.duplicate ? decision.message : "", /already has a Spring 2026 roster membership/i);
});

test("ARC-MEMBER-03: athlete duplicate in the same program season is blocked across teams", () => {
  const decision = findRosterMembershipDuplicate({
    existingMemberships: [
      membership({
        id: "membership-a",
        teamId: "team-a",
        team: { name: "Precision A", programId: "program-1" },
      }),
    ],
    target: {
      personId: "person-1",
      teamId: "team-b",
      seasonId: "season-1",
      rosterRole: RoleType.ATHLETE,
      programId: "program-1",
      seasonName: "Spring 2026",
    },
  });

  assert.equal(decision.duplicate, true);
  assert.equal(decision.duplicate && decision.kind, "PROGRAM_SEASON");
  assert.match(decision.duplicate ? decision.message : "", /Athlete duplicate blocked/i);
  assert.match(decision.duplicate ? decision.message : "", /Precision A/i);
});

test("ARC-MEMBER-03: valid same-season transition ignores the selected source membership", () => {
  const decision = findRosterMembershipDuplicate({
    existingMemberships: [
      membership({
        id: "source-membership",
        teamId: "team-a",
        team: { name: "Precision A", programId: "program-1" },
      }),
    ],
    sourceMembershipId: "source-membership",
    target: {
      personId: "person-1",
      teamId: "team-b",
      seasonId: "season-1",
      rosterRole: RoleType.ATHLETE,
      programId: "program-1",
    },
  });

  assert.equal(decision.duplicate, false);
});

test("ARC-MEMBER-03: non-athlete program-season duplicates are configurable per route", () => {
  const existingCoachMembership = membership({
    id: "coach-membership",
    teamId: "team-a",
    rosterRole: RoleType.COACH,
    team: { name: "Precision A", programId: "program-1" },
  });
  const target = {
    personId: "person-1",
    teamId: "team-b",
    seasonId: "season-1",
    rosterRole: RoleType.COACH,
    programId: "program-1",
  };

  assert.equal(
    findRosterMembershipDuplicate({
      existingMemberships: [existingCoachMembership],
      target,
    }).duplicate,
    false,
  );
  assert.equal(
    findRosterMembershipDuplicate({
      existingMemberships: [existingCoachMembership],
      target,
      programSeasonDuplicateRoles: [
        RoleType.ATHLETE,
        RoleType.COACH,
        RoleType.ASSISTANT_COACH,
        RoleType.PARENT_GUARDIAN,
      ],
    }).duplicate,
    true,
  );
});
