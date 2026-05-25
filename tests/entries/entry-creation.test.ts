import { strict as assert } from "node:assert";
import test from "node:test";

import { TaskStatus } from "@prisma/client";

import { buildTaskEntryProjection } from "../../lib/entries/service";

test("entry projection maps dueAt and status for open tasks", () => {
  const dueAt = new Date("2026-05-25T16:30:00.000Z");
  const projection = buildTaskEntryProjection({ dueAt, status: TaskStatus.OPEN });

  assert.equal(projection.status, "OPEN");
  assert.equal(projection.taskCompleted, false);
  assert.equal(projection.dueDate?.toISOString(), "2026-05-25T00:00:00.000Z");
  assert.equal(projection.dueTime, "16:30");
});

test("entry projection marks done tasks completed", () => {
  const projection = buildTaskEntryProjection({ dueAt: null, status: TaskStatus.DONE });
  assert.equal(projection.status, "DONE");
  assert.equal(projection.taskCompleted, true);
});
