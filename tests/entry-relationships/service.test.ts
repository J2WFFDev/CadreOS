import { strict as assert } from "node:assert";
import test, { mock } from "node:test";

import { db } from "../../lib/db";
import { listFoundationRelationships, removeFoundationRelationship } from "../../lib/entry-relationships";

test("listFoundationRelationships does not leak unreadable entry targets", async (t) => {
  const findManyMock = mock.method(db.operationalRelationship, "findMany", async () => [
    {
      id: "rel-1",
      fromNodeType: "ENTRY",
      fromNodeId: "source-entry",
      toNodeType: "ENTRY",
      toNodeId: "hidden-entry",
      relationshipType: "RELATED_TO",
      metadataJson: JSON.stringify({ note: "secret" }),
    },
  ]);
  const entryFindFirstMock = mock.method(db.entry, "findFirst", async () => ({
    id: "hidden-entry",
    type: "TASK",
    title: "Hidden task",
    status: "OPEN",
    visibility: "STAFF_ONLY",
    teamId: null,
    createdByPersonId: "person-1",
    team: null,
  }));

  t.after(() => {
    findManyMock.mock.restore();
    entryFindFirstMock.mock.restore();
  });

  const items = await listFoundationRelationships({
    organizationId: "org-1",
    actorPersonId: null,
    source: { nodeType: "ENTRY", nodeId: "source-entry" },
  });

  assert.deepEqual(items, []);
});

test("removeFoundationRelationship returns null when no active relationship exists", async (t) => {
  const findFirstMock = mock.method(db.operationalRelationship, "findFirst", async () => null);

  t.after(() => {
    findFirstMock.mock.restore();
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
