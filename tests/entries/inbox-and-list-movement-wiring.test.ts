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
  assert.doesNotMatch(inboxPage, /entryVisibility\.organizationWide \? \{\}/);
});

test("Entry movement picker and update route use authorized destination lists", () => {
  const detailPage = source("../../app/(dashboard)/entries/[entryId]/page.tsx");
  const updateRoute = source("../../app/(dashboard)/entries/[entryId]/update/route.ts");

  assert.match(detailPage, /fetchEntryListDestinationsForActor/);
  assert.match(detailPage, /destinationLists\.map/);
  assert.match(updateRoute, /listVisibility\.destinationWhere/);
  assert.match(updateRoute, /rawListId === entry\.listId/);
});
