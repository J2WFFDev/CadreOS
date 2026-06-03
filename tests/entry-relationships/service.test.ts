import { strict as assert } from "node:assert";
import test from "node:test";
import { HabitStatus, OperationalGraphNodeType, OperationalRelationshipType, RoleType, ScopeType } from "@prisma/client";

import { db } from "../../lib/db";
import {
  listFoundationRelationships,
  listReviewLinkedHabitContextForEntries,
  removeFoundationRelationship,
} from "../../lib/entry-relationships";

test("listFoundationRelationships does not leak unreadable entry targets", async (t) => {
  const originalFindMany = db.operationalRelationship.findMany;
  const originalEntryFindFirst = db.entry.findFirst;

  db.operationalRelationship.findMany = ((async () => [
    {
      id: "rel-1",
      fromNodeType: "ENTRY",
      fromNodeId: "source-entry",
      toNodeType: "ENTRY",
      toNodeId: "hidden-entry",
      relationshipType: "RELATED_TO",
      metadataJson: JSON.stringify({ note: "secret" }),
    },
  ]) as unknown) as typeof db.operationalRelationship.findMany;
  db.entry.findFirst = ((async () => ({
    id: "hidden-entry",
    type: "TASK",
    title: "Hidden task",
    status: "OPEN",
    visibility: "STAFF_ONLY",
    teamId: null,
    createdByPersonId: "person-1",
    team: null,
  })) as unknown) as typeof db.entry.findFirst;

  t.after(() => {
    db.operationalRelationship.findMany = originalFindMany;
    db.entry.findFirst = originalEntryFindFirst;
  });

  const items = await listFoundationRelationships({
    organizationId: "org-1",
    actorPersonId: null,
    source: { nodeType: "ENTRY", nodeId: "source-entry" },
  });

  assert.deepEqual(items, []);
});

test("removeFoundationRelationship returns null when no active relationship exists", async (t) => {
  const originalFindFirst = db.operationalRelationship.findFirst;

  db.operationalRelationship.findFirst = ((async () => null) as unknown) as typeof db.operationalRelationship.findFirst;

  t.after(() => {
    db.operationalRelationship.findFirst = originalFindFirst;
  });

  const result = await removeFoundationRelationship({
    organizationId: "org-1",
    actorPersonId: "person-1",
    from: { nodeType: "ENTRY", nodeId: "entry-1" },
    to: { nodeType: "HABIT", nodeId: "habit-1" },
    relationshipType: "SUPPORTS",
  });

  assert.equal(result, null);
});

test("listReviewLinkedHabitContextForEntries groups readable habit links by entry", async (t) => {
  const originalRelationshipFindMany = db.operationalRelationship.findMany;
  const originalHabitFindMany = db.habit.findMany;
  const originalRoleAssignmentFindMany = db.roleAssignment.findMany;

  db.operationalRelationship.findMany = ((async () => [
    {
      id: "rel-1",
      fromNodeType: OperationalGraphNodeType.ENTRY,
      fromNodeId: "entry-1",
      toNodeType: OperationalGraphNodeType.HABIT,
      toNodeId: "habit-1",
      relationshipType: OperationalRelationshipType.SUPPORTS,
      metadataJson: JSON.stringify({ note: "Review training consistency" }),
    },
  ]) as unknown) as typeof db.operationalRelationship.findMany;
  db.habit.findMany = ((async () => [
    {
      id: "habit-1",
      title: "Morning mobility",
      status: HabitStatus.ACTIVE,
      athletePersonId: "athlete-1",
      assignedToTeamId: null,
      createdByPersonId: "person-1",
      assignedToTeam: null,
    },
  ]) as unknown) as typeof db.habit.findMany;
  db.roleAssignment.findMany = ((async () => [
    {
      roleType: RoleType.ORGANIZATION_ADMIN,
      scopeType: ScopeType.ORGANIZATION,
      teamId: null,
      programId: null,
    },
  ]) as unknown) as typeof db.roleAssignment.findMany;

  t.after(() => {
    db.operationalRelationship.findMany = originalRelationshipFindMany;
    db.habit.findMany = originalHabitFindMany;
    db.roleAssignment.findMany = originalRoleAssignmentFindMany;
  });

  const result = await listReviewLinkedHabitContextForEntries({
    organizationId: "org-1",
    actorPersonId: "person-1",
    entryIds: ["entry-1"],
  });

  assert.equal(result["entry-1"]?.length, 1);
  assert.equal(result["entry-1"]?.[0]?.relationshipLabel, "Supports");
  assert.equal(result["entry-1"]?.[0]?.habit.title, "Morning mobility");
  assert.equal(result["entry-1"]?.[0]?.habit.href, "/habits/habit-1");
  assert.equal(result["entry-1"]?.[0]?.note, "Review training consistency");
});
