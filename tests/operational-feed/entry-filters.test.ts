import { strict as assert } from "node:assert";
import test from "node:test";

import type { EntryPriority, EntryStatus, EntryType } from "@prisma/client";

import {
  buildDueWindowWhere,
  buildEntryOrderBy,
  parseEntryListFilter,
} from "../../lib/operational-feed/filters";

// ── parseEntryListFilter ─────────────────────────────────────────────────────

const VALID_TYPES: EntryType[] = ["TASK", "NOTE", "FOLLOW_UP", "DECISION", "OBSERVATION", "READINESS_ITEM", "JOURNAL", "HABIT", "EVENT", "ACTIVITY"];
const VALID_STATUSES: EntryStatus[] = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED", "ARCHIVED"];
const VALID_PRIORITIES: EntryPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

test("parseEntryListFilter returns safe defaults when params are empty", () => {
  const result = parseEntryListFilter({}, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);

  assert.equal(result.type, undefined);
  assert.equal(result.status, undefined);
  assert.equal(result.priority, undefined);
  assert.equal(result.assigneePersonId, undefined);
  assert.equal(result.dueWindow, "all");
  assert.equal(result.sort, "updated_desc");
});

test("parseEntryListFilter accepts a valid type (case-insensitive)", () => {
  const result = parseEntryListFilter({ type: "task" }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
  assert.equal(result.type, "TASK");
});

test("parseEntryListFilter rejects an unknown type", () => {
  const result = parseEntryListFilter({ type: "UNKNOWN_TYPE" }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
  assert.equal(result.type, undefined);
});

test("parseEntryListFilter accepts a valid status", () => {
  const result = parseEntryListFilter({ status: "IN_PROGRESS" }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
  assert.equal(result.status, "IN_PROGRESS");
});

test("parseEntryListFilter rejects an unknown status", () => {
  const result = parseEntryListFilter({ status: "PENDING" }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
  assert.equal(result.status, undefined);
});

test("parseEntryListFilter accepts a valid priority", () => {
  const result = parseEntryListFilter({ priority: "HIGH" }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
  assert.equal(result.priority, "HIGH");
});

test("parseEntryListFilter rejects an unknown priority", () => {
  const result = parseEntryListFilter({ priority: "CRITICAL" }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
  assert.equal(result.priority, undefined);
});

test("parseEntryListFilter passes through assigneePersonId as-is", () => {
  const result = parseEntryListFilter({ assigneePersonId: "person-123" }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
  assert.equal(result.assigneePersonId, "person-123");
});

test("parseEntryListFilter passes through the 'me' shorthand (caller resolves it)", () => {
  const result = parseEntryListFilter({ assigneePersonId: "me" }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
  assert.equal(result.assigneePersonId, "me");
});

test("parseEntryListFilter returns undefined assigneePersonId for empty string", () => {
  const result = parseEntryListFilter({ assigneePersonId: "" }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
  assert.equal(result.assigneePersonId, undefined);
});

test("parseEntryListFilter accepts valid dueWindow values", () => {
  for (const dueWindow of ["all", "overdue", "today", "upcoming", "no_date"] as const) {
    const result = parseEntryListFilter({ dueWindow }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
    assert.equal(result.dueWindow, dueWindow, `Expected dueWindow ${dueWindow}`);
  }
});

test("parseEntryListFilter falls back to 'all' for unknown dueWindow", () => {
  const result = parseEntryListFilter({ dueWindow: "next_week" }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
  assert.equal(result.dueWindow, "all");
});

test("parseEntryListFilter accepts valid sort values", () => {
  for (const sort of ["updated_desc", "due_asc", "created_desc", "priority_desc"] as const) {
    const result = parseEntryListFilter({ sort }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
    assert.equal(result.sort, sort, `Expected sort ${sort}`);
  }
});

test("parseEntryListFilter falls back to 'updated_desc' for unknown sort", () => {
  const result = parseEntryListFilter({ sort: "name_asc" }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
  assert.equal(result.sort, "updated_desc");
});

// ── buildDueWindowWhere ──────────────────────────────────────────────────────

const NOW = new Date("2026-05-27T10:00:00.000Z");
// todayStart  = 2026-05-27T00:00:00.000Z
// tomorrowStart = 2026-05-28T00:00:00.000Z

test("buildDueWindowWhere returns null for 'all'", () => {
  const result = buildDueWindowWhere("all", NOW);
  assert.equal(result, null);
});

test("buildDueWindowWhere returns dueDate: null for 'no_date'", () => {
  const result = buildDueWindowWhere("no_date", NOW);
  assert.deepEqual(result, { dueDate: null });
});

test("buildDueWindowWhere returns lt todayStart for 'overdue'", () => {
  const result = buildDueWindowWhere("overdue", NOW);
  assert.ok(result !== null);
  assert.ok("dueDate" in result!);
  const dueDate = (result as { dueDate: { lt: Date } }).dueDate;
  assert.equal(dueDate.lt.toISOString(), "2026-05-27T00:00:00.000Z");
});

test("buildDueWindowWhere returns gte todayStart, lt tomorrowStart for 'today'", () => {
  const result = buildDueWindowWhere("today", NOW);
  assert.ok(result !== null);
  const dueDate = (result as { dueDate: { gte: Date; lt: Date } }).dueDate;
  assert.equal(dueDate.gte.toISOString(), "2026-05-27T00:00:00.000Z");
  assert.equal(dueDate.lt.toISOString(), "2026-05-28T00:00:00.000Z");
});

test("buildDueWindowWhere returns from tomorrowStart for 'upcoming'", () => {
  const result = buildDueWindowWhere("upcoming", NOW);
  assert.ok(result !== null);
  const dueDate = (result as { dueDate: { gte: Date; lt: Date } }).dueDate;
  // from = tomorrowStart = 2026-05-28
  assert.equal(dueDate.gte.toISOString(), "2026-05-28T00:00:00.000Z");
  // to = tomorrowStart + 14 days = 2026-06-11
  assert.equal(dueDate.lt.toISOString(), "2026-06-11T00:00:00.000Z");
});

// ── buildEntryOrderBy ────────────────────────────────────────────────────────

test("buildEntryOrderBy returns updatedAt desc for 'updated_desc'", () => {
  const result = buildEntryOrderBy("updated_desc");
  assert.deepEqual(result, [{ updatedAt: "desc" }]);
});

test("buildEntryOrderBy returns dueDate asc first for 'due_asc'", () => {
  const result = buildEntryOrderBy("due_asc");
  assert.equal(result[0].dueDate, "asc");
});

test("buildEntryOrderBy returns createdAt desc for 'created_desc'", () => {
  const result = buildEntryOrderBy("created_desc");
  assert.deepEqual(result, [{ createdAt: "desc" }]);
});

test("buildEntryOrderBy returns priority desc first for 'priority_desc'", () => {
  const result = buildEntryOrderBy("priority_desc");
  assert.equal(result[0].priority, "desc");
});
