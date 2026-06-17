import { strict as assert } from "node:assert";
import test from "node:test";

import { ProgramParticipationStatus, RoleType, ScopeType } from "@prisma/client";

import { evaluateStaffOnlyContentAccess } from "../../lib/authorization";
import {
  buildProgramParticipationBackfillCandidates,
  deriveProgramParticipationCandidates,
  findExactProgramParticipationDuplicate,
  buildActiveProgramParticipationPersonVisibilityFilters,
  buildActiveProgramParticipationWhere,
  buildProgramParticipationReviewWhere,
  hasActiveExplicitProgramParticipationInScope,
  hasProgramParticipationInScope,
  mergeExplicitAndDerivedProgramParticipation,
} from "../../lib/member-ops-program-participation";
import {
  actionRequiresBackendScope,
  actionRequiresProgramBackendScope,
  backendRoleScopeMatchesAction,
  canRoleTypePerformBackendAction,
} from "../../lib/permissions";

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

test("ARC-MEMBER-07 review: inactive explicit participation is not current scope", () => {
  const activeParticipation = {
    id: "participation-active",
    status: ProgramParticipationStatus.ACTIVE,
    program: { id: "program-1", name: "SASP" },
    season: null,
  };
  const inactiveParticipation = {
    id: "participation-inactive",
    status: ProgramParticipationStatus.INACTIVE,
    program: { id: "program-1", name: "SASP" },
    season: null,
  };

  assert.equal(
    hasActiveExplicitProgramParticipationInScope({
      participations: [inactiveParticipation],
      allowAllStaffScope: false,
      allowedProgramIds: ["program-1"],
    }),
    false,
  );
  assert.equal(
    hasActiveExplicitProgramParticipationInScope({
      participations: [activeParticipation],
      allowAllStaffScope: false,
      allowedProgramIds: ["program-1"],
    }),
    true,
  );
});

test("ARC-MEMBER-07 review: helper merge ignores inactive explicit participation", () => {
  const contexts = mergeExplicitAndDerivedProgramParticipation({
    personId: "person-1",
    participations: [
      {
        id: "participation-inactive",
        status: ProgramParticipationStatus.INACTIVE,
        program: { id: "program-1", name: "SASP" },
        season: null,
      },
    ],
    roles: [],
    roster: [],
  });

  assert.deepEqual(contexts, []);
});

test("ARC-MEMBER-07 review: scoped participation visibility filters require active rows", () => {
  const staffScopeResolution = {
    allowAllStaffScope: false,
    allowedProgramIds: ["program-1"],
  };

  assert.deepEqual(
    buildActiveProgramParticipationWhere({
      organizationId: "org-1",
      staffScopeResolution,
    }),
    {
      organizationId: "org-1",
      status: ProgramParticipationStatus.ACTIVE,
      programId: { in: ["program-1"] },
    },
  );
  assert.deepEqual(
    buildActiveProgramParticipationPersonVisibilityFilters({
      organizationId: "org-1",
      staffScopeResolution,
    }),
    [
      {
        programParticipations: {
          some: {
            organizationId: "org-1",
            status: ProgramParticipationStatus.ACTIVE,
            programId: { in: ["program-1"] },
          },
        },
      },
    ],
  );
});

test("ARC-MEMBER-08: review route query stays inside allowed program scope", () => {
  assert.deepEqual(
    buildProgramParticipationReviewWhere({
      organizationId: "org-1",
      staffScopeResolution: {
        allowAllStaffScope: false,
        allowedProgramIds: ["program-1"],
      },
    }),
    {
      organizationId: "org-1",
      programId: { in: ["program-1"] },
    },
  );
  assert.deepEqual(
    buildProgramParticipationReviewWhere({
      organizationId: "org-1",
      staffScopeResolution: {
        allowAllStaffScope: true,
        allowedProgramIds: [],
      },
    }),
    {
      organizationId: "org-1",
    },
  );
});

test("ARC-MEMBER-08: participation review uses existing staff-only route access", () => {
  const staffDecision = evaluateStaffOnlyContentAccess({
    organizationId: "org-1",
    actorPersonId: "person-staff",
    isOrganizationAdmin: false,
    isStaffMember: true,
    staffRoleAssignments: [
      {
        roleType: RoleType.COACH,
        scopeType: ScopeType.TEAM,
        programId: null,
        teamId: "team-1",
      },
    ],
  });
  const nonStaffDecision = evaluateStaffOnlyContentAccess({
    organizationId: "org-1",
    actorPersonId: "person-athlete",
    isOrganizationAdmin: false,
    isStaffMember: false,
    staffRoleAssignments: [],
  });
  const unlinkedDecision = evaluateStaffOnlyContentAccess({
    organizationId: "org-1",
    actorPersonId: null,
    isOrganizationAdmin: false,
    isStaffMember: false,
    staffRoleAssignments: [],
  });

  assert.equal(staffDecision.allowed, true);
  assert.equal(nonStaffDecision.allowed, false);
  assert.equal(unlinkedDecision.allowed, false);
});

test("ARC-MEMBER-09: participation mutation actions are explicit program-scoped backend actions", () => {
  const mutationActions = [
    "programParticipation.create",
    "programParticipation.update",
    "programParticipation.status.update",
  ];

  for (const action of mutationActions) {
    assert.equal(actionRequiresBackendScope(action), true, `${action} should require backend scope`);
    assert.equal(actionRequiresProgramBackendScope(action), true, `${action} should require program scope`);
  }
});

test("ARC-MEMBER-09: admin and program director can mutate participation while coach and non-staff cannot", () => {
  const mutationActions = [
    "programParticipation.create",
    "programParticipation.update",
    "programParticipation.status.update",
  ];

  for (const action of mutationActions) {
    assert.equal(
      canRoleTypePerformBackendAction(RoleType.ORGANIZATION_ADMIN, action),
      true,
      `Organization Admin should be able to ${action}`,
    );
    assert.equal(
      canRoleTypePerformBackendAction(RoleType.PROGRAM_DIRECTOR, action),
      true,
      `Program Director should be able to ${action}`,
    );
    assert.equal(canRoleTypePerformBackendAction(RoleType.COACH, action), false, `Coach should not be able to ${action}`);
    assert.equal(
      canRoleTypePerformBackendAction(RoleType.PARENT_GUARDIAN, action),
      false,
      `Guardian should not be able to ${action}`,
    );
    assert.equal(canRoleTypePerformBackendAction(RoleType.ATHLETE, action), false, `Athlete should not be able to ${action}`);
  }
});

test("ARC-MEMBER-09: participation mutation scope requires matching program scope", () => {
  const programAssignment = {
    scopeType: ScopeType.PROGRAM,
    programId: "program-1",
    teamId: null,
  };
  const teamAssignment = {
    scopeType: ScopeType.TEAM,
    programId: null,
    teamId: "team-1",
  };

  assert.equal(
    backendRoleScopeMatchesAction({
      action: "programParticipation.create",
      assignment: programAssignment,
      scope: { programId: "program-1", teamId: null },
    }),
    true,
  );
  assert.equal(
    backendRoleScopeMatchesAction({
      action: "programParticipation.update",
      assignment: programAssignment,
      scope: { programId: "program-2", teamId: null },
    }),
    false,
  );
  assert.equal(
    backendRoleScopeMatchesAction({
      action: "programParticipation.status.update",
      assignment: teamAssignment,
      scope: { programId: "program-1", teamId: "team-1" },
    }),
    false,
  );
});

test("ARC-MEMBER-08: backfill preview derives roster and role candidates without writing rows", () => {
  const candidates = buildProgramParticipationBackfillCandidates({
    rosterMemberships: [
      {
        id: "roster-1",
        personId: "person-1",
        rosterRole: RoleType.ATHLETE,
        team: { id: "team-1", name: "Precision", program: { id: "program-1", name: "SASP" } },
        season: { id: "season-1", name: "2026" },
      },
    ],
    roleAssignments: [
      {
        id: "role-1",
        personId: "person-2",
        roleType: RoleType.COACH,
        program: { id: "program-2", name: "Steel" },
      },
      {
        id: "role-2",
        personId: "person-3",
        roleType: RoleType.COACH,
        team: { id: "team-2", name: "Elite", program: { id: "program-3", name: "Air" } },
      },
    ],
  });

  assert.deepEqual(
    candidates.map((candidate) => [
      candidate.personId,
      candidate.programId,
      candidate.seasonId,
      candidate.sources,
      candidate.proposedStatus,
    ]),
    [
      ["person-1", "program-1", "season-1", ["ROSTER"], ProgramParticipationStatus.ACTIVE],
      ["person-2", "program-2", null, ["ROLE_PROGRAM"], ProgramParticipationStatus.ACTIVE],
      ["person-3", "program-3", null, ["ROLE_TEAM"], ProgramParticipationStatus.ACTIVE],
    ],
  );
});

test("ARC-MEMBER-08: backfill preview merges duplicate exact candidates", () => {
  const candidates = buildProgramParticipationBackfillCandidates({
    rosterMemberships: [
      {
        id: "roster-1",
        personId: "person-1",
        rosterRole: RoleType.ATHLETE,
        team: { id: "team-1", name: "Precision", program: { id: "program-1", name: "SASP" } },
      },
    ],
    roleAssignments: [
      {
        id: "role-1",
        personId: "person-1",
        roleType: RoleType.ATHLETE,
        program: { id: "program-1", name: "SASP" },
      },
    ],
  });

  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].sources.sort(), ["ROLE_PROGRAM", "ROSTER"].sort());
  assert.deepEqual(candidates[0].sourceIds.sort(), ["role-1", "roster-1"].sort());
});

test("ARC-MEMBER-08: backfill preview excludes inactive and historical sources by default", () => {
  const candidates = buildProgramParticipationBackfillCandidates({
    rosterMemberships: [
      {
        id: "roster-inactive",
        personId: "person-1",
        rosterRole: RoleType.ATHLETE,
        status: ProgramParticipationStatus.INACTIVE,
        team: { id: "team-1", name: "Precision", program: { id: "program-1", name: "SASP" } },
      },
      {
        id: "roster-historical",
        personId: "person-2",
        rosterRole: RoleType.ATHLETE,
        isHistorical: true,
        team: { id: "team-1", name: "Precision", program: { id: "program-1", name: "SASP" } },
      },
    ],
    roleAssignments: [
      {
        id: "role-inactive",
        personId: "person-3",
        roleType: RoleType.COACH,
        status: ProgramParticipationStatus.INACTIVE,
        program: { id: "program-1", name: "SASP" },
      },
    ],
  });

  assert.deepEqual(candidates, []);
});

test("ARC-MEMBER-08 review: backfill preview includes inactive sources only with inactive flag", () => {
  const inactiveCandidates = buildProgramParticipationBackfillCandidates({
    rosterMemberships: [
      {
        id: "roster-inactive",
        personId: "person-1",
        rosterRole: RoleType.ATHLETE,
        status: ProgramParticipationStatus.INACTIVE,
        team: { id: "team-1", name: "Precision", program: { id: "program-1", name: "SASP" } },
      },
    ],
    roleAssignments: [],
    includeInactive: true,
  });

  assert.equal(inactiveCandidates.length, 1);
  assert.equal(inactiveCandidates[0].personId, "person-1");
});

test("ARC-MEMBER-08 review: backfill preview includes historical sources only with historical flag", () => {
  const historicalCandidates = buildProgramParticipationBackfillCandidates({
    rosterMemberships: [],
    roleAssignments: [
      {
        id: "role-historical",
        personId: "person-1",
        roleType: RoleType.COACH,
        isHistorical: true,
        program: { id: "program-1", name: "SASP" },
      },
    ],
    includeHistorical: true,
  });

  assert.equal(historicalCandidates.length, 1);
  assert.equal(historicalCandidates[0].personId, "person-1");
});

test("ARC-MEMBER-08 review: inactive historical sources are included by either explicit category flag", () => {
  const input = {
    rosterMemberships: [
      {
        id: "roster-inactive-historical",
        personId: "person-1",
        rosterRole: RoleType.ATHLETE,
        status: ProgramParticipationStatus.INACTIVE,
        isHistorical: true,
        team: { id: "team-1", name: "Precision", program: { id: "program-1", name: "SASP" } },
      },
    ],
    roleAssignments: [],
  };

  assert.deepEqual(buildProgramParticipationBackfillCandidates(input), []);
  assert.equal(buildProgramParticipationBackfillCandidates({ ...input, includeInactive: true }).length, 1);
  assert.equal(buildProgramParticipationBackfillCandidates({ ...input, includeHistorical: true }).length, 1);
  assert.equal(
    buildProgramParticipationBackfillCandidates({
      ...input,
      includeInactive: true,
      includeHistorical: true,
    }).length,
    1,
  );
});

test("ARC-MEMBER-08: backfill preview has no Guardian-derived source path", () => {
  const candidates = buildProgramParticipationBackfillCandidates({
    rosterMemberships: [],
    roleAssignments: [
      {
        id: "role-guardian",
        personId: "guardian-1",
        roleType: RoleType.PARENT_GUARDIAN,
        program: null,
        team: null,
      },
    ],
  });

  assert.deepEqual(candidates, []);
});
