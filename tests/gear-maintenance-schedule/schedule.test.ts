import { strict as assert } from "node:assert";
import test from "node:test";

import {
  buildMaintenanceDueResult,
  buildMaintenanceNotificationHandoff,
  calculateMaintenanceDueStatus,
  calculateNextMaintenanceDueDate,
  formatMaintenanceDueStatus,
  getMaintenanceDueStatusBadgeClass,
  isMaintenanceActionRequired,
  isMaintenanceDueSoon,
  isMaintenanceOverdue,
  MAINTENANCE_FREQUENCY_DAYS,
  resolveMaintenanceIntervalDays,
  shouldBlockByMaintenance,
  type GearMaintenanceItemSnapshot,
  type GearMaintenanceScheduleConfig,
} from "../../lib/gear-maintenance-schedule";

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-01T12:00:00Z");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAYS);
}

function daysFromNow(n: number): Date {
  return new Date(NOW.getTime() + n * DAYS);
}

function baseConfig(overrides: Partial<GearMaintenanceScheduleConfig> = {}): GearMaintenanceScheduleConfig {
  return {
    maintenanceFrequency: null,
    intervalDays: 90,
    intervalUses: null,
    intervalDeployments: null,
    dueSoonDays: 14,
    ...overrides,
  };
}

function baseItem(overrides: Partial<GearMaintenanceItemSnapshot> = {}): GearMaintenanceItemSnapshot {
  return {
    id: "item-1",
    name: "Body Armor",
    nextMaintenanceDueAt: null,
    maintenanceDueStatus: "NOT_SCHEDULED",
    totalUseCount: 0,
    totalDeploymentCount: 0,
    lastMaintenanceWasPostEvent: false,
    ...overrides,
  };
}

// ── MAINTENANCE_FREQUENCY_DAYS mapping ────────────────────────────────────────

test("MAINTENANCE_FREQUENCY_DAYS maps all legacy frequencies", () => {
  assert.equal(MAINTENANCE_FREQUENCY_DAYS.AS_NEEDED, null);
  assert.equal(MAINTENANCE_FREQUENCY_DAYS.MONTHLY, 30);
  assert.equal(MAINTENANCE_FREQUENCY_DAYS.QUARTERLY, 91);
  assert.equal(MAINTENANCE_FREQUENCY_DAYS.SEMI_ANNUAL, 182);
  assert.equal(MAINTENANCE_FREQUENCY_DAYS.ANNUAL, 365);
});

// ── resolveMaintenanceIntervalDays ────────────────────────────────────────────

test("resolveMaintenanceIntervalDays prefers explicit intervalDays", () => {
  const days = resolveMaintenanceIntervalDays(
    baseConfig({ intervalDays: 45, maintenanceFrequency: "MONTHLY" }),
  );
  assert.equal(days, 45);
});

test("resolveMaintenanceIntervalDays falls back to maintenanceFrequency", () => {
  const days = resolveMaintenanceIntervalDays(
    baseConfig({ intervalDays: null, maintenanceFrequency: "QUARTERLY" }),
  );
  assert.equal(days, 91);
});

test("resolveMaintenanceIntervalDays returns null for AS_NEEDED", () => {
  const days = resolveMaintenanceIntervalDays(
    baseConfig({ intervalDays: null, maintenanceFrequency: "AS_NEEDED" }),
  );
  assert.equal(days, null);
});

test("resolveMaintenanceIntervalDays returns null when nothing configured", () => {
  const days = resolveMaintenanceIntervalDays(
    baseConfig({ intervalDays: null, maintenanceFrequency: null }),
  );
  assert.equal(days, null);
});

// ── calculateNextMaintenanceDueDate ───────────────────────────────────────────

test("calculateNextMaintenanceDueDate returns null when performedAt is null", () => {
  assert.equal(calculateNextMaintenanceDueDate(baseConfig(), null), null);
});

test("calculateNextMaintenanceDueDate returns null when no day interval configured", () => {
  const config = baseConfig({ intervalDays: null, maintenanceFrequency: null });
  assert.equal(calculateNextMaintenanceDueDate(config, daysAgo(30)), null);
});

test("calculateNextMaintenanceDueDate returns correct date for day interval", () => {
  const performedAt = daysAgo(0);
  const result = calculateNextMaintenanceDueDate(
    baseConfig({ intervalDays: 30 }),
    performedAt,
  );
  assert.ok(result !== null);
  assert.equal(result.getTime(), performedAt.getTime() + 30 * DAYS);
});

test("calculateNextMaintenanceDueDate uses ANNUAL frequency correctly", () => {
  const performedAt = daysAgo(0);
  const result = calculateNextMaintenanceDueDate(
    baseConfig({ intervalDays: null, maintenanceFrequency: "ANNUAL" }),
    performedAt,
  );
  assert.ok(result !== null);
  assert.equal(result.getTime(), performedAt.getTime() + 365 * DAYS);
});

// ── calculateMaintenanceDueStatus ─────────────────────────────────────────────

test("calculateMaintenanceDueStatus returns NOT_SCHEDULED when no intervals", () => {
  const status = calculateMaintenanceDueStatus(
    baseConfig({ intervalDays: null, maintenanceFrequency: null }),
    baseItem({ nextMaintenanceDueAt: null }),
    NOW,
  );
  assert.equal(status, "NOT_SCHEDULED");
});

test("calculateMaintenanceDueStatus returns OVERDUE when past due date", () => {
  const status = calculateMaintenanceDueStatus(
    baseConfig({ intervalDays: 30 }),
    baseItem({ nextMaintenanceDueAt: daysAgo(1) }),
    NOW,
  );
  assert.equal(status, "OVERDUE");
});

test("calculateMaintenanceDueStatus returns DUE when no nextMaintenanceDueAt set", () => {
  const status = calculateMaintenanceDueStatus(
    baseConfig({ intervalDays: 30 }),
    baseItem({ nextMaintenanceDueAt: null }),
    NOW,
  );
  assert.equal(status, "DUE");
});

test("calculateMaintenanceDueStatus returns DUE_SOON within dueSoonDays window", () => {
  const status = calculateMaintenanceDueStatus(
    baseConfig({ intervalDays: 30, dueSoonDays: 14 }),
    baseItem({ nextMaintenanceDueAt: daysFromNow(7) }),
    NOW,
  );
  assert.equal(status, "DUE_SOON");
});

test("calculateMaintenanceDueStatus returns CURRENT when well ahead", () => {
  const status = calculateMaintenanceDueStatus(
    baseConfig({ intervalDays: 90, dueSoonDays: 14 }),
    baseItem({ nextMaintenanceDueAt: daysFromNow(60) }),
    NOW,
  );
  assert.equal(status, "CURRENT");
});

test("calculateMaintenanceDueStatus returns OVERDUE for use-count based when threshold exceeded", () => {
  const status = calculateMaintenanceDueStatus(
    baseConfig({ intervalDays: null, maintenanceFrequency: null, intervalUses: 20 }),
    baseItem({ totalUseCount: 20 }),
    NOW,
  );
  assert.equal(status, "OVERDUE");
});

test("calculateMaintenanceDueStatus returns DUE_SOON for use-count within 10% of threshold", () => {
  const status = calculateMaintenanceDueStatus(
    baseConfig({ intervalDays: null, maintenanceFrequency: null, intervalUses: 100 }),
    baseItem({ totalUseCount: 91 }),
    NOW,
  );
  assert.equal(status, "DUE_SOON");
});

test("calculateMaintenanceDueStatus returns OVERDUE for deployment-count exceeded", () => {
  const status = calculateMaintenanceDueStatus(
    baseConfig({ intervalDays: null, maintenanceFrequency: null, intervalDeployments: 10 }),
    baseItem({ totalDeploymentCount: 12 }),
    NOW,
  );
  assert.equal(status, "OVERDUE");
});

test("calculateMaintenanceDueStatus worst status wins when multiple intervals configured", () => {
  // Date-based: CURRENT; use-based: OVERDUE → expect OVERDUE
  const status = calculateMaintenanceDueStatus(
    baseConfig({ intervalDays: 90, dueSoonDays: 14, intervalUses: 10 }),
    baseItem({ nextMaintenanceDueAt: daysFromNow(60), totalUseCount: 10 }),
    NOW,
  );
  assert.equal(status, "OVERDUE");
});

// ── buildMaintenanceDueResult ─────────────────────────────────────────────────

test("buildMaintenanceDueResult returns correct shape for OVERDUE item", () => {
  const item = baseItem({ nextMaintenanceDueAt: daysAgo(3) });
  const result = buildMaintenanceDueResult(item, baseConfig(), NOW);

  assert.equal(result.itemId, "item-1");
  assert.equal(result.itemName, "Body Armor");
  assert.equal(result.status, "OVERDUE");
  assert.equal(result.actionRequired, true);
  assert.equal(result.isOverdue, true);
});

test("buildMaintenanceDueResult returns correct shape for CURRENT item", () => {
  const item = baseItem({ nextMaintenanceDueAt: daysFromNow(45) });
  const result = buildMaintenanceDueResult(item, baseConfig(), NOW);

  assert.equal(result.status, "CURRENT");
  assert.equal(result.actionRequired, false);
  assert.equal(result.isOverdue, false);
});

// ── isMaintenanceOverdue / isMaintenanceDueSoon / isMaintenanceActionRequired ─

test("isMaintenanceOverdue returns true only for OVERDUE", () => {
  assert.equal(isMaintenanceOverdue("OVERDUE"), true);
  assert.equal(isMaintenanceOverdue("DUE"), false);
  assert.equal(isMaintenanceOverdue("DUE_SOON"), false);
  assert.equal(isMaintenanceOverdue("CURRENT"), false);
  assert.equal(isMaintenanceOverdue("NOT_SCHEDULED"), false);
});

test("isMaintenanceDueSoon returns true only for DUE_SOON", () => {
  assert.equal(isMaintenanceDueSoon("DUE_SOON"), true);
  assert.equal(isMaintenanceDueSoon("DUE"), false);
  assert.equal(isMaintenanceDueSoon("OVERDUE"), false);
});

test("isMaintenanceActionRequired returns true for DUE and OVERDUE", () => {
  assert.equal(isMaintenanceActionRequired("DUE"), true);
  assert.equal(isMaintenanceActionRequired("OVERDUE"), true);
  assert.equal(isMaintenanceActionRequired("DUE_SOON"), false);
  assert.equal(isMaintenanceActionRequired("CURRENT"), false);
  assert.equal(isMaintenanceActionRequired("NOT_SCHEDULED"), false);
});

// ── shouldBlockByMaintenance ──────────────────────────────────────────────────

test("shouldBlockByMaintenance returns false when blockOnOverdue is false", () => {
  assert.equal(shouldBlockByMaintenance("OVERDUE", false), false);
});

test("shouldBlockByMaintenance returns true when blockOnOverdue is true and OVERDUE", () => {
  assert.equal(shouldBlockByMaintenance("OVERDUE", true), true);
});

test("shouldBlockByMaintenance returns false for DUE even when blockOnOverdue is true", () => {
  assert.equal(shouldBlockByMaintenance("DUE", true), false);
});

// ── buildMaintenanceNotificationHandoff ───────────────────────────────────────

test("buildMaintenanceNotificationHandoff sets high severity for OVERDUE", () => {
  const handoff = buildMaintenanceNotificationHandoff(
    "MAINTENANCE_OVERDUE",
    "org-1",
    "item-1",
    "Body Armor",
    {},
    NOW,
  );
  assert.equal(handoff.kind, "MAINTENANCE_OVERDUE");
  assert.equal(handoff.severity, "high");
  assert.equal(handoff.organizationId, "org-1");
  assert.equal(handoff.gearItemId, "item-1");
  assert.ok(handoff.occurredAt.length > 0);
});

test("buildMaintenanceNotificationHandoff sets medium severity for MAINTENANCE_DUE", () => {
  const handoff = buildMaintenanceNotificationHandoff(
    "MAINTENANCE_DUE",
    "org-1",
    "item-1",
    "Body Armor",
  );
  assert.equal(handoff.severity, "medium");
});

test("buildMaintenanceNotificationHandoff merges extra payload", () => {
  const handoff = buildMaintenanceNotificationHandoff(
    "MAINTENANCE_COMPLETED",
    "org-1",
    "item-1",
    "Body Armor",
    { completedByPersonId: "person-5" },
  );
  assert.equal(handoff.payload.completedByPersonId, "person-5");
});

// ── Format/badge helpers ──────────────────────────────────────────────────────

test("formatMaintenanceDueStatus returns readable labels for all values", () => {
  assert.equal(formatMaintenanceDueStatus("NOT_SCHEDULED"), "Not scheduled");
  assert.equal(formatMaintenanceDueStatus("CURRENT"), "Current");
  assert.equal(formatMaintenanceDueStatus("DUE_SOON"), "Due soon");
  assert.equal(formatMaintenanceDueStatus("DUE"), "Due");
  assert.equal(formatMaintenanceDueStatus("OVERDUE"), "Overdue");
});

test("getMaintenanceDueStatusBadgeClass returns non-empty strings for all statuses", () => {
  const statuses = ["NOT_SCHEDULED", "CURRENT", "DUE_SOON", "DUE", "OVERDUE"] as const;
  for (const s of statuses) {
    assert.ok(getMaintenanceDueStatusBadgeClass(s).length > 0, `Expected non-empty class for ${s}`);
  }
});
