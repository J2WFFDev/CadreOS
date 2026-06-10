import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

test("Quick Capture keeps title and details separate", () => {
  const route = source("../../app/(dashboard)/entries/quick-add/route.ts");

  assert.match(route, /const content = rawDetails;/);
  assert.match(route, /const title = rawTitle \|\| parsed\.title;/);
  assert.doesNotMatch(route, /const content = rawDetails \|\| parsed\.content;/);
});

test("Quick Capture does not expose or accept person assignment", () => {
  const launcher = source("../../components/dashboard/quick-capture-launcher.tsx");
  const layout = source("../../app/(dashboard)/layout.tsx");
  const route = source("../../app/(dashboard)/entries/quick-add/route.ts");

  assert.doesNotMatch(launcher, /assigneePersonId|assignees|defaultAssigneePersonId/);
  assert.doesNotMatch(layout, /assignees=|defaultAssigneePersonId=/);
  assert.doesNotMatch(route, /formData\.get\("assigneePersonId"\)|rawAssigneePersonId|resolvedAssigneePersonId/);
  assert.match(route, /const assignedToPersonId = actorPersonId;/);
});

test("Quick Capture explains creator, assignment, and Inbox defaults without an assignment field", () => {
  const launcher = source("../../components/dashboard/quick-capture-launcher.tsx");
  const detailPage = source("../../app/(dashboard)/entries/[entryId]/page.tsx");

  assert.match(launcher, /creates the Entry as you, assigns the task to you, and routes it to your Inbox/);
  assert.match(detailPage, /Created by you, assigned to you, and routed to your Inbox/);
  assert.doesNotMatch(launcher, /<label[^>]*>Assign|<label[^>]*>Assignee/);
});

test("Quick Capture detail view uses Details instead of duplicate Main Item wording", () => {
  const detailPage = source("../../app/(dashboard)/entries/[entryId]/page.tsx");
  const detailConfig = source("../../lib/entries/detail-config.ts");

  assert.doesNotMatch(detailPage, />Main Item</);
  assert.match(detailPage, /\{detailConfig\.contentLabel\}/);
  assert.match(detailConfig, /contentLabel: "Details"/);
});
