import { strict as assert } from "node:assert";
import test from "node:test";
import { EntryStatus } from "@prisma/client";

import { buildEntryLifecycleWhere, resolveEntryRestoreStatus } from "../../lib/entries/lifecycle";

test("default Entry lifecycle query includes every non-archived active workflow state", () => {
  assert.deepEqual(buildEntryLifecycleWhere(), {
    status: { not: EntryStatus.ARCHIVED },
    deletedAt: null,
  });
});

test("explicit archived query includes historical archives that also have deletedAt set", () => {
  assert.deepEqual(buildEntryLifecycleWhere(EntryStatus.ARCHIVED), {
    status: EntryStatus.ARCHIVED,
  });
});

test("explicit non-archived status remains limited to current records", () => {
  assert.deepEqual(buildEntryLifecycleWhere(EntryStatus.DONE), {
    status: EntryStatus.DONE,
    deletedAt: null,
  });
});

test("restore returns the pre-archive workflow status and safely falls back to Open", () => {
  assert.equal(resolveEntryRestoreStatus(EntryStatus.DONE), EntryStatus.DONE);
  assert.equal(resolveEntryRestoreStatus(EntryStatus.IN_PROGRESS), EntryStatus.IN_PROGRESS);
  assert.equal(resolveEntryRestoreStatus(null), EntryStatus.OPEN);
  assert.equal(resolveEntryRestoreStatus(EntryStatus.ARCHIVED), EntryStatus.OPEN);
});
