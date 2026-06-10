import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const allWorkItemsPath = fileURLToPath(new URL("../../app/(dashboard)/entries/page.tsx", import.meta.url));

test("All Entries includes Entries, Journals, and active Habit definitions through their access predicates", () => {
  const source = readFileSync(allWorkItemsPath, "utf8");

  assert.match(source, /title="All Entries"/);
  assert.match(source, />Context \/ List<\/th>/);
  assert.match(source, /labelForEntryListContext/);
  assert.match(source, /allWorkDefaultVisibility\.organizationWide/);
  assert.match(source, /oversightLists/);
  assert.match(source, /const ALL_ENTRY_TYPES = Object\.values\(EntryType\)/);
  assert.match(source, /buildEntryOpsTypeAwareVisibilityWhere\(visibilityContext, allWorkDefaultVisibility\)/);
  assert.match(source, /db\.entry\.findMany/);
  assert.match(source, /db\.habit\.findMany/);
  assert.match(source, /canReadHabit/);
  assert.match(source, /resolveAllEntriesHabitStatus\(filter\.status \?\? null\)/);
  assert.match(source, /status: allEntriesHabitStatus/);
  assert.match(source, /buildEntryLifecycleWhere\(filter\.status\)/);
  assert.doesNotMatch(source, /db\.habitCompletion\.findMany|db\.habitActivity\.findMany/);
  assert.doesNotMatch(source, /NON_JOURNAL_ENTRY_TYPES/);
  assert.doesNotMatch(source, /entryType !== EntryType\.JOURNAL/);
  assert.doesNotMatch(source, /Unified tasks, notes, events, decisions, habits, and journals/);
});
