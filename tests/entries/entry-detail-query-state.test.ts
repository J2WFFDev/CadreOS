import { strict as assert } from "node:assert";
import test from "node:test";

import { readFirstSearchParam, shouldShowQuickCaptureSuccessBanner } from "../../lib/entries/entry-detail-query-state";

test("readFirstSearchParam returns scalar values and the first array value", () => {
  assert.equal(readFirstSearchParam("1"), "1");
  assert.equal(readFirstSearchParam(["1", "0"]), "1");
  assert.equal(readFirstSearchParam(undefined), undefined);
});

test("shouldShowQuickCaptureSuccessBanner is strict to quickCaptured=1", () => {
  assert.equal(shouldShowQuickCaptureSuccessBanner("1"), true);
  assert.equal(shouldShowQuickCaptureSuccessBanner("0"), false);
  assert.equal(shouldShowQuickCaptureSuccessBanner("true"), false);
  assert.equal(shouldShowQuickCaptureSuccessBanner(undefined), false);
});
