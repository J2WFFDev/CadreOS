/**
 * Arc 24D.11 — EntryOps Navigation, Views, and Review Loops
 *
 * Focused tests for the workflow-oriented navigation structure.
 * NAV-001 through NAV-020.
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import { CADREOS_NAV_GROUPS, type CanonicalNavItem } from "../../lib/navigation/cadreos-nav";
import {
  APPROVED_CADREOS_GROUP_ITEMS,
  APPROVED_CADREOS_GROUP_ORDER,
  validateCadreosNavTaxonomy,
} from "../../lib/navigation/cadreos-nav-validation";
import {
  getNavSidebarGroupsForUser,
  isNavSidebarLinkActive,
} from "../../lib/nav-sidebar";
import type { AppRole, CurrentUser } from "../../lib/auth/current-user-types";

function buildUser(role: AppRole): CurrentUser {
  return {
    id: `test-${role.toLowerCase()}`,
    name: `Test ${role}`,
    roles: [role],
    activeRole: role,
    isDevPersona: true,
  };
}

// ── NAV-001: Simplified EntryOps views exist ────────────────────────────────

test("NAV-001: EntryOps contains the simplified primary views", () => {
  const entryOpsGroup = CADREOS_NAV_GROUPS.find((g) => g.key === "ENTRYOPS");
  assert.ok(entryOpsGroup, "ENTRYOPS group must exist");

  const itemKeys = entryOpsGroup.items.map((i) => i.key);
  const requiredKeys = [
    "ENTRY_INBOX",
    "ENTRY_LISTS",
    "ENTRY_ALL",
    "ENTRY_HABITS",
    "ENTRY_PROMPTS",
  ];

  for (const key of requiredKeys) {
    assert.ok(itemKeys.includes(key), `Missing required nav key ${key}`);
  }
});

// ── NAV-002: Simplified views point to correct routes ───────────────────────

test("NAV-002: simplified EntryOps nav items point to the correct routes", () => {
  const entryOpsGroup = CADREOS_NAV_GROUPS.find((g) => g.key === "ENTRYOPS");
  assert.ok(entryOpsGroup);

  const itemByKey = new Map(entryOpsGroup.items.map((i) => [i.key, i]));

  assert.equal(itemByKey.get("ENTRY_INBOX")?.href, "/entries/inbox");
  assert.equal(itemByKey.get("ENTRY_LISTS")?.href, "/lists");
  assert.equal(itemByKey.get("ENTRY_ALL")?.href, "/entries");
  assert.equal(itemByKey.get("ENTRY_HABITS")?.href, "/habits");
  assert.equal(itemByKey.get("ENTRY_PROMPTS")?.href, "/prompts");
});

// ── NAV-003: Simplified nav labels are human-readable ───────────────────────

test("NAV-003: simplified EntryOps nav items have correct user-facing labels", () => {
  const entryOpsGroup = CADREOS_NAV_GROUPS.find((g) => g.key === "ENTRYOPS");
  assert.ok(entryOpsGroup);

  const itemByKey = new Map(entryOpsGroup.items.map((i) => [i.key, i]));

  assert.equal(itemByKey.get("ENTRY_INBOX")?.label, "Inbox");
  assert.equal(itemByKey.get("ENTRY_LISTS")?.label, "Lists");
  assert.equal(itemByKey.get("ENTRY_ALL")?.label, "All Work Items");
  assert.equal(itemByKey.get("ENTRY_HABITS")?.label, "Habits");
  assert.equal(itemByKey.get("ENTRY_PROMPTS")?.label, "Journal Library");
});

// ── NAV-004: FYP has been moved out of HOME ─────────────────────────────────

test("NAV-004: FYP key no longer exists in the HOME group", () => {
  const homeGroup = CADREOS_NAV_GROUPS.find((g) => g.key === "HOME");
  assert.ok(homeGroup);

  const fypItem = homeGroup.items.find((i) => i.key === "FYP");
  assert.equal(fypItem, undefined, "FYP must not appear in HOME — it moved to ENTRYOPS as ENTRY_ACTIVITY");
});

test("NAV-004b: HOME approved items no longer include FYP", () => {
  assert.equal(
    APPROVED_CADREOS_GROUP_ITEMS.HOME.includes("FYP"),
    false,
    "FYP must be removed from the HOME approved items list",
  );
  assert.ok(
    APPROVED_CADREOS_GROUP_ITEMS.HOME.includes("PERSONAL_DASHBOARD"),
  );
  assert.ok(
    APPROVED_CADREOS_GROUP_ITEMS.HOME.includes("NOTIFICATIONS"),
  );
});

// ── NAV-005: No duplicate active hrefs ─────────────────────────────────────

test("NAV-005: no active nav items share the same href", () => {
  const hrefCounts = new Map<string, string[]>();
  for (const group of CADREOS_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.status === "active") {
        const existing = hrefCounts.get(item.href) ?? [];
        existing.push(item.key);
        hrefCounts.set(item.href, existing);
      }
    }
  }

  for (const [href, keys] of hrefCounts.entries()) {
    assert.equal(
      keys.length,
      1,
      `Duplicate active href ${href} shared by: ${keys.join(", ")}`,
    );
  }
});

// ── NAV-006: Taxonomy validation passes ────────────────────────────────────

test("NAV-006: canonical nav taxonomy passes full validation", () => {
  const issues = validateCadreosNavTaxonomy();
  assert.deepEqual(issues, [], `Nav taxonomy validation failed: ${issues.join("; ")}`);
});

// ── NAV-007: All simplified views are active (not planned/disabled) ─────────

test("NAV-007: all simplified EntryOps views have active status", () => {
  const entryOpsGroup = CADREOS_NAV_GROUPS.find((g) => g.key === "ENTRYOPS");
  assert.ok(entryOpsGroup);

  const workflowKeys = [
    "ENTRY_INBOX",
    "ENTRY_LISTS",
    "ENTRY_ALL",
    "ENTRY_HABITS",
    "ENTRY_PROMPTS",
  ];

  for (const key of workflowKeys) {
    const item: CanonicalNavItem | undefined = entryOpsGroup!.items.find((i) => i.key === key);
    if (!item) {
      assert.fail(`Item ${key} not found`);
    }
    assert.equal(item.status, "active", `${key} must be active`);
    assert.equal(item.disabled, false, `${key} must not be disabled`);
  }
});

// ── NAV-008: /entries/review does not activate /entries root ───────────────

test("NAV-008: /entries/review does not activate /entries root link", () => {
  assert.equal(isNavSidebarLinkActive("/entries/review", "/entries/review"), true);
  assert.equal(isNavSidebarLinkActive("/entries/review", "/entries"), false);
  assert.equal(isNavSidebarLinkActive("/entries/review/some-id", "/entries/review"), true);
  assert.equal(isNavSidebarLinkActive("/entries/review/some-id", "/entries"), false);
});

test("NAV-008b: /entries/inbox still does not activate /entries root", () => {
  assert.equal(isNavSidebarLinkActive("/entries/inbox", "/entries/inbox"), true);
  assert.equal(isNavSidebarLinkActive("/entries/inbox", "/entries"), false);
});

// ── NAV-009: hidden routes remain direct routes but are not primary nav ─────

test("NAV-009: deferred EntryOps routes are not primary nav items", () => {
  const entryOpsGroup = CADREOS_NAV_GROUPS.find((g) => g.key === "ENTRYOPS");
  assert.ok(entryOpsGroup);

  const hrefs = entryOpsGroup.items.map((i) => i.href);
  for (const hiddenHref of ["/assigned", "/today", "/upcoming", "/entries/review", "/feed", "/prompt-assignments", "/journals"]) {
    assert.equal(hrefs.includes(hiddenHref), false, `${hiddenHref} should not appear as primary EntryOps navigation`);
  }
});

// ── NAV-012: Workflow views visible to all EntryOps roles ──────────────────

test("NAV-012: simplified EntryOps items are visible to ADMIN role according to existing permissions", () => {
  const groups = getNavSidebarGroupsForUser(buildUser("ADMIN"));
  const entryOps = groups.find((g) => g.key === "ENTRYOPS");
  assert.ok(entryOps);

  const hrefs = entryOps.items.map((i) => i.href);
  assert.ok(hrefs.includes("/entries/inbox"), "Inbox not visible to ADMIN");
  assert.ok(hrefs.includes("/lists"), "Lists not visible to ADMIN");
  assert.ok(hrefs.includes("/entries"), "All Work Items not visible to ADMIN");
  assert.ok(hrefs.includes("/habits"), "Habits not visible to ADMIN");
  assert.ok(hrefs.includes("/prompts"), "Journal Library not visible to ADMIN");
});

test("NAV-012b: Athlete EntryOps navigation keeps only allowed simplified links", () => {
  const groups = getNavSidebarGroupsForUser(buildUser("ATHLETE"));
  const entryOps = groups.find((g) => g.key === "ENTRYOPS");
  assert.ok(entryOps);

  const hrefs = entryOps.items.map((i) => i.href);
  assert.ok(hrefs.includes("/habits"), "Habits not visible to ATHLETE");
  assert.equal(hrefs.includes("/entries/inbox"), false, "Inbox must be hidden for ATHLETE");
  assert.equal(hrefs.includes("/entries/review"), false, "Review must be hidden for ATHLETE");
  assert.equal(hrefs.includes("/lists"), false, "Lists must be hidden for ATHLETE");
  assert.equal(hrefs.includes("/entries"), false, "All entries must be hidden for ATHLETE");
  assert.equal(hrefs.includes("/prompts"), false, "Journal Library must be hidden for ATHLETE");
  assert.equal(hrefs.includes("/assigned"), false, "My Work must be hidden for ATHLETE");
  assert.equal(hrefs.includes("/today"), false, "Today must be hidden for ATHLETE");
  assert.equal(hrefs.includes("/upcoming"), false, "Upcoming must be hidden for ATHLETE");
  assert.equal(hrefs.includes("/feed"), false, "Activity Feed must be hidden for ATHLETE");
  assert.equal(hrefs.includes("/journals"), false, "Journals must be hidden for ATHLETE");
});

// ── NAV-013: PROMPT_LIBRARY_ROLES items still scoped correctly ─────────────

test("NAV-013: Journal Library remains scoped to allowed roles and excluded for GUARDIAN", () => {
  const guardianGroups = getNavSidebarGroupsForUser(buildUser("GUARDIAN"));
  const entryOps = guardianGroups.find((g) => g.key === "ENTRYOPS");
  assert.ok(entryOps);

  const promptItem = entryOps.items.find((i) => i.key === "ENTRY_PROMPTS");
  assert.equal(
    promptItem,
    undefined,
    "Journal Library must not appear for GUARDIAN",
  );
});

// ── NAV-014: EntryOps group ordering matches simplified model ───────────────

test("NAV-014: EntryOps items use the simplified primary sequence", () => {
  const approvedEntryOpsItems = APPROVED_CADREOS_GROUP_ITEMS.ENTRYOPS;

  assert.equal(approvedEntryOpsItems[0], "ENTRY_INBOX");
  assert.equal(approvedEntryOpsItems[1], "ENTRY_LISTS");
  assert.equal(approvedEntryOpsItems[2], "ENTRY_ALL");
  assert.equal(approvedEntryOpsItems[3], "ENTRY_HABITS");
  assert.equal(approvedEntryOpsItems[4], "ENTRY_PROMPTS");
});

// ── NAV-015: EntryOps group order matches approved structure ────────────────

test("NAV-015: full CADREOS nav group order matches the approved list", () => {
  const actualOrder = CADREOS_NAV_GROUPS.map((g) => g.key);
  assert.deepEqual(actualOrder, [...APPROVED_CADREOS_GROUP_ORDER]);
});
