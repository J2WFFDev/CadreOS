/**
 * Arc 24D.11 — EntryOps Navigation, Views, and Review Loops
 *
 * Focused tests for the Review view query constants and status scoping.
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import { REVIEW_ENTRY_STATUSES } from "../../lib/operational-feed/queries";
import { ACTIVE_FEED_STATUSES } from "../../lib/operational-feed/types";

// ── Review status coverage ──────────────────────────────────────────────────

test("REVIEW_ENTRY_STATUSES includes DONE, CANCELLED, and ARCHIVED", () => {
  assert.ok(REVIEW_ENTRY_STATUSES.includes("DONE"), "DONE must be in review statuses");
  assert.ok(REVIEW_ENTRY_STATUSES.includes("CANCELLED"), "CANCELLED must be in review statuses");
  assert.ok(REVIEW_ENTRY_STATUSES.includes("ARCHIVED"), "ARCHIVED must be in review statuses");
});

test("REVIEW_ENTRY_STATUSES does not overlap with ACTIVE_FEED_STATUSES", () => {
  for (const status of REVIEW_ENTRY_STATUSES) {
    assert.equal(
      (ACTIVE_FEED_STATUSES as readonly string[]).includes(status),
      false,
      `Status ${status} must not appear in both review and active sets`,
    );
  }
});

test("REVIEW_ENTRY_STATUSES and ACTIVE_FEED_STATUSES together cover OPEN, IN_PROGRESS, DONE, CANCELLED, ARCHIVED", () => {
  const allCovered = new Set([...REVIEW_ENTRY_STATUSES, ...ACTIVE_FEED_STATUSES]);
  const expectedStatuses = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED", "ARCHIVED"];

  for (const status of expectedStatuses) {
    assert.ok(allCovered.has(status as never), `Status ${status} is not covered by review or active status sets`);
  }
});

// ── My Work excludes review statuses ───────────────────────────────────────

test("My Work active feed statuses exclude completed and archived work", () => {
  assert.equal((ACTIVE_FEED_STATUSES as readonly string[]).includes("DONE"), false);
  assert.equal((ACTIVE_FEED_STATUSES as readonly string[]).includes("CANCELLED"), false);
  assert.equal((ACTIVE_FEED_STATUSES as readonly string[]).includes("ARCHIVED"), false);
});

test("My Work active feed statuses include only OPEN and IN_PROGRESS", () => {
  assert.equal(ACTIVE_FEED_STATUSES.length, 2);
  assert.ok(ACTIVE_FEED_STATUSES.includes("OPEN"));
  assert.ok(ACTIVE_FEED_STATUSES.includes("IN_PROGRESS"));
});
