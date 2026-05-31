import { strict as assert } from "node:assert";
import test from "node:test";

import {
  canWriteRelationshipSource,
  createFoundationRelationship,
  isFoundationRelationshipNodeType,
  isFoundationRelationshipType,
  labelForRelationshipDirection,
  normalizeFoundationRelationship,
  searchRelationshipTargets,
} from "../../lib/entry-relationships";

test("relationship labels render outbound and inverse directions", () => {
  assert.equal(labelForRelationshipDirection("BLOCKS", "OUTBOUND"), "Blocks");
  assert.equal(labelForRelationshipDirection("BLOCKS", "INBOUND"), "Blocked by");
  assert.equal(labelForRelationshipDirection("FOLLOW_UP_FOR", "OUTBOUND"), "Follow-up for");
  assert.equal(labelForRelationshipDirection("FOLLOW_UP_FOR", "INBOUND"), "Has follow-up");
});

test("normalizeFoundationRelationship canonicalizes BLOCKED_BY and symmetric relationships", () => {
  const blockedBy = normalizeFoundationRelationship({
    from: { nodeType: "ENTRY", nodeId: "task-b" },
    to: { nodeType: "ENTRY", nodeId: "task-a" },
    relationshipType: "BLOCKED_BY",
  });

  assert.deepEqual(blockedBy, {
    from: { nodeType: "ENTRY", nodeId: "task-a" },
    to: { nodeType: "ENTRY", nodeId: "task-b" },
    relationshipType: "BLOCKS",
  });

  const relatedTo = normalizeFoundationRelationship({
    from: { nodeType: "ENTRY", nodeId: "z-item" },
    to: { nodeType: "ENTRY", nodeId: "a-item" },
    relationshipType: "RELATED_TO",
  });

  assert.deepEqual(relatedTo, {
    from: { nodeType: "ENTRY", nodeId: "a-item" },
    to: { nodeType: "ENTRY", nodeId: "z-item" },
    relationshipType: "RELATED_TO",
  });
});

test("relationship helpers expose supported creation types", () => {
  assert.equal(isFoundationRelationshipType("SUPPORTS"), true);
  assert.equal(isFoundationRelationshipType("IMPACTS"), false);
  assert.equal(isFoundationRelationshipNodeType("ENTRY"), true);
  assert.equal(isFoundationRelationshipNodeType("HABIT"), true);
  assert.equal(isFoundationRelationshipNodeType("TEAM"), false);
});

test("createFoundationRelationship rejects missing actor context", async () => {
  await assert.rejects(
    createFoundationRelationship({
      organizationId: "org-1",
      actorPersonId: null,
      from: { nodeType: "ENTRY", nodeId: "entry-1" },
      to: { nodeType: "ENTRY", nodeId: "entry-2" },
      relationshipType: "RELATED_TO",
    }),
    /authenticated actor/i,
  );
});

test("canWriteRelationshipSource returns false without an actor", async () => {
  const allowed = await canWriteRelationshipSource({
    organizationId: "org-1",
    actorPersonId: null,
    source: { nodeType: "ENTRY", nodeId: "entry-1" },
  });

  assert.equal(allowed, false);
});

test("searchRelationshipTargets hides entry targets when actor cannot read entries", async () => {
  const targets = await searchRelationshipTargets({
    organizationId: "org-1",
    actorPersonId: null,
    source: { nodeType: "ENTRY", nodeId: "entry-1" },
    targetNodeType: "ENTRY",
    query: "decision",
  });

  assert.deepEqual(targets, []);
});
