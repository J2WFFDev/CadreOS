import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(path: string): string {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
}

test("Entry detail separates responsibility, organization, visibility, and system metadata", () => {
  const detail = source("../../app/(dashboard)/entries/[entryId]/page.tsx");

  assert.match(detail, />Context \/ List</);
  assert.match(detail, />Assignee</);
  assert.match(detail, />Visibility</);
  assert.match(detail, />System metadata</);
  assert.match(detail, />Created by</);
  assert.match(detail, />Created date</);
  assert.match(detail, /Created by is system history and does not change when an Entry is reassigned/);
  assert.doesNotMatch(detail, />Owner</);
  assert.doesNotMatch(detail, />Assignment</);
  assert.doesNotMatch(detail, />Scope</);
});

test("Task surfaces use Assignee and Created by without presenting an owner label", () => {
  const detail = source("../../app/(dashboard)/tasks/[taskId]/page.tsx");
  const list = source("../../app/(dashboard)/tasks/page.tsx");

  assert.match(detail, />Assignee</);
  assert.match(detail, />Created by</);
  assert.match(list, />Responsibility</);
  assert.match(list, /Assigned to assignee/);
  assert.doesNotMatch(list, />Ownership indicator</);
  assert.doesNotMatch(list, /Assigned owner/);
});

test("Journal detail distinguishes Author, Created by, prompt assignment, and visibility", () => {
  const detail = source("../../app/(dashboard)/journals/[entryId]/page.tsx");

  assert.match(detail, />Author</);
  assert.match(detail, />Created by</);
  assert.match(detail, />Prompt assignment</);
  assert.match(detail, />Visibility</);
  assert.match(detail, />Created date</);
  assert.doesNotMatch(detail, />Scope</);
  assert.doesNotMatch(detail, />Owner</);
});

test("Habit detail uses habit-specific wording instead of task assignment language", () => {
  const detail = source("../../app/(dashboard)/habits/[habitId]/page.tsx");

  assert.match(detail, />Habit details</);
  assert.match(detail, />Frequency</);
  assert.match(detail, />Athlete</);
  assert.match(detail, />Created by</);
  assert.match(detail, />Created date</);
  assert.doesNotMatch(detail, />Main Item</);
  assert.doesNotMatch(detail, />Assignment</);
  assert.doesNotMatch(detail, />Scope</);
});

test("Inbox and schedule avoid ambiguous Owner and Scope labels", () => {
  const inbox = source("../../app/(dashboard)/entries/inbox/page.tsx");
  const schedule = source("../../app/(dashboard)/entries/schedule/page.tsx");
  const listCreate = source("../../app/(dashboard)/lists/create/page.tsx");

  assert.match(inbox, />Assigned to</);
  assert.doesNotMatch(inbox, />Owner</);
  assert.match(schedule, />Calendar context</);
  assert.doesNotMatch(schedule, />Scope</);
  assert.match(listCreate, /Context type/);
  assert.doesNotMatch(listCreate, />\s*Scope\s*</);
  assert.doesNotMatch(listCreate, /required for (Program|Team) scope/);
});
