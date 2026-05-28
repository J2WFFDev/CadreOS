import { strict as assert } from "node:assert";
import test from "node:test";

import { NAV_SIDEBAR_GROUPS, isNavSidebarLinkActive } from "../../lib/nav-sidebar";

test("sidebar groups remain one-level deep with unique links", () => {
  assert.ok(NAV_SIDEBAR_GROUPS.length > 1);

  const hrefs = NAV_SIDEBAR_GROUPS.flatMap((group) => group.links.map((link) => link.href));

  assert.equal(hrefs.length, new Set(hrefs).size);
  assert.ok(hrefs.includes("/entries/inbox"));
  assert.ok(hrefs.includes("/entries"));
});

test("entry inbox route does not activate all entries root link", () => {
  assert.equal(isNavSidebarLinkActive("/entries/inbox", "/entries/inbox"), true);
  assert.equal(isNavSidebarLinkActive("/entries/inbox", "/entries"), false);
});

test("nested routes activate their parent link except dashboard", () => {
  assert.equal(isNavSidebarLinkActive("/account/link-person", "/account"), true);
  assert.equal(isNavSidebarLinkActive("/dashboard/metrics", "/dashboard"), false);
});
