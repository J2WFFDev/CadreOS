import { strict as assert } from "node:assert";
import test from "node:test";

import { RoleType, ScopeType } from "@prisma/client";

import {
  buildEntryOpsAllWorkDefaultWhere,
  buildEntryOpsEntryDetailVisibilityWhere,
  canEditEntryOpsEntry,
  canReadEntryOpsEntryDetail,
  canSelfEditEntryOpsEntry,
  entryActionDeniedMessage,
  ENTRY_NOT_FOUND_OR_ACCESS_DENIED_MESSAGE,
  resolveEntryOpsDetailAccessDecision,
  resolveEntryOpsAllWorkDefaultVisibility,
  type EntryOpsRoleAssignmentScope,
} from "../../lib/entryops/visibility";

function assignment(input: Partial<EntryOpsRoleAssignmentScope> & { roleType: RoleType }): EntryOpsRoleAssignmentScope {
  return {
    roleType: input.roleType,
    scopeType: input.scopeType ?? ScopeType.ORGANIZATION,
    teamId: input.teamId ?? null,
    programId: input.programId ?? null,
  };
}

test("org admin All Work Items default is organization-wide", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "admin-1",
    assignments: [assignment({ roleType: RoleType.ORGANIZATION_ADMIN })],
    linkedGuardianAthleteIds: new Set(),
  });

  assert.equal(visibility.canRead, true);
  assert.equal(visibility.organizationWide, true);
  assert.deepEqual(visibility.visiblePersonIds, []);
  assert.deepEqual(buildEntryOpsAllWorkDefaultWhere(visibility), {});
});

test("guardian All Work Items default includes own and dependent athletes", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "guardian-1",
    assignments: [assignment({ roleType: RoleType.PARENT_GUARDIAN })],
    linkedGuardianAthleteIds: new Set(["athlete-1", "athlete-2"]),
  });

  assert.equal(visibility.canRead, true);
  assert.equal(visibility.organizationWide, false);
  assert.deepEqual(visibility.visiblePersonIds, ["guardian-1", "athlete-1", "athlete-2"]);

  const where = buildEntryOpsAllWorkDefaultWhere(visibility);
  assert.deepEqual(where, {
    OR: [
      { createdByPersonId: { in: ["guardian-1", "athlete-1", "athlete-2"] } },
      { assignedToPersonId: { in: ["guardian-1", "athlete-1", "athlete-2"] } },
      {
        assignments: {
          some: {
            personId: { in: ["guardian-1", "athlete-1", "athlete-2"] },
            revokedAt: null,
          },
        },
      },
    ],
  });
});

test("athlete All Work Items default is own items only", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "athlete-1",
    assignments: [assignment({ roleType: RoleType.ATHLETE })],
    linkedGuardianAthleteIds: new Set(),
  });

  assert.equal(visibility.canRead, true);
  assert.equal(visibility.organizationWide, false);
  assert.deepEqual(visibility.visiblePersonIds, ["athlete-1"]);
  assert.deepEqual(visibility.teamIds, []);
  assert.deepEqual(visibility.programIds, []);
});

test("limited/no-role actor All Work Items default is own items only", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "limited-1",
    assignments: [],
    linkedGuardianAthleteIds: new Set(),
  });

  assert.equal(visibility.canRead, true);
  assert.equal(visibility.organizationWide, false);
  assert.deepEqual(visibility.visiblePersonIds, ["limited-1"]);
});

test("coach All Work Items default is own items until explicit scope expansion is added", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "coach-1",
    assignments: [
      assignment({
        roleType: RoleType.COACH,
        scopeType: ScopeType.TEAM,
        teamId: "team-1",
      }),
    ],
    linkedGuardianAthleteIds: new Set(),
  });

  assert.equal(visibility.canRead, true);
  assert.equal(visibility.organizationWide, false);
  assert.deepEqual(visibility.visiblePersonIds, ["coach-1"]);
  assert.deepEqual(visibility.teamIds, []);
  assert.deepEqual(visibility.programIds, []);
});

test("program director default uses available program and team assignment scope", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "program-1",
    assignments: [
      assignment({
        roleType: RoleType.PROGRAM_DIRECTOR,
        scopeType: ScopeType.PROGRAM,
        programId: "program-a",
      }),
      assignment({
        roleType: RoleType.PROGRAM_DIRECTOR,
        scopeType: ScopeType.TEAM,
        teamId: "team-a",
      }),
    ],
    linkedGuardianAthleteIds: new Set(),
  });

  assert.equal(visibility.canRead, true);
  assert.equal(visibility.organizationWide, false);
  assert.deepEqual(visibility.visiblePersonIds, ["program-1"]);
  assert.deepEqual(visibility.programIds, ["program-a"]);
  assert.deepEqual(visibility.teamIds, ["team-a"]);
});

test("entry detail visibility allows owner access independent of active persona", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "member-1",
    assignments: [assignment({ roleType: RoleType.ATHLETE })],
    linkedGuardianAthleteIds: new Set(),
  });

  assert.equal(
    canReadEntryOpsEntryDetail(visibility, {
      createdByPersonId: "member-1",
      assignedToPersonId: null,
      teamId: null,
    }),
    true,
  );
});

test("entry detail visibility blocks unrelated athlete from another person's entry", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "athlete-2",
    assignments: [assignment({ roleType: RoleType.ATHLETE })],
    linkedGuardianAthleteIds: new Set(),
  });

  assert.equal(
    canReadEntryOpsEntryDetail(visibility, {
      createdByPersonId: "member-1",
      assignedToPersonId: null,
      teamId: null,
    }),
    false,
  );
});

test("entry detail visibility blocks unrelated limited or no-role users", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "limited-1",
    assignments: [],
    linkedGuardianAthleteIds: new Set(),
  });

  assert.equal(
    canReadEntryOpsEntryDetail(visibility, {
      createdByPersonId: "member-1",
      assignedToPersonId: null,
      teamId: null,
    }),
    false,
  );
});

test("entry detail visibility allows guardian access to dependent athlete entries", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "guardian-1",
    assignments: [assignment({ roleType: RoleType.PARENT_GUARDIAN })],
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });

  assert.equal(
    canReadEntryOpsEntryDetail(visibility, {
      createdByPersonId: "athlete-1",
      assignedToPersonId: null,
      teamId: null,
    }),
    true,
  );
  assert.equal(
    canReadEntryOpsEntryDetail(visibility, {
      createdByPersonId: "member-1",
      assignedToPersonId: "athlete-1",
      teamId: null,
    }),
    true,
  );
});

test("entry detail visibility blocks unrelated guardian from athlete entries", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "guardian-1",
    assignments: [assignment({ roleType: RoleType.PARENT_GUARDIAN })],
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  });

  assert.equal(
    canReadEntryOpsEntryDetail(visibility, {
      createdByPersonId: "athlete-2",
      assignedToPersonId: null,
      teamId: null,
    }),
    false,
  );
});

test("entry detail visibility allows org admin access organization-wide", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "admin-1",
    assignments: [assignment({ roleType: RoleType.ORGANIZATION_ADMIN })],
    linkedGuardianAthleteIds: new Set(),
  });

  assert.equal(
    canReadEntryOpsEntryDetail(visibility, {
      createdByPersonId: "member-1",
      assignedToPersonId: null,
      teamId: null,
    }),
    true,
  );
  assert.deepEqual(buildEntryOpsEntryDetailVisibilityWhere(visibility), {});
});

test("entry detail visibility allows program director scoped program and team entries", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "program-1",
    assignments: [
      assignment({
        roleType: RoleType.PROGRAM_DIRECTOR,
        scopeType: ScopeType.PROGRAM,
        programId: "program-a",
      }),
      assignment({
        roleType: RoleType.PROGRAM_DIRECTOR,
        scopeType: ScopeType.TEAM,
        teamId: "team-a",
      }),
    ],
    linkedGuardianAthleteIds: new Set(),
  });

  assert.equal(
    canReadEntryOpsEntryDetail(visibility, {
      createdByPersonId: "member-1",
      assignedToPersonId: null,
      teamId: "team-a",
    }),
    true,
  );
  assert.equal(
    canReadEntryOpsEntryDetail(visibility, {
      createdByPersonId: "member-2",
      assignedToPersonId: null,
      teamId: "team-b",
      team: { programId: "program-a" },
    }),
    true,
  );
});

test("entry detail visibility allows active assignment relationship access", () => {
  const visibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "member-1",
    assignments: [],
    linkedGuardianAthleteIds: new Set(),
  });

  assert.equal(
    canReadEntryOpsEntryDetail(visibility, {
      createdByPersonId: "member-2",
      assignedToPersonId: null,
      teamId: null,
      assignments: [{ personId: "member-1", revokedAt: null }],
    }),
    true,
  );
  assert.equal(
    canReadEntryOpsEntryDetail(visibility, {
      createdByPersonId: "member-2",
      assignedToPersonId: null,
      teamId: null,
      assignments: [{ personId: "member-1", revokedAt: new Date("2026-01-01T00:00:00.000Z") }],
    }),
    false,
  );
});

test("entry self-edit allows athlete owner independent of active persona", () => {
  assert.equal(
    canSelfEditEntryOpsEntry(
      { actorPersonId: "athlete-1" },
      {
        createdByPersonId: "athlete-1",
        assignedToPersonId: null,
        teamId: null,
      },
    ),
    true,
  );
});

test("entry self-edit allows limited owner", () => {
  assert.equal(
    canSelfEditEntryOpsEntry(
      { actorPersonId: "limited-1" },
      {
        createdByPersonId: "limited-1",
        assignedToPersonId: null,
        teamId: null,
      },
    ),
    true,
  );
});

test("entry self-edit allows direct assignee and active assignment participant", () => {
  assert.equal(
    canSelfEditEntryOpsEntry(
      { actorPersonId: "assignee-1" },
      {
        createdByPersonId: "owner-1",
        assignedToPersonId: "assignee-1",
        teamId: null,
      },
    ),
    true,
  );

  assert.equal(
    canSelfEditEntryOpsEntry(
      { actorPersonId: "participant-1" },
      {
        createdByPersonId: "owner-1",
        assignedToPersonId: null,
        teamId: null,
        assignments: [{ personId: "participant-1", revokedAt: null }],
      },
    ),
    true,
  );
});

test("entry self-edit blocks unrelated athlete and revoked assignment participant", () => {
  assert.equal(
    canSelfEditEntryOpsEntry(
      { actorPersonId: "athlete-2" },
      {
        createdByPersonId: "athlete-1",
        assignedToPersonId: null,
        teamId: null,
      },
    ),
    false,
  );

  assert.equal(
    canSelfEditEntryOpsEntry(
      { actorPersonId: "participant-1" },
      {
        createdByPersonId: "owner-1",
        assignedToPersonId: null,
        teamId: null,
        assignments: [{ personId: "participant-1", revokedAt: new Date("2026-01-01T00:00:00.000Z") }],
      },
    ),
    false,
  );
});

test("entry self-edit does not grant guardian dependent edit access", () => {
  assert.equal(
    canSelfEditEntryOpsEntry(
      { actorPersonId: "guardian-1" },
      {
        createdByPersonId: "athlete-1",
        assignedToPersonId: null,
        teamId: null,
      },
    ),
    false,
  );
});

test("entry edit decision allows org admin write access to another entry", () => {
  assert.equal(
    canEditEntryOpsEntry({
      canWriteEntries: true,
      context: { actorPersonId: "admin-1" },
      entry: {
        createdByPersonId: "member-1",
        assignedToPersonId: null,
        teamId: null,
      },
    }),
    true,
  );
});

test("entry edit decision blocks unrelated non-writer", () => {
  assert.equal(
    canEditEntryOpsEntry({
      canWriteEntries: false,
      context: { actorPersonId: "athlete-2" },
      entry: {
        createdByPersonId: "athlete-1",
        assignedToPersonId: null,
        teamId: null,
      },
    }),
    false,
  );
});

test("entry access decision distinguishes not found from visibility denied without changing safe user copy", () => {
  const context = {
    actorPersonId: "athlete-1",
    assignments: [assignment({ roleType: RoleType.ATHLETE })],
    linkedGuardianAthleteIds: new Set<string>(),
  };
  const visibility = resolveEntryOpsAllWorkDefaultVisibility(context);

  assert.equal(resolveEntryOpsDetailAccessDecision(context, visibility, null).reasonCode, "ENTRY_NOT_FOUND");
  assert.equal(
    resolveEntryOpsDetailAccessDecision(context, visibility, {
      createdByPersonId: "athlete-2",
      assignedToPersonId: null,
      teamId: null,
    }).reasonCode,
    "ENTRY_VISIBILITY_DENIED",
  );
  assert.match(ENTRY_NOT_FOUND_OR_ACCESS_DENIED_MESSAGE, /could not be found or you do not have access/i);
});

test("entry access decision reports owner and assignee access", () => {
  const context = {
    actorPersonId: "athlete-1",
    assignments: [assignment({ roleType: RoleType.ATHLETE })],
    linkedGuardianAthleteIds: new Set<string>(),
  };
  const visibility = resolveEntryOpsAllWorkDefaultVisibility(context);

  assert.equal(
    resolveEntryOpsDetailAccessDecision(context, visibility, {
      createdByPersonId: "athlete-1",
      assignedToPersonId: null,
      teamId: null,
    }).reasonCode,
    "ENTRY_OWNER_ACCESS",
  );
  assert.equal(
    resolveEntryOpsDetailAccessDecision(context, visibility, {
      createdByPersonId: "coach-1",
      assignedToPersonId: "athlete-1",
      teamId: null,
    }).reasonCode,
    "ENTRY_ASSIGNEE_ACCESS",
  );
});

test("entry access decision reports guardian dependent and org admin access", () => {
  const guardianContext = {
    actorPersonId: "guardian-1",
    assignments: [assignment({ roleType: RoleType.PARENT_GUARDIAN })],
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  };
  const guardianVisibility = resolveEntryOpsAllWorkDefaultVisibility(guardianContext);
  assert.equal(
    resolveEntryOpsDetailAccessDecision(guardianContext, guardianVisibility, {
      createdByPersonId: "athlete-1",
      assignedToPersonId: null,
      teamId: null,
    }).reasonCode,
    "GUARDIAN_DEPENDENT_SCOPE_APPLIED",
  );

  const adminContext = {
    actorPersonId: "admin-1",
    assignments: [assignment({ roleType: RoleType.ORGANIZATION_ADMIN })],
    linkedGuardianAthleteIds: new Set<string>(),
  };
  const adminVisibility = resolveEntryOpsAllWorkDefaultVisibility(adminContext);
  assert.equal(
    resolveEntryOpsDetailAccessDecision(adminContext, adminVisibility, {
      createdByPersonId: "athlete-2",
      assignedToPersonId: null,
      teamId: null,
    }).reasonCode,
    "ORG_ADMIN_OVERRIDE_APPLIED",
  );
});

test("entry access decision reports missing guardian, elevated, and assignment relationships", () => {
  const guardianContext = {
    actorPersonId: "guardian-1",
    assignments: [assignment({ roleType: RoleType.PARENT_GUARDIAN })],
    linkedGuardianAthleteIds: new Set(["athlete-1"]),
  };
  assert.equal(
    resolveEntryOpsDetailAccessDecision(
      guardianContext,
      resolveEntryOpsAllWorkDefaultVisibility(guardianContext),
      { createdByPersonId: "athlete-2", assignedToPersonId: null, teamId: null },
    ).reasonCode,
    "GUARDIAN_DEPENDENT_SCOPE_MISSING",
  );

  const directorContext = {
    actorPersonId: "director-1",
    assignments: [assignment({ roleType: RoleType.PROGRAM_DIRECTOR, scopeType: ScopeType.PROGRAM, programId: "program-1" })],
    linkedGuardianAthleteIds: new Set<string>(),
  };
  assert.equal(
    resolveEntryOpsDetailAccessDecision(
      directorContext,
      resolveEntryOpsAllWorkDefaultVisibility(directorContext),
      { createdByPersonId: "athlete-2", assignedToPersonId: null, teamId: "team-2", team: { programId: "program-2" } },
    ).reasonCode,
    "ELEVATED_SCOPE_MISSING",
  );

  const athleteContext = {
    actorPersonId: "athlete-1",
    assignments: [assignment({ roleType: RoleType.ATHLETE })],
    linkedGuardianAthleteIds: new Set<string>(),
  };
  assert.equal(
    resolveEntryOpsDetailAccessDecision(
      athleteContext,
      resolveEntryOpsAllWorkDefaultVisibility(athleteContext),
      {
        createdByPersonId: "athlete-2",
        assignedToPersonId: null,
        teamId: null,
        assignments: [{ personId: "athlete-3", revokedAt: null }],
      },
    ).reasonCode,
    "ENTRY_ASSIGNMENT_MISSING",
  );
});

test("entry action denied message clearly distinguishes visible-but-not-allowed actions", () => {
  assert.equal(
    entryActionDeniedMessage("archive this work item"),
    "You can view this work item, but you do not have permission to archive this work item.",
  );
});
