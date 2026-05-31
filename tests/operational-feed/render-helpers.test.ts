import { strict as assert } from "node:assert";
import test from "node:test";

import type { EntryPriority, EntryStatus, EntryType } from "@prisma/client";

import {
  formatDueDate,
  isOverdueFeedEntry,
  labelForActivityAction,
  labelForEntryPriority,
  labelForEntryStatus,
  labelForEntryType,
} from "../../lib/operational-feed/render";

// ── labelForEntryType ───────────────────────────────────────────────────────

test("labelForEntryType returns human-readable labels for all known types", () => {
  const cases: Array<[EntryType, string]> = [
    ["TASK", "Task"],
    ["NOTE", "Note"],
    ["EVENT", "Event"],
    ["DECISION", "Decision"],
    ["JOURNAL", "Journal"],
    ["HABIT", "Habit"],
    ["OBSERVATION", "Observation"],
    ["FOLLOW_UP", "Follow-up"],
    ["ACTIVITY", "Activity"],
    ["READINESS_ITEM", "Readiness"],
  ];
  for (const [type, expected] of cases) {
    assert.equal(labelForEntryType(type), expected, `Expected label for ${type}`);
  }
});

test("labelForEntryType falls back to the raw value for unknown types", () => {
  assert.equal(labelForEntryType("UNKNOWN_TYPE" as EntryType), "UNKNOWN_TYPE");
});

// ── labelForEntryStatus ─────────────────────────────────────────────────────

test("labelForEntryStatus returns human-readable labels for all known statuses", () => {
  const cases: Array<[EntryStatus, string]> = [
    ["OPEN", "Open"],
    ["IN_PROGRESS", "In Progress"],
    ["DONE", "Done"],
    ["CANCELLED", "Cancelled"],
    ["ARCHIVED", "Archived"],
  ];
  for (const [status, expected] of cases) {
    assert.equal(labelForEntryStatus(status), expected, `Expected label for ${status}`);
  }
});

// ── labelForEntryPriority ───────────────────────────────────────────────────

test("labelForEntryPriority returns human-readable labels", () => {
  const cases: Array<[EntryPriority, string]> = [
    ["LOW", "Low"],
    ["MEDIUM", "Medium"],
    ["HIGH", "High"],
    ["URGENT", "Urgent"],
  ];
  for (const [priority, expected] of cases) {
    assert.equal(labelForEntryPriority(priority), expected, `Expected label for ${priority}`);
  }
});

// ── labelForActivityAction ──────────────────────────────────────────────────

test("labelForActivityAction returns human-readable labels for known actions", () => {
  assert.equal(labelForActivityAction("entry.created"), "Created");
  assert.equal(labelForActivityAction("entry.updated"), "Updated");
  assert.equal(labelForActivityAction("entry.status_changed"), "Status changed");
  assert.equal(labelForActivityAction("entry.linked"), "Linked to entry");
  assert.equal(labelForActivityAction("entry.unlinked"), "Unlinked from entry");
  assert.equal(labelForActivityAction("entry.assignment_added"), "Assigned");
  assert.equal(labelForActivityAction("entry.follow_up_created"), "Follow-up created");
  assert.equal(labelForActivityAction("entry.follow_up_assigned"), "Follow-up assigned");
  assert.equal(labelForActivityAction("entry.follow_up_completed"), "Follow-up completed");
  assert.equal(labelForActivityAction("entry.graph_link_added"), "Graph link added");
  assert.equal(labelForActivityAction("entry.graph_link_removed"), "Graph link removed");
  assert.equal(labelForActivityAction("entry.completed"), "Completed");
  assert.equal(labelForActivityAction("entry.archived"), "Archived");
  assert.equal(labelForActivityAction("entry.task_completed"), "Completed");
  assert.equal(labelForActivityAction("entry.deleted"), "Deleted");
  assert.equal(labelForActivityAction("entry.soft_deleted"), "Deleted");
  assert.equal(labelForActivityAction("entry.quick_add.task"), "Quick-added task");
  assert.equal(labelForActivityAction("entry.note_to_task_converted"), "Converted note to task");
  assert.equal(labelForActivityAction("entry.note_converted_to_task"), "Converted note to task");
  assert.equal(labelForActivityAction("journal.draft_created"), "Journal draft created");
  assert.equal(labelForActivityAction("journal.draft_updated"), "Journal draft updated");
  assert.equal(labelForActivityAction("journal.submitted"), "Journal finalized");
  assert.equal(labelForActivityAction("journal.reopened"), "Journal reopened");
  assert.equal(labelForActivityAction("journal.archived"), "Journal archived");
  assert.equal(labelForActivityAction("journal.restored"), "Journal restored");
});

test("labelForActivityAction falls back to raw action string for unknown actions", () => {
  assert.equal(labelForActivityAction("custom.action.x"), "custom.action.x");
});

// ── formatDueDate ───────────────────────────────────────────────────────────

test("formatDueDate returns null when dueDate is null", () => {
  assert.equal(formatDueDate(null, null), null);
});

test("formatDueDate returns ISO date string when no time is set", () => {
  const dueDate = new Date("2026-05-26T00:00:00.000Z");
  assert.equal(formatDueDate(dueDate, null), "2026-05-26");
});

test("formatDueDate appends dueTime when provided", () => {
  const dueDate = new Date("2026-05-26T00:00:00.000Z");
  assert.equal(formatDueDate(dueDate, "14:30"), "2026-05-26 14:30");
});

// ── isOverdueFeedEntry ──────────────────────────────────────────────────────

test("isOverdueFeedEntry returns false for null dueDate", () => {
  const now = new Date("2026-05-26T10:00:00.000Z");
  assert.equal(isOverdueFeedEntry(null, now), false);
});

test("isOverdueFeedEntry returns true for a date before today UTC midnight", () => {
  const now = new Date("2026-05-26T10:00:00.000Z");
  const dueDate = new Date("2026-05-24T00:00:00.000Z");
  assert.equal(isOverdueFeedEntry(dueDate, now), true);
});

test("isOverdueFeedEntry returns false for today's date", () => {
  const now = new Date("2026-05-26T10:00:00.000Z");
  const dueDate = new Date("2026-05-26T00:00:00.000Z");
  assert.equal(isOverdueFeedEntry(dueDate, now), false);
});
