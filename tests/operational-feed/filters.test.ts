/**
 * Arc 22G — Entry Closeout
 *
 * Regression tests for the pure filter helpers extracted in Arc 22F.
 * These functions have no DB or React dependencies.
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import type { EntryPriority, EntryStatus, EntryType } from "@prisma/client";

import {
  buildDueWindowWhere,
  buildEntryOrderBy,
  parseEntryListFilter,
} from "../../lib/operational-feed/filters";

// ── VALID_TYPES / VALID_STATUSES / VALID_PRIORITIES used in parseEntryListFilter ─

const VALID_TYPES: readonly string[] = [
  "TASK",
  "NOTE",
  "EVENT",
  "DECISION",
  "JOURNAL",
  "HABIT",
  "OBSERVATION",
  "FOLLOW_UP",
  "ACTIVITY",
  "READINESS_ITEM",
];

const VALID_STATUSES: readonly string[] = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED", "ARCHIVED"];

const VALID_PRIORITIES: readonly string[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

// ── parseEntryListFilter ────────────────────────────────────────────────────

test("parseEntryListFilter returns defaults for empty params", () => {
  const state = parseEntryListFilter({}, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);

  assert.equal(state.type, undefined);
  assert.equal(state.status, undefined);
  assert.equal(state.priority, undefined);
  assert.equal(state.assigneePersonId, undefined);
  assert.equal(state.dueWindow, "all");
  assert.equal(state.sort, "updated_desc");
});

test("parseEntryListFilter accepts valid type, status, and priority values", () => {
  const state = parseEntryListFilter(
    { type: "task", status: "open", priority: "high" },
    VALID_TYPES,
    VALID_STATUSES,
    VALID_PRIORITIES,
  );

  assert.equal(state.type, "TASK" as EntryType);
  assert.equal(state.status, "OPEN" as EntryStatus);
  assert.equal(state.priority, "HIGH" as EntryPriority);
});

test("parseEntryListFilter silently drops unknown type values", () => {
  const state = parseEntryListFilter(
    { type: "SPREADSHEET" },
    VALID_TYPES,
    VALID_STATUSES,
    VALID_PRIORITIES,
  );

  assert.equal(state.type, undefined);
});

test("parseEntryListFilter silently drops unknown status values", () => {
  const state = parseEntryListFilter(
    { status: "PENDING_REVIEW" },
    VALID_TYPES,
    VALID_STATUSES,
    VALID_PRIORITIES,
  );

  assert.equal(state.status, undefined);
});

test("parseEntryListFilter silently drops unknown priority values", () => {
  const state = parseEntryListFilter(
    { priority: "CRITICAL" },
    VALID_TYPES,
    VALID_STATUSES,
    VALID_PRIORITIES,
  );

  assert.equal(state.priority, undefined);
});

test("parseEntryListFilter accepts valid dueWindow values", () => {
  for (const window of ["all", "overdue", "today", "upcoming", "no_date"] as const) {
    const state = parseEntryListFilter({ dueWindow: window }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
    assert.equal(state.dueWindow, window, `Expected dueWindow '${window}' to be accepted`);
  }
});

test("parseEntryListFilter falls back to 'all' for unknown dueWindow", () => {
  const state = parseEntryListFilter(
    { dueWindow: "last_week" },
    VALID_TYPES,
    VALID_STATUSES,
    VALID_PRIORITIES,
  );

  assert.equal(state.dueWindow, "all");
});

test("parseEntryListFilter accepts valid sort values", () => {
  for (const sort of ["updated_desc", "due_asc", "created_desc", "priority_desc"] as const) {
    const state = parseEntryListFilter({ sort }, VALID_TYPES, VALID_STATUSES, VALID_PRIORITIES);
    assert.equal(state.sort, sort, `Expected sort '${sort}' to be accepted`);
  }
});

test("parseEntryListFilter falls back to 'updated_desc' for unknown sort", () => {
  const state = parseEntryListFilter(
    { sort: "alphabetical" },
    VALID_TYPES,
    VALID_STATUSES,
    VALID_PRIORITIES,
  );

  assert.equal(state.sort, "updated_desc");
});

test("parseEntryListFilter passes through assigneePersonId including 'me'", () => {
  const withMe = parseEntryListFilter(
    { assigneePersonId: "me" },
    VALID_TYPES,
    VALID_STATUSES,
    VALID_PRIORITIES,
  );
  assert.equal(withMe.assigneePersonId, "me");

  const withId = parseEntryListFilter(
    { assigneePersonId: "clpersonid123" },
    VALID_TYPES,
    VALID_STATUSES,
    VALID_PRIORITIES,
  );
  assert.equal(withId.assigneePersonId, "clpersonid123");
});

test("parseEntryListFilter treats empty assigneePersonId as undefined", () => {
  const state = parseEntryListFilter(
    { assigneePersonId: "" },
    VALID_TYPES,
    VALID_STATUSES,
    VALID_PRIORITIES,
  );

  assert.equal(state.assigneePersonId, undefined);
});

// ── buildDueWindowWhere ─────────────────────────────────────────────────────

test("buildDueWindowWhere returns null for 'all'", () => {
  const now = new Date("2026-05-27T10:00:00.000Z");
  assert.equal(buildDueWindowWhere("all", now), null);
});

test("buildDueWindowWhere returns dueDate: null for 'no_date'", () => {
  const now = new Date("2026-05-27T10:00:00.000Z");
  const result = buildDueWindowWhere("no_date", now);
  assert.deepStrictEqual(result, { dueDate: null });
});

test("buildDueWindowWhere returns lt today-midnight for 'overdue'", () => {
  const now = new Date("2026-05-27T10:00:00.000Z");
  const result = buildDueWindowWhere("overdue", now);

  assert.ok(result !== null && "dueDate" in result);
  const where = result as { dueDate: { lt: Date } };
  assert.equal(where.dueDate.lt.toISOString(), "2026-05-27T00:00:00.000Z");
});

test("buildDueWindowWhere returns gte today-midnight and lt tomorrow-midnight for 'today'", () => {
  const now = new Date("2026-05-27T10:00:00.000Z");
  const result = buildDueWindowWhere("today", now);

  assert.ok(result !== null && "dueDate" in result);
  const where = result as { dueDate: { gte: Date; lt: Date } };
  assert.equal(where.dueDate.gte.toISOString(), "2026-05-27T00:00:00.000Z");
  assert.equal(where.dueDate.lt.toISOString(), "2026-05-28T00:00:00.000Z");
});

test("buildDueWindowWhere returns gte tomorrow-midnight and lt +7-days for 'upcoming'", () => {
  const now = new Date("2026-05-27T10:00:00.000Z");
  const result = buildDueWindowWhere("upcoming", now);

  assert.ok(result !== null && "dueDate" in result);
  const where = result as { dueDate: { gte: Date; lt: Date } };
  assert.equal(where.dueDate.gte.toISOString(), "2026-05-28T00:00:00.000Z");
  assert.equal(where.dueDate.lt.toISOString(), "2026-06-04T00:00:00.000Z");
});

test("buildDueWindowWhere 'overdue' and 'today' windows are adjacent (no gap or overlap)", () => {
  const now = new Date("2026-05-27T14:00:00.000Z");

  const overdueResult = buildDueWindowWhere("overdue", now) as { dueDate: { lt: Date } };
  const todayResult = buildDueWindowWhere("today", now) as { dueDate: { gte: Date; lt: Date } };

  // Overdue ends exactly where today starts.
  assert.equal(
    overdueResult.dueDate.lt.toISOString(),
    todayResult.dueDate.gte.toISOString(),
    "Overdue lt must equal today gte (adjacent, no overlap)",
  );
});

test("buildDueWindowWhere 'today' and 'upcoming' windows are adjacent (no gap or overlap)", () => {
  const now = new Date("2026-05-27T14:00:00.000Z");

  const todayResult = buildDueWindowWhere("today", now) as { dueDate: { gte: Date; lt: Date } };
  const upcomingResult = buildDueWindowWhere("upcoming", now) as { dueDate: { gte: Date; lt: Date } };

  // Today ends exactly where upcoming starts.
  assert.equal(
    todayResult.dueDate.lt.toISOString(),
    upcomingResult.dueDate.gte.toISOString(),
    "Today lt must equal upcoming gte (adjacent, no overlap)",
  );
});

// ── buildEntryOrderBy ───────────────────────────────────────────────────────

test("buildEntryOrderBy returns updatedAt desc for 'updated_desc'", () => {
  const orderBy = buildEntryOrderBy("updated_desc");
  assert.deepStrictEqual(orderBy[0], { updatedAt: "desc" });
});

test("buildEntryOrderBy returns dueDate asc first for 'due_asc'", () => {
  const orderBy = buildEntryOrderBy("due_asc");
  assert.deepStrictEqual(orderBy[0], { dueDate: "asc" });
});

test("buildEntryOrderBy returns createdAt desc for 'created_desc'", () => {
  const orderBy = buildEntryOrderBy("created_desc");
  assert.deepStrictEqual(orderBy[0], { createdAt: "desc" });
});

test("buildEntryOrderBy returns priority desc first for 'priority_desc'", () => {
  const orderBy = buildEntryOrderBy("priority_desc");
  assert.deepStrictEqual(orderBy[0], { priority: "desc" });
});

test("buildEntryOrderBy always returns a non-empty array", () => {
  for (const sort of ["updated_desc", "due_asc", "created_desc", "priority_desc"] as const) {
    const orderBy = buildEntryOrderBy(sort);
    assert.ok(orderBy.length > 0, `Expected non-empty orderBy for sort '${sort}'`);
  }
});
