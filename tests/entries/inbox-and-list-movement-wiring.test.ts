import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

test("normal Inbox is always actor-scoped even for organization admins", () => {
  const inboxPage = source("../../app/(dashboard)/entries/inbox/page.tsx");

  assert.match(inboxPage, /ownerPersonId: scope\.auth\.personId/);
  assert.match(inboxPage, /status: \{ not: EntryStatus\.ARCHIVED \}/);
  assert.match(inboxPage, />Assigned to<\/th>/);
  assert.doesNotMatch(inboxPage, />Owner<\/th>/);
  assert.doesNotMatch(inboxPage, /entryVisibility\.organizationWide \? \{\}/);
});

test("Entry movement picker and update route use authorized destination lists", () => {
  const detailPage = source("../../app/(dashboard)/entries/[entryId]/page.tsx");
  const updateRoute = source("../../app/(dashboard)/entries/[entryId]/update/route.ts");
  const listDetailPage = source("../../app/(dashboard)/lists/[listId]/page.tsx");

  assert.match(detailPage, /fetchEntryListDestinationsForActor/);
  assert.match(detailPage, /destinationLists\.map/);
  assert.match(updateRoute, /listVisibility\.destinationWhere/);
  assert.match(updateRoute, /rawListId === entry\.listId/);
  assert.match(detailPage, /Context organizes the Entry\. Visibility controls who can see it\. Assignment controls who is responsible\./);
  assert.match(detailPage, /labelForEntryListContext/);
  assert.match(updateRoute, /\.\.\.\(resolvedListId !== undefined \? \{ listId: resolvedListId \} : \{\}\)/);
  assert.match(listDetailPage, /status: \{ not: EntryStatus\.ARCHIVED \}/);
});
