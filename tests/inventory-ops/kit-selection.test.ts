import { strict as assert } from "node:assert";
import test from "node:test";

import { resolveKitChildSelection } from "../../lib/inventory-ops/service";

test("resolveKitChildSelection defaults to all kit item ids", () => {
  const result = resolveKitChildSelection(["item-a", "item-b", "item-c"]);

  assert.deepEqual(result.targetItemIds, ["item-a", "item-b", "item-c"]);
  assert.equal(result.isPartial, false);
});

test("resolveKitChildSelection keeps only requested members in kit order", () => {
  const result = resolveKitChildSelection(["item-a", "item-b", "item-c"], [
    "item-c",
    "item-c",
    "item-a",
    "item-x",
  ]);

  assert.deepEqual(result.targetItemIds, ["item-a", "item-c"]);
  assert.equal(result.isPartial, true);
});

test("resolveKitChildSelection treats explicit full selection as non-partial", () => {
  const result = resolveKitChildSelection(["item-a", "item-b"], ["item-b", "item-a"]);

  assert.deepEqual(result.targetItemIds, ["item-a", "item-b"]);
  assert.equal(result.isPartial, false);
});

test("resolveKitChildSelection keeps explicit empty selection as partial", () => {
  const result = resolveKitChildSelection(["item-a", "item-b"], []);

  assert.deepEqual(result.targetItemIds, []);
  assert.equal(result.isPartial, true);
});
