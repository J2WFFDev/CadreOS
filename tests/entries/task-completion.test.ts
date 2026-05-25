import { strict as assert } from "node:assert";
import test from "node:test";

import { deriveTaskCompletionUpdate } from "../../lib/entries/service";

test("task completion update returns done status and completed timestamp", () => {
  const now = new Date("2026-05-25T12:00:00.000Z");
  const update = deriveTaskCompletionUpdate(now);

  assert.equal(update.status, "DONE");
  assert.equal(update.taskCompleted, true);
  assert.equal(update.completedAt.toISOString(), now.toISOString());
});
