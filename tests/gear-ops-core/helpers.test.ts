import { strict as assert } from "node:assert";
import test from "node:test";

import {
  formatGearOpsDateTime,
  formatGearOpsEnum,
  getGearConditionBadgeClass,
  getGearLifecycleBadgeClass,
  getReadinessBadgeClass,
} from "../../lib/gear-ops";

// ---------------------------------------------------------------------------
// formatGearOpsEnum
// ---------------------------------------------------------------------------

test("formatGearOpsEnum converts SNAKE_CASE to Title Case", () => {
  assert.equal(formatGearOpsEnum("ACTIVE"), "Active");
  assert.equal(formatGearOpsEnum("MAINTENANCE_REQUIRED"), "Maintenance Required");
  assert.equal(formatGearOpsEnum("CHECKED_OUT"), "Checked Out");
  assert.equal(formatGearOpsEnum("ORGANIZATION_OWNED"), "Organization Owned");
});

test("formatGearOpsEnum handles single-word values", () => {
  assert.equal(formatGearOpsEnum("READY"), "Ready");
  assert.equal(formatGearOpsEnum("LOST"), "Lost");
});

// ---------------------------------------------------------------------------
// formatGearOpsDateTime
// ---------------------------------------------------------------------------

test("formatGearOpsDateTime returns em dash for null input", () => {
  assert.equal(formatGearOpsDateTime(null), "—");
});

test("formatGearOpsDateTime returns UTC datetime string for a valid Date", () => {
  const dt = new Date("2026-05-26T14:30:00Z");
  const result = formatGearOpsDateTime(dt);
  assert.equal(result, "2026-05-26 14:30 UTC");
});

test("formatGearOpsDateTime preserves minutes in the output", () => {
  const dt = new Date("2026-05-26T09:05:00Z");
  const result = formatGearOpsDateTime(dt);
  assert.ok(result.includes("09:05"), `Expected '09:05' in '${result}'`);
});

// ---------------------------------------------------------------------------
// getGearConditionBadgeClass
// ---------------------------------------------------------------------------

test("getGearConditionBadgeClass returns neutral class for null condition", () => {
  const cls = getGearConditionBadgeClass(null);
  assert.ok(cls.includes("zinc"), `Expected zinc class for null, got '${cls}'`);
});

test("getGearConditionBadgeClass returns emerald class for NEW and GOOD", () => {
  const newCls = getGearConditionBadgeClass("NEW");
  const goodCls = getGearConditionBadgeClass("GOOD");
  assert.ok(newCls.includes("emerald"), `Expected emerald for NEW, got '${newCls}'`);
  assert.ok(goodCls.includes("emerald"), `Expected emerald for GOOD, got '${goodCls}'`);
});

test("getGearConditionBadgeClass returns blue class for FAIR", () => {
  const cls = getGearConditionBadgeClass("FAIR");
  assert.ok(cls.includes("blue"), `Expected blue for FAIR, got '${cls}'`);
});

test("getGearConditionBadgeClass returns amber class for POOR and DAMAGED", () => {
  const poorCls = getGearConditionBadgeClass("POOR");
  const damagedCls = getGearConditionBadgeClass("DAMAGED");
  assert.ok(poorCls.includes("amber"), `Expected amber for POOR, got '${poorCls}'`);
  assert.ok(damagedCls.includes("amber"), `Expected amber for DAMAGED, got '${damagedCls}'`);
});

// ---------------------------------------------------------------------------
// getGearLifecycleBadgeClass
// ---------------------------------------------------------------------------

test("getGearLifecycleBadgeClass returns emerald class for ACTIVE", () => {
  const cls = getGearLifecycleBadgeClass("ACTIVE");
  assert.ok(cls.includes("emerald"), `Expected emerald for ACTIVE, got '${cls}'`);
});

test("getGearLifecycleBadgeClass returns rose class for RETIRED and LOST", () => {
  const retiredCls = getGearLifecycleBadgeClass("RETIRED");
  const lostCls = getGearLifecycleBadgeClass("LOST");
  assert.ok(retiredCls.includes("rose"), `Expected rose for RETIRED, got '${retiredCls}'`);
  assert.ok(lostCls.includes("rose"), `Expected rose for LOST, got '${lostCls}'`);
});

test("getGearLifecycleBadgeClass returns amber class for MAINTENANCE and QUARANTINED", () => {
  const maintenanceCls = getGearLifecycleBadgeClass("MAINTENANCE");
  const quarantinedCls = getGearLifecycleBadgeClass("QUARANTINED");
  assert.ok(maintenanceCls.includes("amber"), `Expected amber for MAINTENANCE, got '${maintenanceCls}'`);
  assert.ok(quarantinedCls.includes("amber"), `Expected amber for QUARANTINED, got '${quarantinedCls}'`);
});

test("getGearLifecycleBadgeClass returns violet class for RESERVED", () => {
  const cls = getGearLifecycleBadgeClass("RESERVED");
  assert.ok(cls.includes("violet"), `Expected violet for RESERVED, got '${cls}'`);
});

// ---------------------------------------------------------------------------
// getReadinessBadgeClass (gear-ops.ts version)
// ---------------------------------------------------------------------------

test("getReadinessBadgeClass returns zinc class for null readiness state", () => {
  const cls = getReadinessBadgeClass(null);
  assert.ok(cls.includes("zinc"), `Expected zinc for null, got '${cls}'`);
});

test("getReadinessBadgeClass returns emerald class for READY", () => {
  const cls = getReadinessBadgeClass("READY");
  assert.ok(cls.includes("emerald"), `Expected emerald for READY, got '${cls}'`);
});

test("getReadinessBadgeClass returns rose class for DECOMMISSIONED", () => {
  const cls = getReadinessBadgeClass("DECOMMISSIONED");
  assert.ok(cls.includes("rose"), `Expected rose for DECOMMISSIONED, got '${cls}'`);
});

test("getReadinessBadgeClass returns amber class for MAINTENANCE_REQUIRED and NOT_READY", () => {
  const maintenanceCls = getReadinessBadgeClass("MAINTENANCE_REQUIRED");
  const notReadyCls = getReadinessBadgeClass("NOT_READY");
  assert.ok(maintenanceCls.includes("amber"), `Expected amber for MAINTENANCE_REQUIRED, got '${maintenanceCls}'`);
  assert.ok(notReadyCls.includes("amber"), `Expected amber for NOT_READY, got '${notReadyCls}'`);
});

test("getReadinessBadgeClass returns blue class for NEEDS_INSPECTION", () => {
  const cls = getReadinessBadgeClass("NEEDS_INSPECTION");
  assert.ok(cls.includes("blue"), `Expected blue for NEEDS_INSPECTION, got '${cls}'`);
});
