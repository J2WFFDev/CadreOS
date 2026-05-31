import { strict as assert } from "node:assert";
import test from "node:test";

import { computeTodayWindow, computeUpcomingWindow, isOverdueEntry } from "../../lib/operational-feed/queries";

// ── computeTodayWindow ──────────────────────────────────────────────────────

test("computeTodayWindow returns midnight UTC today and tomorrow", () => {
  const now = new Date("2026-05-26T14:30:00.000Z");
  const { todayStart, tomorrowStart } = computeTodayWindow(now);

  assert.equal(todayStart.toISOString(), "2026-05-26T00:00:00.000Z");
  assert.equal(tomorrowStart.toISOString(), "2026-05-27T00:00:00.000Z");
});

test("computeTodayWindow handles month boundary correctly", () => {
  const now = new Date("2026-05-31T23:59:59.000Z");
  const { todayStart, tomorrowStart } = computeTodayWindow(now);

  assert.equal(todayStart.toISOString(), "2026-05-31T00:00:00.000Z");
  assert.equal(tomorrowStart.toISOString(), "2026-06-01T00:00:00.000Z");
});

test("computeTodayWindow handles year boundary correctly", () => {
  const now = new Date("2026-12-31T10:00:00.000Z");
  const { todayStart, tomorrowStart } = computeTodayWindow(now);

  assert.equal(todayStart.toISOString(), "2026-12-31T00:00:00.000Z");
  assert.equal(tomorrowStart.toISOString(), "2027-01-01T00:00:00.000Z");
});

// ── computeUpcomingWindow ───────────────────────────────────────────────────

test("computeUpcomingWindow starts at tomorrowStart", () => {
  const now = new Date("2026-05-26T08:00:00.000Z");
  const { from } = computeUpcomingWindow(now, 14);

  assert.equal(from.toISOString(), "2026-05-27T00:00:00.000Z");
});

test("computeUpcomingWindow ends exactly N days after tomorrowStart", () => {
  const now = new Date("2026-05-26T08:00:00.000Z");
  const { from, to } = computeUpcomingWindow(now, 14);

  const diffMs = to.getTime() - from.getTime();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  assert.equal(diffDays, 14);
});

test("computeUpcomingWindow respects custom day count", () => {
  const now = new Date("2026-05-26T08:00:00.000Z");
  const { from, to } = computeUpcomingWindow(now, 7);

  const diffDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  assert.equal(diffDays, 7);
});

test("computeUpcomingWindow uses 7 days by default", () => {
  const now = new Date("2026-05-26T08:00:00.000Z");
  const { from: f1, to: t1 } = computeUpcomingWindow(now);
  const { from: f2, to: t2 } = computeUpcomingWindow(now, 7);

  assert.equal(f1.toISOString(), f2.toISOString());
  assert.equal(t1.toISOString(), t2.toISOString());
});

// ── isOverdueEntry ──────────────────────────────────────────────────────────

test("isOverdueEntry returns false for null dueDate", () => {
  const now = new Date("2026-05-26T10:00:00.000Z");
  assert.equal(isOverdueEntry(null, now), false);
});

test("isOverdueEntry returns true for a past date", () => {
  const now = new Date("2026-05-26T10:00:00.000Z");
  const dueDate = new Date("2026-05-25T00:00:00.000Z");
  assert.equal(isOverdueEntry(dueDate, now), true);
});

test("isOverdueEntry returns false for today midnight UTC", () => {
  const now = new Date("2026-05-26T10:00:00.000Z");
  const dueDate = new Date("2026-05-26T00:00:00.000Z");
  assert.equal(isOverdueEntry(dueDate, now), false);
});

test("isOverdueEntry returns false for a future date", () => {
  const now = new Date("2026-05-26T10:00:00.000Z");
  const dueDate = new Date("2026-05-27T00:00:00.000Z");
  assert.equal(isOverdueEntry(dueDate, now), false);
});
