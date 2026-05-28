import { strict as assert } from "node:assert";
import test from "node:test";

import { NAV_SIDEBAR_GROUPS, isNavSidebarGroupActive, isNavSidebarLinkActive } from "../../lib/nav-sidebar";

test("sidebar groups all have labels and child links", () => {
  assert.ok(NAV_SIDEBAR_GROUPS.length > 1);

  for (const group of NAV_SIDEBAR_GROUPS) {
    assert.ok(group.label.length > 0, `Group missing label`);
    assert.ok(group.links.length > 0, `Group "${group.label}" has no links`);
  }
});

test("all groups have a landing href", () => {
  for (const group of NAV_SIDEBAR_GROUPS) {
    assert.ok(typeof group.href === "string" && group.href.startsWith("/"), `Group "${group.label}" missing href`);
  }
});

test("sidebar groups contain required child hrefs", () => {
  const hrefs = NAV_SIDEBAR_GROUPS.flatMap((group) => group.links.map((link) => link.href));

  assert.ok(hrefs.includes("/entries/inbox"));
  assert.ok(hrefs.includes("/entries"));
  assert.ok(hrefs.includes("/notifications"));
  assert.ok(hrefs.includes("/decisions"));
  assert.ok(hrefs.includes("/prompt-assignments"));
  assert.equal(hrefs.includes("/account"), false);
});

test("entry inbox route does not activate all entries root link", () => {
  assert.equal(isNavSidebarLinkActive("/entries/inbox", "/entries/inbox"), true);
  assert.equal(isNavSidebarLinkActive("/entries/inbox", "/entries"), false);
});

test("nested routes activate their parent link except dashboard", () => {
  assert.equal(isNavSidebarLinkActive("/account/link-person", "/account"), true);
  assert.equal(isNavSidebarLinkActive("/dashboard/metrics", "/dashboard"), false);
});

test("isNavSidebarGroupActive: active when a child route matches", () => {
  const gearOpsGroup = NAV_SIDEBAR_GROUPS.find((g) => g.label === "GearOps");
  assert.ok(gearOpsGroup);

  assert.equal(isNavSidebarGroupActive("/gear-ops", gearOpsGroup), true);
  assert.equal(isNavSidebarGroupActive("/gear-ops/items", gearOpsGroup), true);
  assert.equal(isNavSidebarGroupActive("/programs", gearOpsGroup), false);
});

test("isNavSidebarGroupActive: EntryOps active on entries but not entries/inbox for root", () => {
  const entryOpsGroup = NAV_SIDEBAR_GROUPS.find((g) => g.label === "EntryOps");
  assert.ok(entryOpsGroup);

  assert.equal(isNavSidebarGroupActive("/entries", entryOpsGroup), true);
  assert.equal(isNavSidebarGroupActive("/entries/inbox", entryOpsGroup), true);
  assert.equal(isNavSidebarGroupActive("/programs", entryOpsGroup), false);
});
