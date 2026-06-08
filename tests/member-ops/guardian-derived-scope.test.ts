import { strict as assert } from "node:assert";
import test from "node:test";

import { MemberLifecycleStatus, RoleType, ScopeType } from "@prisma/client";

import { buildGuardianDerivedScope } from "../../lib/guardian-derived-scope";

const now = new Date("2026-06-08T12:00:00.000Z");

function relationship(input?: {
  athletePersonId?: string;
  lifecycleStatus?: MemberLifecycleStatus;
  teamId?: string;
  programId?: string;
  startDate?: Date | null;
  endDate?: Date | null;
}): Parameters<typeof buildGuardianDerivedScope>[0][number] {
  const teamId = input?.teamId ?? "team-1";
  const programId = input?.programId ?? "program-1";

  return {
    athletePersonId: input?.athletePersonId ?? "athlete-1",
    athlete: {
      lifecycleStatus: input?.lifecycleStatus ?? MemberLifecycleStatus.ACTIVE,
      roles: [],
      roster: [
        {
          rosterRole: RoleType.ATHLETE,
          teamId,
          team: { programId },
          season: {
            startDate: input?.startDate ?? new Date("2026-01-01T00:00:00.000Z"),
            endDate: input?.endDate ?? new Date("2026-12-31T23:59:59.000Z"),
          },
        },
      ],
    },
  };
}

test("guardian scope derives dependent and active athlete roster context", () => {
  assert.deepEqual(buildGuardianDerivedScope([relationship()], now), {
    dependentAthleteIds: ["athlete-1"],
    derivedProgramIds: ["program-1"],
    derivedTeamIds: ["team-1"],
  });
});

test("guardian scope excludes inactive dependents and expired memberships", () => {
  const scope = buildGuardianDerivedScope(
    [
      relationship({
        athletePersonId: "inactive-athlete",
        lifecycleStatus: MemberLifecycleStatus.INACTIVE,
      }),
      relationship({
        athletePersonId: "active-athlete",
        teamId: "old-team",
        endDate: new Date("2025-12-31T23:59:59.000Z"),
      }),
    ],
    now,
  );

  assert.deepEqual(scope, {
    dependentAthleteIds: ["active-athlete"],
    derivedProgramIds: [],
    derivedTeamIds: [],
  });
});

test("guardian scope follows an athlete move without retaining the prior team", () => {
  const beforeMove = buildGuardianDerivedScope([relationship({ teamId: "team-old" })], now);
  const afterMove = buildGuardianDerivedScope([relationship({ teamId: "team-new" })], now);

  assert.deepEqual(beforeMove.derivedTeamIds, ["team-old"]);
  assert.deepEqual(afterMove.derivedTeamIds, ["team-new"]);
});

test("guardian scope can derive active athlete role scope without deriving unrelated roles", () => {
  const linked = relationship();
  linked.athlete.roster = [];
  linked.athlete.roles = [
    {
      roleType: RoleType.ATHLETE,
      scopeType: ScopeType.TEAM,
      programId: null,
      teamId: "team-role",
      team: { programId: "program-role" },
    },
    {
      roleType: RoleType.COACH,
      scopeType: ScopeType.TEAM,
      programId: null,
      teamId: "unrelated-team",
      team: { programId: "unrelated-program" },
    },
  ];

  assert.deepEqual(buildGuardianDerivedScope([linked], now), {
    dependentAthleteIds: ["athlete-1"],
    derivedProgramIds: ["program-role"],
    derivedTeamIds: ["team-role"],
  });
});
