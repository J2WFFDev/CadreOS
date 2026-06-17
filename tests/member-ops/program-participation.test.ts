import { strict as assert } from "node:assert";
import test from "node:test";

import { ProgramParticipationStatus, RoleType } from "@prisma/client";

import {
  deriveProgramParticipationCandidates,
  findExactProgramParticipationDuplicate,
  hasProgramParticipationInScope,
  mergeExplicitAndDerivedProgramParticipation,
} from "../../lib/member-ops-program-participation";

test("ARC-MEMBER-07: explicit participation coexists with role and roster-derived context", () => {
  const contexts = mergeExplicitAndDerivedProgramParticipation({
    personId: "person-1",
    participations: [
      {
        id: "participation-1",
        status: ProgramParticipationStatus.ACTIVE,
        program: { id: "program-1", name: "SASP" },
        season: null,
      },
    ],
    roles: [
      {
        roleType: RoleType.ATHLETE,
        program: { id: "program-1", name: "SASP" },
        team: null,
      },
    ],
    roster: [
      {
        rosterRole: RoleType.ATHLETE,
        team: { id: "team-1", name: "Precision", program: { id: "program-1", name: "SASP" } },
      },
    ],
  });

  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].programId, "program-1");
  assert.equal(contexts[0].hasExplicitParticipation, true);
  assert.deepEqual(contexts[0].sources.sort(), ["EXPLICIT", "ROLE", "ROSTER"].sort());
});

test("ARC-MEMBER-07: derived participation candidates use role and roster program context", () => {
  const candidates = deriveProgramParticipationCandidates({
    personId: "person-1",
    roles: [
      {
        roleType: RoleType.COACH,
        program: null,
        team: { id: "team-1", name: "Precision", program: { id: "program-1", name: "SASP" } },
      },
    ],
    roster: [
      {
        rosterRole: RoleType.ATHLETE,
        team: { id: "team-2", name: "Elite", program: { id: "program-2", name: "Steel" } },
      },
    ],
  });

  assert.deepEqual(
    candidates.map((candidate) => [candidate.source, candidate.programId]),
    [
      ["ROSTER", "program-2"],
      ["ROLE", "program-1"],
    ],
  );
});

test("ARC-MEMBER-07: exact duplicate participation is detected for evergreen and season-bound rows", () => {
  const existingParticipations = [
    {
      id: "participation-1",
      organizationId: "org-1",
      personId: "person-1",
      programId: "program-1",
      seasonId: null,
    },
    {
      id: "participation-2",
      organizationId: "org-1",
      personId: "person-1",
      programId: "program-1",
      seasonId: "season-1",
    },
  ];

  assert.equal(
    findExactProgramParticipationDuplicate({
      existingParticipations,
      target: {
        organizationId: "org-1",
        personId: "person-1",
        programId: "program-1",
        seasonId: null,
      },
    })?.id,
    "participation-1",
  );
  assert.equal(
    findExactProgramParticipationDuplicate({
      existingParticipations,
      target: {
        organizationId: "org-1",
        personId: "person-1",
        programId: "program-1",
        seasonId: "season-1",
      },
    })?.id,
    "participation-2",
  );
  assert.equal(
    findExactProgramParticipationDuplicate({
      existingParticipations,
      target: {
        organizationId: "org-1",
        personId: "person-1",
        programId: "program-1",
        seasonId: "season-2",
      },
    }),
    null,
  );
});

test("ARC-MEMBER-07: explicit participation does not grant unrelated program scope", () => {
  const contexts = mergeExplicitAndDerivedProgramParticipation({
    personId: "person-1",
    participations: [
      {
        id: "participation-1",
        status: ProgramParticipationStatus.ACTIVE,
        program: { id: "program-1", name: "SASP" },
        season: null,
      },
    ],
    roles: [],
    roster: [],
  });

  assert.equal(
    hasProgramParticipationInScope({
      contexts,
      allowAllStaffScope: false,
      allowedProgramIds: ["program-2"],
    }),
    false,
  );
  assert.equal(
    hasProgramParticipationInScope({
      contexts,
      allowAllStaffScope: false,
      allowedProgramIds: ["program-1"],
    }),
    true,
  );
});
