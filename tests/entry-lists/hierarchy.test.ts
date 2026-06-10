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
    actorPersonId: "coach-1",
    relatedPeople: [],
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
    actorPersonId: "director-1",
    relatedPeople: [],
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
    actorPersonId: "actor-1",
    relatedPeople: [],
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

test("guardian personal lists are grouped by related athlete instead of blending into Personal", () => {
  const visibility = buildEntryListVisibilityForActor({
    organizationId: "org-1",
    actorPersonId: "guardian-1",
    assignments: [],
    dependentPersonIds: ["athlete-1"],
  });
  const hierarchy = buildEntryListHierarchy({
    visibility,
    actorPersonId: "guardian-1",
    relatedPeople: [{ id: "athlete-1", firstName: "Avery", lastName: "Athlete" }],
    lists: [
      list({ id: "guardian-inbox", name: "Inbox", scope: EntryListScope.PERSONAL, ownerPersonId: "guardian-1", isInbox: true }),
      list({ id: "athlete-inbox", name: "Inbox", scope: EntryListScope.PERSONAL, ownerPersonId: "athlete-1", isInbox: true }),
      list({ id: "athlete-ideas", name: "Sugar Ideas", scope: EntryListScope.PERSONAL, ownerPersonId: "athlete-1" }),
    ],
    programs: [],
    teams: [],
  });

  assert.deepEqual(hierarchy.personalLists.map((item) => item.id), ["guardian-inbox"]);
  assert.deepEqual(hierarchy.relatedAthletes.map((group) => group.name), ["Avery Athlete"]);
  assert.deepEqual(hierarchy.relatedAthletes[0]?.lists.map((item) => item.id), ["athlete-inbox", "athlete-ideas"]);
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
      { entryList: { scope: "PERSONAL", ownerPersonId: { in: ["coach-1"] } } },
    ],
  });
});

test("guardian-derived list hierarchy does not broaden Entry visibility or Journal privacy", () => {
  const listVisibility = buildEntryListVisibilityForActor({
    organizationId: "org-1",
    actorPersonId: "guardian-1",
    assignments: [],
    derivedProgramIds: ["program-dependent"],
    derivedTeamIds: ["team-dependent"],
  });
  const entryVisibility = resolveEntryOpsAllWorkDefaultVisibility({
    actorPersonId: "guardian-1",
    assignments: [],
    linkedGuardianAthleteIds: new Set(),
  });

  assert.deepEqual(listVisibility.programIds, ["program-dependent"]);
  assert.deepEqual(listVisibility.teamIds, ["team-dependent"]);
  assert.deepEqual(buildEntryOpsEntryDetailVisibilityWhere(entryVisibility), {
    OR: [
      { createdByPersonId: { in: ["guardian-1"] } },
      { assignedToPersonId: { in: ["guardian-1"] } },
      { assignments: { some: { personId: { in: ["guardian-1"] }, revokedAt: null } } },
      { entryList: { scope: "PERSONAL", ownerPersonId: { in: ["guardian-1"] } } },
    ],
  });
  assert.deepEqual(entryVisibility.programIds, []);
  assert.deepEqual(entryVisibility.teamIds, []);
  assert.equal(entryVisibility.reason, "Default EntryOps view is limited to the actor's own work.");
});
