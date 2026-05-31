import { strict as assert } from "node:assert";
import test from "node:test";

import { db } from "../../lib/db";
import { listFoundationRelationships, removeFoundationRelationship } from "../../lib/entry-relationships";

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
