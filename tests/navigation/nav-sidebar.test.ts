import { strict as assert } from "node:assert";
import test from "node:test";

import type { AppRole, CurrentUser } from "../../lib/auth/current-user-types";
import { MODULE_ACCESS_MAP } from "../../lib/auth/access-control";
import { CADREOS_NAV_GROUPS } from "../../lib/navigation/cadreos-nav";
import {
  APPROVED_CADREOS_GROUP_ITEMS,
  APPROVED_CADREOS_GROUP_ORDER,
  APPROVED_GROUP_VISIBILITY,
  validateCadreosNavTaxonomy,
} from "../../lib/navigation/cadreos-nav-validation";
import {
  NAV_SIDEBAR_GROUPS,
  getNavSidebarGroupsForUser,
  isNavSidebarGroupActive,
  isNavSidebarLinkActive,
} from "../../lib/nav-sidebar";

function buildUser(role: AppRole): CurrentUser {
  return {
    id: `dev-${role.toLowerCase()}`,
    name: `Dev ${role}`,
    roles: [role],
    activeRole: role,
    isDevPersona: true,
  };
}

test("canonical sidebar taxonomy matches the approved v1 structure", () => {
  assert.deepEqual(
    CADREOS_NAV_GROUPS.map((group) => group.key),
    APPROVED_CADREOS_GROUP_ORDER,
  );

  for (const group of CADREOS_NAV_GROUPS) {
    assert.deepEqual(
      group.items.map((item) => item.key),
      APPROVED_CADREOS_GROUP_ITEMS[group.key as keyof typeof APPROVED_CADREOS_GROUP_ITEMS],
    );
  }

  assert.deepEqual(validateCadreosNavTaxonomy(), []);
});

test("sidebar groups all have labels and ordered child items", () => {
  assert.ok(NAV_SIDEBAR_GROUPS.length > 1);

  for (const group of NAV_SIDEBAR_GROUPS) {
    assert.ok(group.label.length > 0, "Group missing label");
    assert.ok(group.items.length > 0, `Group "${group.label}" has no items`);
  }
});

test("entry module naming remains EntryOps in navigation and access metadata", () => {
  const entryGroup = CADREOS_NAV_GROUPS.find((group) => group.key === "ENTRYOPS");
  assert.ok(entryGroup);
  assert.equal(entryGroup.label, "EntryOps");
  assert.equal(entryGroup.label.includes("WorkOps"), false);

  assert.equal(MODULE_ACCESS_MAP.entry.label, "EntryOps");
});

test("planned items stay non-clickable and preserve their future routes", () => {
  const plannedItems = NAV_SIDEBAR_GROUPS.flatMap((group) => group.items.filter((item) => item.status === "planned"));

  assert.ok(plannedItems.length > 0);
  for (const item of plannedItems) {
    assert.equal(item.disabled, true);
    assert.ok(item.href.startsWith("/"));
  }
});

test("entry inbox route does not activate all entries root link", () => {
  assert.equal(isNavSidebarLinkActive("/entries/inbox", "/entries/inbox"), true);
  assert.equal(isNavSidebarLinkActive("/entries/inbox", "/entries"), false);
});

test("nested routes activate their parent link except dashboard", () => {
  assert.equal(isNavSidebarLinkActive("/gear-ops/items/item-1", "/gear-ops/items"), true);
  assert.equal(isNavSidebarLinkActive("/journals/entry-1", "/journals"), true);
  assert.equal(isNavSidebarLinkActive("/prompts/prompt-1", "/prompts"), true);
  assert.equal(isNavSidebarLinkActive("/prompt-assignments/assignment-1", "/prompt-assignments"), true);
  assert.equal(isNavSidebarLinkActive("/dashboard/metrics", "/dashboard"), false);
});

test("isNavSidebarGroupActive: active when a child route matches", () => {
  const gearOpsGroup = NAV_SIDEBAR_GROUPS.find((group) => group.key === "GEAROPS");
  assert.ok(gearOpsGroup);

  assert.equal(isNavSidebarGroupActive("/gear-ops", gearOpsGroup), true);
  assert.equal(isNavSidebarGroupActive("/gear-ops/items", gearOpsGroup), true);
  assert.equal(isNavSidebarGroupActive("/programs", gearOpsGroup), false);
});

test("role-based group visibility matches the approved persona matrix", () => {
  for (const [role, expectedGroupKeys] of Object.entries(APPROVED_GROUP_VISIBILITY) as Array<[AppRole, readonly string[]]>) {
    assert.deepEqual(
      getNavSidebarGroupsForUser(buildUser(role)).map((group) => group.key),
      expectedGroupKeys,
      `Unexpected group visibility for ${role}`,
    );
  }
});

test("limited viewer only sees the home group", () => {
  const groups = getNavSidebarGroupsForUser(buildUser("LIMITED_VIEWER"));

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.key, "HOME");
});

test("guardian and athlete can see GearOps without admin navigation", () => {
  for (const role of ["GUARDIAN", "ATHLETE"] as const) {
    const keys = getNavSidebarGroupsForUser(buildUser(role)).map((group) => group.key);
    assert.ok(keys.includes("GEAROPS"));
    assert.equal(keys.includes("ADMIN"), false);
  }
});
