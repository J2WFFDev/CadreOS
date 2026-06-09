import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

test("Journal Library exposes direct Journal creation", () => {
  const journalsPage = source("../../app/(dashboard)/journals/page.tsx");
  const promptLibraryPage = source("../../app/(dashboard)/prompts/page.tsx");

  assert.match(journalsPage, /href="\/journals\/create"/);
  assert.match(journalsPage, /New Journal Entry/);
  assert.match(promptLibraryPage, /canCreateJournal\(accessContext\)/);
  assert.match(promptLibraryPage, /title="Journal Library"/);
  assert.match(promptLibraryPage, /href="\/journals\/create"/);
  assert.match(promptLibraryPage, /New Journal Entry/);
});

test("direct Journal creation saves an OPEN JOURNAL owned by the actor", () => {
  const createPage = source("../../app/(dashboard)/journals/create/page.tsx");
  const saveRoute = source("../../app/(dashboard)/journals/create/save/route.ts");

  assert.doesNotMatch(createPage, /<textarea id="content" name="content" required/);
  assert.match(saveRoute, /type: EntryType\.JOURNAL/);
  assert.match(saveRoute, /status: EntryStatus\.OPEN/);
  assert.match(saveRoute, /createdByPersonId: scope\.auth\.personId/);
  assert.match(saveRoute, /journalStatus: "DRAFT"/);
  assert.doesNotMatch(saveRoute, /if \(!title \|\| !content\)/);
});
