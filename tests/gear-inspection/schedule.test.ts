import { strict as assert } from "node:assert";
import test from "node:test";

import {
  buildDefaultChecklistItems,
  buildInspectionDueResult,
  buildPreEventInspectionGaps,
  calculateInspectionDueStatus,
  calculateNextInspectionDueDate,
  evaluateChecklist,
  formatInspectionDueStatus,
  formatInspectionResult,
  getInspectionDueStatusBadgeClass,
  isInspectionDueSoon,
  isInspectionOverdue,
  shouldBlockByInspection,
  type GearInspectionItemSnapshot,
  type GearInspectionScheduleConfig,
} from "../../lib/gear-inspection";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS = 24 * 60 * 60 * 1000;

function daysAgo(n: number, from = new Date("2026-06-01T12:00:00Z")): Date {
  return new Date(from.getTime() - n * DAYS);
}

function daysFromNow(n: number, from = new Date("2026-06-01T12:00:00Z")): Date {
  return new Date(from.getTime() + n * DAYS);
}

const NOW = new Date("2026-06-01T12:00:00Z");

function baseConfig(overrides: Partial<GearInspectionScheduleConfig> = {}): GearInspectionScheduleConfig {
  return {
    intervalType: "EVERY_N_DAYS",
    intervalDays: 90,
    intervalUses: null,
    intervalDeployments: null,
    dueSoonDays: 14,
    requiresPreEventInspection: false,
    requiresPostEventInspection: false,
    ...overrides,
  };
}

function baseItem(overrides: Partial<GearInspectionItemSnapshot> = {}): GearInspectionItemSnapshot {
  return {
    id: "item-1",
    name: "Duty Radio",
    lastInspectedAt: null,
    lastInspectionResult: null,
    nextInspectionDueAt: null,
    inspectionDueStatus: "NOT_SCHEDULED",
    totalUseCount: 0,
    totalDeploymentCount: 0,
    ...overrides,
  };
}

// ── calculateNextInspectionDueDate ────────────────────────────────────────────

test("calculateNextInspectionDueDate returns null when no performedAt", () => {
  const result = calculateNextInspectionDueDate(baseConfig(), null);
  assert.equal(result, null);
});

test("calculateNextInspectionDueDate returns null when intervalType is EVERY_USE", () => {
  const result = calculateNextInspectionDueDate(
    baseConfig({ intervalType: "EVERY_USE" }),
    daysAgo(30),
  );
  assert.equal(result, null);
});

test("calculateNextInspectionDueDate returns null when intervalType is BEFORE_EVENT", () => {
  const result = calculateNextInspectionDueDate(
    baseConfig({ intervalType: "BEFORE_EVENT" }),
    daysAgo(30),
  );
  assert.equal(result, null);
});

test("calculateNextInspectionDueDate returns null when intervalType is AFTER_EVENT", () => {
  const result = calculateNextInspectionDueDate(
    baseConfig({ intervalType: "AFTER_EVENT" }),
    daysAgo(30),
  );
  assert.equal(result, null);
});

test("calculateNextInspectionDueDate handles EVERY_N_DAYS with explicit intervalDays", () => {
  const performedAt = daysAgo(0);
  const result = calculateNextInspectionDueDate(baseConfig({ intervalType: "EVERY_N_DAYS", intervalDays: 30 }), performedAt);
  assert.ok(result !== null);
  assert.equal(result.getTime(), performedAt.getTime() + 30 * DAYS);
});

test("calculateNextInspectionDueDate handles WEEKLY", () => {
  const performedAt = daysAgo(0);
  const result = calculateNextInspectionDueDate(baseConfig({ intervalType: "WEEKLY", intervalDays: null }), performedAt);
  assert.ok(result !== null);
  assert.equal(result.getTime(), performedAt.getTime() + 7 * DAYS);
});

test("calculateNextInspectionDueDate handles MONTHLY", () => {
  const performedAt = daysAgo(0);
  const result = calculateNextInspectionDueDate(baseConfig({ intervalType: "MONTHLY", intervalDays: null }), performedAt);
  assert.ok(result !== null);
  assert.equal(result.getTime(), performedAt.getTime() + 30 * DAYS);
});

test("calculateNextInspectionDueDate handles QUARTERLY", () => {
  const performedAt = daysAgo(0);
  const result = calculateNextInspectionDueDate(baseConfig({ intervalType: "QUARTERLY", intervalDays: null }), performedAt);
  assert.ok(result !== null);
  assert.equal(result.getTime(), performedAt.getTime() + 91 * DAYS);
});

test("calculateNextInspectionDueDate handles ANNUALLY", () => {
  const performedAt = daysAgo(0);
  const result = calculateNextInspectionDueDate(baseConfig({ intervalType: "ANNUALLY", intervalDays: null }), performedAt);
  assert.ok(result !== null);
  assert.equal(result.getTime(), performedAt.getTime() + 365 * DAYS);
});

test("calculateNextInspectionDueDate returns null for AFTER_N_USES (no date)", () => {
  const result = calculateNextInspectionDueDate(
    baseConfig({ intervalType: "AFTER_N_USES", intervalUses: 10 }),
    daysAgo(5),
  );
  assert.equal(result, null);
});

test("calculateNextInspectionDueDate returns null for AFTER_N_DEPLOYMENTS (no date)", () => {
  const result = calculateNextInspectionDueDate(
    baseConfig({ intervalType: "AFTER_N_DEPLOYMENTS", intervalDeployments: 5 }),
    daysAgo(5),
  );
  assert.equal(result, null);
});

test("calculateNextInspectionDueDate handles MANUAL_DATE by returning null (no interval)", () => {
  const result = calculateNextInspectionDueDate(
    baseConfig({ intervalType: "MANUAL_DATE", intervalDays: null }),
    daysAgo(10),
  );
  assert.equal(result, null);
});

// ── calculateInspectionDueStatus ──────────────────────────────────────────────

test("calculateInspectionDueStatus returns NOT_SCHEDULED when no interval configured", () => {
  const status = calculateInspectionDueStatus(
    baseConfig({ intervalType: null }),
    baseItem({ nextInspectionDueAt: null }),
    NOW,
  );
  assert.equal(status, "NOT_SCHEDULED");
});

test("calculateInspectionDueStatus returns NOT_SCHEDULED for EVERY_USE (context-driven)", () => {
  const status = calculateInspectionDueStatus(
    baseConfig({ intervalType: "EVERY_USE" }),
    baseItem(),
    NOW,
  );
  assert.equal(status, "NOT_SCHEDULED");
});

test("calculateInspectionDueStatus returns OVERDUE when past due date", () => {
  const status = calculateInspectionDueStatus(
    baseConfig({ intervalType: "EVERY_N_DAYS", intervalDays: 30 }),
    baseItem({ nextInspectionDueAt: daysAgo(1) }),
    NOW,
  );
  assert.equal(status, "OVERDUE");
});

test("calculateInspectionDueStatus returns DUE_SOON within dueSoonDays window", () => {
  const status = calculateInspectionDueStatus(
    baseConfig({ intervalType: "EVERY_N_DAYS", intervalDays: 30, dueSoonDays: 14 }),
    baseItem({ nextInspectionDueAt: daysFromNow(7) }),
    NOW,
  );
  assert.equal(status, "DUE_SOON");
});

test("calculateInspectionDueStatus returns CURRENT when well ahead of due date", () => {
  const status = calculateInspectionDueStatus(
    baseConfig({ intervalType: "EVERY_N_DAYS", intervalDays: 90, dueSoonDays: 14 }),
    baseItem({ nextInspectionDueAt: daysFromNow(60) }),
    NOW,
  );
  assert.equal(status, "CURRENT");
});

test("calculateInspectionDueStatus returns DUE when no nextInspectionDueAt set for date interval", () => {
  const status = calculateInspectionDueStatus(
    baseConfig({ intervalType: "EVERY_N_DAYS", intervalDays: 30 }),
    baseItem({ nextInspectionDueAt: null }),
    NOW,
  );
  assert.equal(status, "DUE");
});

test("calculateInspectionDueStatus returns OVERDUE for AFTER_N_USES when count reached", () => {
  const status = calculateInspectionDueStatus(
    baseConfig({ intervalType: "AFTER_N_USES", intervalUses: 10 }),
    baseItem({ totalUseCount: 10 }),
    NOW,
  );
  assert.equal(status, "OVERDUE");
});

test("calculateInspectionDueStatus returns DUE_SOON for AFTER_N_USES when within 10%", () => {
  const status = calculateInspectionDueStatus(
    baseConfig({ intervalType: "AFTER_N_USES", intervalUses: 10 }),
    baseItem({ totalUseCount: 9 }),
    NOW,
  );
  assert.equal(status, "DUE_SOON");
});

test("calculateInspectionDueStatus returns CURRENT for AFTER_N_USES when well under threshold", () => {
  const status = calculateInspectionDueStatus(
    baseConfig({ intervalType: "AFTER_N_USES", intervalUses: 100 }),
    baseItem({ totalUseCount: 20 }),
    NOW,
  );
  assert.equal(status, "CURRENT");
});

test("calculateInspectionDueStatus returns OVERDUE for AFTER_N_DEPLOYMENTS when count exceeded", () => {
  const status = calculateInspectionDueStatus(
    baseConfig({ intervalType: "AFTER_N_DEPLOYMENTS", intervalDeployments: 5 }),
    baseItem({ totalDeploymentCount: 6 }),
    NOW,
  );
  assert.equal(status, "OVERDUE");
});

test("calculateInspectionDueStatus picks worst status when multiple interval types configured", () => {
  // Date-based: CURRENT; use-based: OVERDUE → result should be OVERDUE
  const status = calculateInspectionDueStatus(
    baseConfig({ intervalType: "AFTER_N_USES", intervalUses: 10, intervalDays: 90, dueSoonDays: 14 }),
    baseItem({ totalUseCount: 10, nextInspectionDueAt: daysFromNow(60) }),
    NOW,
  );
  assert.equal(status, "OVERDUE");
});

// ── buildInspectionDueResult ──────────────────────────────────────────────────

test("buildInspectionDueResult returns correct shape for OVERDUE item", () => {
  const item = baseItem({ nextInspectionDueAt: daysAgo(5) });
  const result = buildInspectionDueResult(item, baseConfig(), NOW);

  assert.equal(result.itemId, "item-1");
  assert.equal(result.itemName, "Duty Radio");
  assert.equal(result.status, "OVERDUE");
  assert.equal(result.actionRequired, true);
  assert.equal(result.isOverdue, true);
});

test("buildInspectionDueResult returns correct shape for CURRENT item", () => {
  const item = baseItem({ nextInspectionDueAt: daysFromNow(60) });
  const result = buildInspectionDueResult(item, baseConfig(), NOW);

  assert.equal(result.status, "CURRENT");
  assert.equal(result.actionRequired, false);
  assert.equal(result.isOverdue, false);
});

// ── isInspectionOverdue / isInspectionDueSoon ─────────────────────────────────

test("isInspectionOverdue returns true only for OVERDUE", () => {
  assert.equal(isInspectionOverdue("OVERDUE"), true);
  assert.equal(isInspectionOverdue("DUE"), false);
  assert.equal(isInspectionOverdue("DUE_SOON"), false);
  assert.equal(isInspectionOverdue("CURRENT"), false);
  assert.equal(isInspectionOverdue("NOT_SCHEDULED"), false);
});

test("isInspectionDueSoon returns true only for DUE_SOON", () => {
  assert.equal(isInspectionDueSoon("DUE_SOON"), true);
  assert.equal(isInspectionDueSoon("DUE"), false);
  assert.equal(isInspectionDueSoon("OVERDUE"), false);
});

// ── shouldBlockByInspection ───────────────────────────────────────────────────

test("shouldBlockByInspection returns false when blockOnOverdue is false", () => {
  assert.equal(shouldBlockByInspection("OVERDUE", false), false);
});

test("shouldBlockByInspection returns true when blockOnOverdue is true and status is OVERDUE", () => {
  assert.equal(shouldBlockByInspection("OVERDUE", true), true);
});

test("shouldBlockByInspection returns false for DUE even when blockOnOverdue is true", () => {
  assert.equal(shouldBlockByInspection("DUE", true), false);
});

// ── evaluateChecklist ─────────────────────────────────────────────────────────

test("evaluateChecklist returns overallPassed=false for empty items", () => {
  const result = evaluateChecklist([]);
  assert.equal(result.overallPassed, false);
  assert.equal(result.failedCount, 0);
  assert.equal(result.passedCount, 0);
});

test("evaluateChecklist returns overallPassed=true when all items pass", () => {
  const items = buildDefaultChecklistItems("generic").map((i) => ({ ...i, result: "pass" as const }));
  const result = evaluateChecklist(items);
  assert.equal(result.overallPassed, true);
  assert.equal(result.failedCount, 0);
  assert.equal(result.passedCount, items.length);
});

test("evaluateChecklist returns overallPassed=false when any item fails", () => {
  const items = buildDefaultChecklistItems("generic").map((i, idx) => ({
    ...i,
    result: idx === 0 ? ("fail" as const) : ("pass" as const),
  }));
  const result = evaluateChecklist(items);
  assert.equal(result.overallPassed, false);
  assert.equal(result.failedCount, 1);
});

test("evaluateChecklist counts NA items separately", () => {
  const items = buildDefaultChecklistItems("generic").map((i, idx) => ({
    ...i,
    result: idx === 0 ? ("na" as const) : ("pass" as const),
  }));
  const result = evaluateChecklist(items);
  assert.equal(result.naCount, 1);
  assert.ok(result.passedCount > 0);
});

// ── buildPreEventInspectionGaps ───────────────────────────────────────────────

function basePreEventItem(overrides: Partial<GearInspectionItemSnapshot> & { categoryRequiresPreEvent?: boolean } = {}) {
  return {
    ...baseItem(),
    lastInspectedAt: null,
    lastInspectionResult: null as Parameters<typeof buildPreEventInspectionGaps>[0][number]["lastInspectionResult"],
    categoryRequiresPreEvent: false,
    ...overrides,
  };
}

test("buildPreEventInspectionGaps returns empty when no overdue items", () => {
  const gaps = buildPreEventInspectionGaps([
    basePreEventItem({ inspectionDueStatus: "CURRENT" }),
    basePreEventItem({ id: "item-2", name: "Kit", inspectionDueStatus: "DUE_SOON" }),
  ]);
  assert.equal(gaps.length, 0);
});

test("buildPreEventInspectionGaps surfaces OVERDUE inspection", () => {
  const gaps = buildPreEventInspectionGaps([
    basePreEventItem({ inspectionDueStatus: "OVERDUE" }),
  ]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].reason, "INSPECTION_OVERDUE");
  assert.equal(gaps[0].severity, "high");
});

test("buildPreEventInspectionGaps surfaces DUE inspection as medium severity", () => {
  const gaps = buildPreEventInspectionGaps([
    basePreEventItem({ inspectionDueStatus: "DUE" }),
  ]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].reason, "INSPECTION_DUE");
  assert.equal(gaps[0].severity, "medium");
});

test("buildPreEventInspectionGaps surfaces LAST_FAILED for failed inspection result", () => {
  const gaps = buildPreEventInspectionGaps([
    basePreEventItem({ inspectionDueStatus: "CURRENT", lastInspectionResult: "FAILED" }),
  ]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].reason, "LAST_FAILED");
  assert.equal(gaps[0].severity, "high");
});

test("buildPreEventInspectionGaps surfaces PRE_EVENT_REQUIRED when category requires pre-event and never inspected", () => {
  const gaps = buildPreEventInspectionGaps([
    basePreEventItem({ inspectionDueStatus: "NOT_SCHEDULED", categoryRequiresPreEvent: true, lastInspectedAt: null }),
  ]);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].reason, "PRE_EVENT_REQUIRED");
});

test("buildPreEventInspectionGaps does not flag PRE_EVENT_REQUIRED when item was previously inspected", () => {
  const gaps = buildPreEventInspectionGaps([
    basePreEventItem({
      inspectionDueStatus: "NOT_SCHEDULED",
      categoryRequiresPreEvent: true,
      lastInspectedAt: daysAgo(5),
    }),
  ]);
  assert.equal(gaps.length, 0);
});

// ── Format/badge helpers ──────────────────────────────────────────────────────

test("formatInspectionDueStatus returns readable labels", () => {
  assert.equal(formatInspectionDueStatus("NOT_SCHEDULED"), "Not scheduled");
  assert.equal(formatInspectionDueStatus("CURRENT"), "Current");
  assert.equal(formatInspectionDueStatus("DUE_SOON"), "Due soon");
  assert.equal(formatInspectionDueStatus("DUE"), "Due");
  assert.equal(formatInspectionDueStatus("OVERDUE"), "Overdue");
});

test("getInspectionDueStatusBadgeClass returns non-empty strings for all statuses", () => {
  const statuses = ["NOT_SCHEDULED", "CURRENT", "DUE_SOON", "DUE", "OVERDUE"] as const;
  for (const s of statuses) {
    assert.ok(getInspectionDueStatusBadgeClass(s).length > 0, `Expected non-empty class for ${s}`);
  }
});

test("formatInspectionResult returns readable labels for all values", () => {
  assert.equal(formatInspectionResult("PASSED"), "Passed");
  assert.equal(formatInspectionResult("PASSED_WITH_NOTES"), "Passed with notes");
  assert.equal(formatInspectionResult("FAILED"), "Failed");
  assert.equal(formatInspectionResult("MAINTENANCE_NEEDED"), "Maintenance needed");
  assert.equal(formatInspectionResult("OUT_OF_SERVICE"), "Out of service");
  assert.equal(formatInspectionResult("LIMITED_USE"), "Limited use");
});

// ── buildDefaultChecklistItems ────────────────────────────────────────────────

test("buildDefaultChecklistItems returns non-empty list for generic category", () => {
  const items = buildDefaultChecklistItems("generic");
  assert.ok(items.length > 0);
});

test("buildDefaultChecklistItems returns items with unique keys", () => {
  const items = buildDefaultChecklistItems("generic");
  const keys = new Set(items.map((i) => i.key));
  assert.equal(keys.size, items.length);
});

test("buildDefaultChecklistItems returns category-specific items for firearm", () => {
  const items = buildDefaultChecklistItems("firearm");
  assert.ok(items.length > 0);
  const labels = items.map((i) => i.label.toLowerCase());
  assert.ok(labels.some((l) => l.includes("safe") || l.includes("barrel") || l.includes("feed") || l.includes("trigger")));
});
