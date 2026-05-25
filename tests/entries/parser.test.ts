import { strict as assert } from "node:assert";
import test from "node:test";

import { parseQuickAddEntryInput } from "../../lib/entries/parser";

test("parser infers task when date or action language is present", () => {
  const result = parseQuickAddEntryInput("Follow up with team tomorrow at 9am #ops @coach");
  assert.equal(result.inferredType, "TASK");
  assert.equal(result.tags.includes("ops"), true);
  assert.equal(result.assigneeHandle, "coach");
  assert.equal(result.dueTime, "09:00");
});

test("parser defaults to note for freeform text without task signals", () => {
  const result = parseQuickAddEntryInput("General observation from practice and athlete behavior trends");
  assert.equal(result.inferredType, "NOTE");
  assert.equal(result.dueDate, null);
  assert.equal(result.recurrenceRule, null);
});
