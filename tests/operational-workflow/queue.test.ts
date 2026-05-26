import { strict as assert } from "node:assert";
import test from "node:test";

import { buildQueueFilter } from "../../lib/operational-workflow/queue";

// ── buildQueueFilter ────────────────────────────────────────────────────────

test("buildQueueFilter applies defaults for empty params", () => {
  const filter = buildQueueFilter("org-1", {});
  assert.equal(filter.organizationId, "org-1");
  assert.equal(filter.assignedToPersonId, null);
  assert.equal(filter.teamId, null);
  assert.deepEqual(filter.entryTypes, []);
  assert.deepEqual(filter.statuses, ["OPEN", "IN_PROGRESS"]);
  assert.equal(filter.overdueOnly, false);
  assert.equal(filter.limit, 50);
});

test("buildQueueFilter forwards assignedToPersonId", () => {
  const filter = buildQueueFilter("org-1", { assignedToPersonId: "person-42" });
  assert.equal(filter.assignedToPersonId, "person-42");
});

test("buildQueueFilter forwards teamId", () => {
  const filter = buildQueueFilter("org-1", { teamId: "team-7" });
  assert.equal(filter.teamId, "team-7");
});

test("buildQueueFilter forwards entryTypes list", () => {
  const filter = buildQueueFilter("org-1", { entryTypes: ["FOLLOW_UP", "TASK"] });
  assert.deepEqual(filter.entryTypes, ["FOLLOW_UP", "TASK"]);
});

test("buildQueueFilter forwards overdueOnly flag", () => {
  const filter = buildQueueFilter("org-1", { overdueOnly: true });
  assert.equal(filter.overdueOnly, true);
});

test("buildQueueFilter forwards custom limit", () => {
  const filter = buildQueueFilter("org-1", { limit: 20 });
  assert.equal(filter.limit, 20);
});

test("buildQueueFilter treats null assignedToPersonId as null", () => {
  const filter = buildQueueFilter("org-1", { assignedToPersonId: null });
  assert.equal(filter.assignedToPersonId, null);
});
