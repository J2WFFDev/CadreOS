import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

test("Lists page renders Org, Personal, Admin outline with clickable Program and Team contexts", () => {
  const page = source("../../app/(dashboard)/lists/page.tsx");

  assert.ok(page.indexOf(">Org</h2>") < page.indexOf(">Personal</h2>"));
  assert.ok(page.indexOf(">Personal</h2>") < page.indexOf(">Admin</h2>"));
  assert.match(page, /href=\{`\/programs\/\$\{program\.id\}`\}/);
  assert.match(page, /href=\{`\/teams\/\$\{team\.id\}`\}/);
  assert.doesNotMatch(page, /No lists in this container/);
});

test("Lists page ensures default personal and authorized Admin shared lists", () => {
  const page = source("../../app/(dashboard)/lists/page.tsx");
  const helpers = source("../../lib/entries/lists.ts");

  assert.match(page, /ensureDefaultPersonalLists/);
  assert.match(page, /listVisibility\.canManageSharedLists/);
  assert.match(page, /ensureDefaultAdminSharedLists/);
  for (const name of ["Outbox", "Knowledge", "Practice", "Skills", "FieldOps", "GearOps", "ResourceOps"]) {
    assert.match(helpers, new RegExp(name));
  }
});

test("Inbox is protected and its sidebar route uses the personal Inbox working view", () => {
  const listsPage = source("../../app/(dashboard)/lists/page.tsx");
  const inboxPage = source("../../app/(dashboard)/lists/inbox/page.tsx");
  const detailPage = source("../../app/(dashboard)/lists/[listId]/page.tsx");
  const updatePage = source("../../app/(dashboard)/lists/[listId]/update/page.tsx");
  const updateRoute = source("../../app/(dashboard)/lists/[listId]/actions/update/route.ts");

  assert.match(listsPage, /list\.isInbox && list\.ownerPersonId === actorPersonId \? "\/lists\/inbox"/);
  assert.match(inboxPage, /entries\/inbox\/page/);
  assert.match(detailPage, /!list\.isInbox/);
  assert.match(updatePage, /Inbox is a protected default list and cannot be edited or removed/);
  assert.match(updateRoute, /if \(list\.isInbox\)/);
});

test("Lists page separates Guardian-linked athlete lists into Related Athletes groups", () => {
  const page = source("../../app/(dashboard)/lists/page.tsx");

  assert.match(page, />Related Athletes<\/h2>/);
  assert.match(page, /hierarchy\.relatedAthletes\.map/);
});
