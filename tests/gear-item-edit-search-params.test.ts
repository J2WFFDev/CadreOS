import assert from "node:assert/strict";
import test from "node:test";

import { readSearchParam } from "@/app/(dashboard)/gear-ops/items/[itemId]/edit/page";

test("readSearchParam returns undefined when param is missing", () => {
  assert.equal(readSearchParam({}, "notes"), undefined);
});

test("readSearchParam preserves empty string when param is present", () => {
  assert.equal(readSearchParam({ notes: "" }, "notes"), "");
});
