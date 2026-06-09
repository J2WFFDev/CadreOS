import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const allWorkItemsPath = fileURLToPath(new URL("../../app/(dashboard)/entries/page.tsx", import.meta.url));

test("All Work Items includes Journals through the type-aware privacy predicate", () => {
  const source = readFileSync(allWorkItemsPath, "utf8");

  assert.match(source, /const ALL_ENTRY_TYPES = Object\.values\(EntryType\)/);
  assert.match(source, /buildEntryOpsTypeAwareVisibilityWhere\(visibilityContext, allWorkDefaultVisibility\)/);
  assert.doesNotMatch(source, /NON_JOURNAL_ENTRY_TYPES/);
  assert.doesNotMatch(source, /entryType !== EntryType\.JOURNAL/);
});
