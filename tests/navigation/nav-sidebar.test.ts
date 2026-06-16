import { strict as assert } from "node:assert";
import test from "node:test";

import type { AppRole, CurrentUser } from "../../lib/auth/current-user-types";
import { canAccessModule, MODULE_ACCESS_MAP } from "../../lib/auth/access-control";
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
  isNavSidebarGroupExpanded,
  isNavSidebarGroupActive,
  isNavSidebarLinkActive,
  NAV_SIDEBAR_GROUP_STATE_STORAGE_KEY,
  parseNavSidebarGroupState,
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

test("MemberOps lifecycle route is active for staff navigation only", () => {
  const memberOpsGroup = CADREOS_NAV_GROUPS.find((group) => group.key === "MEMBEROPS");
  assert.ok(memberOpsGroup);
  const lifecycleItem = memberOpsGroup.items.find((item) => item.key === "MEMBERSHIP_LIFECYCLE");
  const reportsItem = memberOpsGroup.items.find((item) => item.key === "MEMBER_REPORTS");

  assert.ok(lifecycleItem);
  assert.equal(lifecycleItem.status, "active");
  assert.equal(lifecycleItem.disabled, false);
  assert.equal(lifecycleItem.href, "/member-ops/lifecycle");
  assert.ok(reportsItem);
  assert.equal(reportsItem.status, "active");
  assert.equal(reportsItem.disabled, false);
  assert.equal(reportsItem.href, "/member-ops/reports");

  for (const role of ["ADMIN", "PROGRAM_MANAGER", "COACH"] as const) {
    const visibleGroup = getNavSidebarGroupsForUser(buildUser(role)).find((group) => group.key === "MEMBEROPS");
    assert.ok(visibleGroup);
    assert.equal(visibleGroup.items.some((item) => item.href === "/member-ops/lifecycle"), true);
    assert.equal(visibleGroup.items.some((item) => item.href === "/member-ops/reports"), true);
  }

  for (const role of ["GUARDIAN", "ATHLETE", "LIMITED_VIEWER"] as const) {
    const visibleGroup = getNavSidebarGroupsForUser(buildUser(role)).find((group) => group.key === "MEMBEROPS");
    assert.equal(visibleGroup, undefined);
  }
});

test("entry inbox route does not activate all entries root link", () => {
  assert.equal(isNavSidebarLinkActive("/entries/inbox", "/entries/inbox"), true);
  assert.equal(isNavSidebarLinkActive("/entries/inbox", "/entries"), false);
});

test("personal Inbox route does not activate Lists root link", () => {
  assert.equal(isNavSidebarLinkActive("/lists/inbox", "/lists/inbox"), true);
  assert.equal(isNavSidebarLinkActive("/lists/inbox", "/lists"), false);
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

test("sidebar group state storage key stays stable", () => {
  assert.equal(NAV_SIDEBAR_GROUP_STATE_STORAGE_KEY, "cadreos.nav-sidebar.group-state.v1");
});

test("parseNavSidebarGroupState ignores malformed and unknown values", () => {
  assert.deepEqual(parseNavSidebarGroupState(null, NAV_SIDEBAR_GROUPS), {});
  assert.deepEqual(parseNavSidebarGroupState("not-json", NAV_SIDEBAR_GROUPS), {});

  assert.deepEqual(
    parseNavSidebarGroupState(
      JSON.stringify({
        GEAROPS: false,
        MEMBEROPS: true,
        UNKNOWN: false,
        HOME: "collapsed",
      }),
      NAV_SIDEBAR_GROUPS,
    ),
    {
      GEAROPS: false,
      MEMBEROPS: true,
    },
  );
});

test("isNavSidebarGroupExpanded auto-expands the active section", () => {
  const gearOpsGroup = NAV_SIDEBAR_GROUPS.find((group) => group.key === "GEAROPS");
  assert.ok(gearOpsGroup);

  assert.equal(isNavSidebarGroupExpanded("/gear-ops/items", gearOpsGroup, { GEAROPS: false }), true);
});

test("isNavSidebarGroupExpanded respects persisted state for inactive sections", () => {
  const gearOpsGroup = NAV_SIDEBAR_GROUPS.find((group) => group.key === "GEAROPS");
  assert.ok(gearOpsGroup);

  assert.equal(isNavSidebarGroupExpanded("/dashboard", gearOpsGroup, { GEAROPS: false }), false);
  assert.equal(isNavSidebarGroupExpanded("/dashboard", gearOpsGroup, { GEAROPS: true }), true);
  assert.equal(isNavSidebarGroupExpanded("/dashboard", gearOpsGroup, {}), true);
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

test("linked member app fallback renders safe base navigation", () => {
  const groups = getNavSidebarGroupsForUser({
    id: "member-without-direct-role",
    name: "Linked Member",
    roles: ["LIMITED_VIEWER"],
    activeRole: "LIMITED_VIEWER",
    isDevPersona: false,
  });

  assert.deepEqual(groups.map((group) => group.key), ["HOME"]);
});

test("guardian and athlete can see GearOps without admin navigation", () => {
  for (const role of ["GUARDIAN", "ATHLETE"] as const) {
    const keys = getNavSidebarGroupsForUser(buildUser(role)).map((group) => group.key);
    assert.ok(keys.includes("GEAROPS"));
    assert.equal(keys.includes("ADMIN"), false);
  }
});

test("guardian and athlete see EntryOps UX links while filtering stays server-side", () => {
  for (const role of ["GUARDIAN", "ATHLETE"] as const) {
    const entryOpsGroup = getNavSidebarGroupsForUser(buildUser(role)).find((group) => group.key === "ENTRYOPS");
    assert.ok(entryOpsGroup);

    const hrefs = (entryOpsGroup?.items ?? []).map((item) => item.href);
    assert.equal(hrefs.includes("/lists/inbox"), true);
    assert.equal(hrefs.includes("/lists"), true);
    assert.equal(hrefs.includes("/entries"), true);
    assert.equal(hrefs.includes("/habits"), true);
    assert.equal(hrefs.includes("/prompts"), false);
    assert.equal(hrefs.includes("/entries/review"), false);
    assert.equal(hrefs.includes("/assigned"), false);
    assert.equal(hrefs.includes("/today"), false);
    assert.equal(hrefs.includes("/upcoming"), false);
    assert.equal(hrefs.includes("/feed"), false);
    assert.equal(hrefs.includes("/journals"), true);
    assert.equal(hrefs.includes("/prompt-assignments"), false);
    assert.equal(canAccessModule(buildUser(role), "journal"), true);
  }
});
