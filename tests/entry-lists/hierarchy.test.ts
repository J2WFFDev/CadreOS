import { strict as assert } from "node:assert";
import test from "node:test";

import { EntryListScope, RoleType, ScopeType } from "@prisma/client";

import { buildEntryListHierarchy, buildEntryListVisibilityForActor, type EntryListSummary } from "../../lib/entries/lists";
import {
  buildEntryOpsEntryDetailVisibilityWhere,
  resolveEntryOpsAllWorkDefaultVisibility,
} from "../../lib/entryops/visibility";

function list(input: Partial<EntryListSummary> & Pick<EntryListSummary, "id" | "name" | "scope">): EntryListSummary {
  return {
    isInbox: false,
    isArchived: false,
    ownerPersonId: null,
    programId: null,
    teamId: null,
    ...input,
  };
}

function scopedVisibility() {
  return buildEntryListVisibilityForActor({
    organizationId: "org-1",
    actorPersonId: "coach-1",
    assignments: [
      {
        roleType: RoleType.COACH,
        scopeType: ScopeType.TEAM,
        programId: null,
        teamId: "team-z",
      },
    ],
  });
}

test("hierarchy shows connected Program and Team containers in alphabetical order", () => {
  const hierarchy = buildEntryListHierarchy({
    visibility: scopedVisibility(),
    lists: [
      list({ id: "personal-z", name: "Zeta", scope: EntryListScope.PERSONAL, ownerPersonId: "coach-1" }),
      list({ id: "personal-a", name: "Alpha", scope: EntryListScope.PERSONAL, ownerPersonId: "coach-1" }),
      list({ id: "team-z-list", name: "Team Inbox", scope: EntryListScope.TEAM, teamId: "team-z" }),
    ],
    programs: [
      { id: "program-z", name: "Zebra Program" },
      { id: "program-a", name: "Alpha Program" },
    ],
    teams: [
      { id: "team-z", name: "Zulu Team", programId: "program-z" },
      { id: "team-a", name: "Alpha Team", programId: "program-z" },
    ],
  });

  assert.deepEqual(hierarchy.personalLists.map((item) => item.name), ["Alpha", "Zeta"]);
  assert.deepEqual(hierarchy.programs.map((program) => program.name), ["Zebra Program"]);
  assert.deepEqual(hierarchy.programs[0]?.teams.map((team) => team.name), ["Zulu Team"]);
});

test("program-scoped hierarchy shows all teams in the connected Program and preserves archived lists", () => {
  const visibility = buildEntryListVisibilityForActor({
    organizationId: "org-1",
    actorPersonId: "director-1",
    assignments: [
      {
        roleType: RoleType.PROGRAM_DIRECTOR,
        scopeType: ScopeType.PROGRAM,
        programId: "program-1",
        teamId: null,
      },
    ],
  });
  const hierarchy = buildEntryListHierarchy({
    visibility,
    lists: [
      list({
        id: "archived-list",
        name: "Prior Season",
        scope: EntryListScope.TEAM,
        teamId: "team-b",
        isArchived: true,
      }),
    ],
    programs: [{ id: "program-1", name: "Program One" }],
    teams: [
      { id: "team-b", name: "Beta", programId: "program-1" },
      { id: "team-a", name: "Alpha", programId: "program-1" },
    ],
  });

  assert.deepEqual(hierarchy.programs[0]?.teams.map((team) => team.name), ["Alpha", "Beta"]);
  assert.equal(hierarchy.programs[0]?.teams[1]?.lists[0]?.isArchived, true);
});

test("Admin shared containers are hidden from scoped users and shown to Org Admin", () => {
  const sharedList = list({ id: "admin-list", name: "GearOps", scope: EntryListScope.ORGANIZATION });
  const base = {
    lists: [sharedList],
    programs: [],
    teams: [],
  };

  assert.deepEqual(buildEntryListHierarchy({ visibility: scopedVisibility(), ...base }).adminSharedLists, []);

  const adminVisibility = buildEntryListVisibilityForActor({
    organizationId: "org-1",
    actorPersonId: "admin-1",
    assignments: [
      {
        roleType: RoleType.ORGANIZATION_ADMIN,
        scopeType: ScopeType.ORGANIZATION,
        programId: null,
        teamId: null,
      },
    ],
  });
  assert.deepEqual(buildEntryListHierarchy({ visibility: adminVisibility, ...base }).adminSharedLists, [sharedList]);
});

test("Program and Team container placement does not grant Entry visibility", () => {
  const entryVisibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "coach-1",
    assignments: [
      {
        roleType: RoleType.COACH,
        scopeType: ScopeType.TEAM,
        programId: "program-1",
        teamId: "team-1",
      },
    ],
    linkedGuardianAthleteIds: new Set(),
  });

  assert.deepEqual(buildEntryOpsEntryDetailVisibilityWhere(entryVisibility), {
    OR: [
      { createdByPersonId: { in: ["coach-1"] } },
      { assignedToPersonId: { in: ["coach-1"] } },
      { assignments: { some: { personId: { in: ["coach-1"] }, revokedAt: null } } },
    ],
  });
});
