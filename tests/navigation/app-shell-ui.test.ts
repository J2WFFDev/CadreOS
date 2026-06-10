import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

test("desktop app shell keeps header stationary with independent sidebar and main scrolling", () => {
  const layout = source("../../app/(dashboard)/layout.tsx");
  const sidebar = source("../../components/nav-sidebar.tsx");

  assert.match(layout, /md:h-screen md:flex-col md:overflow-hidden/);
  assert.match(layout, /<header className="[^"]*shrink-0/);
  assert.match(layout, /md:min-h-0 md:flex-1 md:flex-row md:overflow-hidden/);
  assert.match(layout, /<main className="[^"]*overflow-auto[^"]*md:min-h-0/);
  assert.match(sidebar, /md:h-full[^"]*md:flex-col[^"]*md:overflow-y-auto/);
});

test("sidebar group controls remain accessible, persistent, and mobile-safe", () => {
  const sidebar = source("../../components/nav-sidebar.tsx");

  assert.match(sidebar, /window\.localStorage\.setItem/);
  assert.match(sidebar, /aria-controls=\{groupPanelId\}/);
  assert.match(sidebar, /aria-expanded=\{isGroupExpanded\}/);
  assert.match(sidebar, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(sidebar, /aria-expanded=\{mobileOpen\}/);
  assert.match(sidebar, /onClick=\{\(\) => setMobileOpen\(false\)\}/);
});

test("sidebar rendering preserves role-filtered groups and planned item labels", () => {
  const sidebar = source("../../components/nav-sidebar.tsx");

  assert.match(sidebar, /getNavSidebarGroupsForUser\(currentUser\)/);
  assert.match(sidebar, /item\.status === "planned" \? "Planned"/);
  assert.match(sidebar, /item\.disabled !== true/);
});
