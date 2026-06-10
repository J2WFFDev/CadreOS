import { strict as assert } from "node:assert";
import test from "node:test";

import { EntryListScope, RoleType, ScopeType } from "@prisma/client";

import {
  buildDefaultInboxListResolutionInput,
  buildEntryListVisibilityForActor,
  DEFAULT_PERSONAL_LIST_NAMES,
  labelForEntryListContext,
  sortPersonalEntryLists,
} from "../../lib/entries/lists";

function assignment(
  roleType: RoleType,
  scopeType: ScopeType,
  programId: string | null = null,
  teamId: string | null = null,
) {
  return { roleType, scopeType, programId, teamId };
}

test("buildDefaultInboxListResolutionInput prefers team Inbox when team scope is present", () => {
  assert.deepEqual(
    buildDefaultInboxListResolutionInput({
      organizationId: "org-1",
      actorPersonId: "person-1",
      teamId: "team-1",
    }),
    {
      scope: "TEAM",
      organizationId: "org-1",
      teamId: "team-1",
    },
  );
});

test("buildDefaultInboxListResolutionInput uses personal Inbox for actor-scoped entries", () => {
  assert.deepEqual(
    buildDefaultInboxListResolutionInput({
      organizationId: "org-1",
      actorPersonId: "person-1",
    }),
    {
      scope: "PERSONAL",
      organizationId: "org-1",
      ownerPersonId: "person-1",
    },
  );
});

test("buildDefaultInboxListResolutionInput falls back to organization Inbox without actor or team", () => {
  assert.deepEqual(
    buildDefaultInboxListResolutionInput({
      organizationId: "org-1",
      actorPersonId: null,
      teamId: null,
    }),
    {
      scope: "ORGANIZATION",
      organizationId: "org-1",
    },
  );
});

test("entry list visibility allows athlete or limited actor to manage own personal lists only", () => {
  assert.deepEqual(
    buildEntryListVisibilityForActor({
      organizationId: "org-1",
      actorPersonId: "athlete-1",
      assignments: [assignment(RoleType.ATHLETE, ScopeType.ORGANIZATION)],
    }),
    {
      canRead: true,
      canCreatePersonalList: true,
      canManageSharedLists: false,
      organizationWide: false,
      dependentPersonIds: [],
      programIds: [],
      teamIds: [],
      where: {
        organizationId: "org-1",
        OR: [{ scope: "PERSONAL", ownerPersonId: { in: ["athlete-1"] } }],
      },
      destinationWhere: {
        organizationId: "org-1",
        OR: [{ scope: "PERSONAL", ownerPersonId: "athlete-1" }],
      },
    },
  );

  assert.deepEqual(
    buildEntryListVisibilityForActor({
      organizationId: "org-1",
      actorPersonId: "limited-1",
      assignments: [],
    }).where,
    {
      organizationId: "org-1",
      OR: [{ scope: "PERSONAL", ownerPersonId: { in: ["limited-1"] } }],
    },
  );
});

test("entry list visibility keeps unrelated or unlinked actors out", () => {
  const visibility = buildEntryListVisibilityForActor({
    organizationId: "org-1",
    actorPersonId: null,
    assignments: [],
  });

  assert.equal(visibility.canRead, false);
  assert.equal(visibility.canCreatePersonalList, false);
  assert.equal(visibility.canManageSharedLists, false);
  assert.equal(visibility.organizationWide, false);
  assert.deepEqual(visibility.where, { id: "__entry_list_no_actor__" });
  assert.deepEqual(visibility.destinationWhere, { id: "__entry_list_no_actor__" });
});

test("entry list visibility gives org admin shared context without unrelated personal lists", () => {
  assert.deepEqual(
    buildEntryListVisibilityForActor({
      organizationId: "org-1",
      actorPersonId: "admin-1",
      assignments: [assignment(RoleType.ORGANIZATION_ADMIN, ScopeType.ORGANIZATION)],
    }),
    {
      canRead: true,
      canCreatePersonalList: true,
      canManageSharedLists: true,
      organizationWide: true,
      dependentPersonIds: [],
      programIds: [],
      teamIds: [],
      where: {
        organizationId: "org-1",
        OR: [
          { scope: "PERSONAL", ownerPersonId: "admin-1" },
          { scope: { not: "PERSONAL" } },
        ],
      },
      destinationWhere: {
        organizationId: "org-1",
        OR: [
          { scope: "PERSONAL", ownerPersonId: "admin-1" },
          { scope: { not: "PERSONAL" } },
        ],
      },
    },
  );
});

test("default personal lists put protected Inbox first, then Outbox, Knowledge, Practice, and Skills", () => {
  assert.deepEqual(DEFAULT_PERSONAL_LIST_NAMES, ["Inbox", "Outbox", "Knowledge", "Practice", "Skills"]);

  const sorted = sortPersonalEntryLists([
    { id: "custom", name: "Alpha Custom", scope: EntryListScope.PERSONAL, isInbox: false, isArchived: false, ownerPersonId: "person-1", programId: null, teamId: null },
    { id: "skills", name: "Skills", scope: EntryListScope.PERSONAL, isInbox: false, isArchived: false, ownerPersonId: "person-1", programId: null, teamId: null },
    { id: "inbox", name: "Renamed Inbox", scope: EntryListScope.PERSONAL, isInbox: true, isArchived: false, ownerPersonId: "person-1", programId: null, teamId: null },
    { id: "outbox", name: "Outbox", scope: EntryListScope.PERSONAL, isInbox: false, isArchived: false, ownerPersonId: "person-1", programId: null, teamId: null },
    { id: "practice", name: "Practice", scope: EntryListScope.PERSONAL, isInbox: false, isArchived: false, ownerPersonId: "person-1", programId: null, teamId: null },
    { id: "knowledge", name: "Knowledge", scope: EntryListScope.PERSONAL, isInbox: false, isArchived: false, ownerPersonId: "person-1", programId: null, teamId: null },
  ]);

  assert.deepEqual(sorted.map((list) => list.id), ["inbox", "outbox", "knowledge", "practice", "skills", "custom"]);
});

test("entry list visibility exposes assigned Program and Team containers without exposing Admin shared lists", () => {
  const visibility = buildEntryListVisibilityForActor({
    organizationId: "org-1",
    actorPersonId: "coach-1",
    assignments: [assignment(RoleType.COACH, ScopeType.TEAM, "program-1", "team-1")],
  });

  assert.equal(visibility.canManageSharedLists, false);
  assert.deepEqual(visibility.programIds, []);
  assert.deepEqual(visibility.teamIds, ["team-1"]);
  assert.deepEqual(visibility.where, {
    organizationId: "org-1",
    OR: [
      { scope: "PERSONAL", ownerPersonId: { in: ["coach-1"] } },
      { scope: "TEAM", teamId: { in: ["team-1"] } },
    ],
  });
  assert.deepEqual(visibility.destinationWhere, {
    organizationId: "org-1",
    OR: [
      { scope: "PERSONAL", ownerPersonId: "coach-1" },
      { scope: "TEAM", teamId: { in: ["team-1"] } },
    ],
  });
});

test("guardian-derived context exposes dependent Program and Team containers only", () => {
  const visibility = buildEntryListVisibilityForActor({
    organizationId: "org-1",
    actorPersonId: "guardian-1",
    assignments: [],
    dependentPersonIds: ["athlete-dependent"],
    derivedProgramIds: ["program-dependent"],
    derivedTeamIds: ["team-dependent"],
  });

  assert.equal(visibility.canManageSharedLists, false);
  assert.equal(visibility.organizationWide, false);
  assert.deepEqual(visibility.programIds, ["program-dependent"]);
  assert.deepEqual(visibility.teamIds, ["team-dependent"]);
  assert.deepEqual(visibility.dependentPersonIds, ["athlete-dependent"]);
  assert.match(JSON.stringify(visibility.where), /athlete-dependent/);
  assert.doesNotMatch(JSON.stringify(visibility.destinationWhere), /athlete-dependent|program-dependent|team-dependent/);
  assert.doesNotMatch(JSON.stringify(visibility.where), /ORGANIZATION/);
  assert.doesNotMatch(JSON.stringify(visibility.where), /unrelated/);
});

test("direct Coach scope remains independent from guardian-derived context", () => {
  const visibility = buildEntryListVisibilityForActor({
    organizationId: "org-1",
    actorPersonId: "coach-guardian-1",
    assignments: [assignment(RoleType.COACH, ScopeType.TEAM, "program-coach", "team-coach")],
    derivedProgramIds: ["program-dependent"],
    derivedTeamIds: ["team-dependent"],
  });

  assert.deepEqual(visibility.programIds, ["program-dependent"]);
  assert.deepEqual(visibility.teamIds, ["team-coach", "team-dependent"]);
});

test("active athlete roster context is an authorized movement destination without broadening guardian destinations", () => {
  const visibility = buildEntryListVisibilityForActor({
    organizationId: "org-1",
    actorPersonId: "athlete-1",
    assignments: [],
    destinationProgramIds: ["program-roster"],
    destinationTeamIds: ["team-roster"],
  });

  assert.match(JSON.stringify(visibility.destinationWhere), /program-roster/);
  assert.match(JSON.stringify(visibility.destinationWhere), /team-roster/);
  assert.doesNotMatch(JSON.stringify(visibility.where), /program-roster|team-roster/);
});

test("entry list visibility includes archived containers but keeps unauthorized Admin shared lists out", () => {
  const athleteVisibility = buildEntryListVisibilityForActor({
    organizationId: "org-1",
    actorPersonId: "athlete-1",
    assignments: [assignment(RoleType.ATHLETE, ScopeType.TEAM, "program-1", "team-1")],
  });

  assert.doesNotMatch(JSON.stringify(athleteVisibility.where), /isArchived/);
  assert.doesNotMatch(JSON.stringify(athleteVisibility.where), /ORGANIZATION/);
});

test("list context labels distinguish Inbox, Personal, Program, Team, and Admin containers", () => {
  const list = (name: string, scope: EntryListScope, isInbox = false) => ({ name, scope, isInbox });

  assert.equal(labelForEntryListContext(list("Inbox", EntryListScope.PERSONAL, true)), "Personal: Inbox");
  assert.equal(labelForEntryListContext(list("Ideas", EntryListScope.PERSONAL)), "Personal: Ideas");
  assert.equal(labelForEntryListContext({ ...list("Inbox", EntryListScope.PERSONAL, true), ownerPersonId: "athlete-1", owner: { firstName: "Avery", lastName: "Athlete" } }, "guardian-1"), "Avery Athlete: Inbox");
  assert.equal(labelForEntryListContext({ ...list("Season Plan", EntryListScope.PROGRAM), program: { name: "Program A" } }), "Program: Program A");
  assert.equal(labelForEntryListContext({ ...list("Practice", EntryListScope.TEAM), team: { name: "Team 1" } }), "Team: Team 1");
  assert.equal(labelForEntryListContext(list("GearOps", EntryListScope.ORGANIZATION)), "Admin: GearOps");
});
