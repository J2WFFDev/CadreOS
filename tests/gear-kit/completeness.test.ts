import { strict as assert } from "node:assert";
import test from "node:test";

import {
  computeKitCompleteness,
  type GearKitComponentSnapshot,
} from "../../lib/gear-kit";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSnapshot(
  overrides: Partial<GearKitComponentSnapshot> = {},
): GearKitComponentSnapshot {
  return {
    kitItemId: "kitem-1",
    gearItemId: "gear-1",
    gearItemName: "Test Item",
    componentRole: "REQUIRED",
    isRequired: true,
    quantityExpected: 1,
    quantityActual: 1,
    removedAt: null,
    lifecycleStatus: "ACTIVE",
    conditionStatus: "GOOD",
    readinessState: "READY",
    ...overrides,
  };
}

// ── Empty kit ─────────────────────────────────────────────────────────────────

test("computeKitCompleteness: empty kit has zero counts", () => {
  const result = computeKitCompleteness([]);
  assert.equal(result.totalComponents, 0);
  assert.equal(result.requiredComponents, 0);
  assert.equal(result.optionalComponents, 0);
  assert.equal(result.presentCount, 0);
  assert.equal(result.missingRequiredCount, 0);
  assert.equal(result.missingOptionalCount, 0);
  assert.equal(result.outOfServiceCount, 0);
  assert.equal(result.requiredCompleteness, 1); // 100% when nothing required
  assert.equal(result.overallCompleteness, 1);
});

// ── Removed items are excluded entirely ───────────────────────────────────────

test("computeKitCompleteness: snapshot with removedAt is excluded from all counts", () => {
  const removed = makeSnapshot({ removedAt: new Date(), isRequired: true });
  const result = computeKitCompleteness([removed]);
  // Removed item is not active — excluded from summaries entirely
  assert.equal(result.totalComponents, 0);
  assert.equal(result.requiredComponents, 0);
  assert.equal(result.missingRequiredCount, 0);
});

// ── Single required item present ──────────────────────────────────────────────

test("computeKitCompleteness: single required active item is complete", () => {
  const result = computeKitCompleteness([makeSnapshot()]);
  assert.equal(result.totalComponents, 1);
  assert.equal(result.requiredComponents, 1);
  assert.equal(result.presentCount, 1);
  assert.equal(result.missingRequiredCount, 0);
  assert.equal(result.requiredCompleteness, 1);
  assert.equal(result.overallCompleteness, 1);
});

// ── LOST item is not present (counts as missing) ──────────────────────────────

test("computeKitCompleteness: LOST required item increases missingRequiredCount", () => {
  const lost = makeSnapshot({ lifecycleStatus: "LOST", isRequired: true });
  const result = computeKitCompleteness([lost]);
  assert.equal(result.missingRequiredCount, 1);
  assert.equal(result.presentCount, 0);
  assert.ok(result.requiredCompleteness < 1);
});

// ── Optional LOST item ────────────────────────────────────────────────────────

test("computeKitCompleteness: LOST optional item increments missingOptionalCount not missingRequired", () => {
  const optional = makeSnapshot({
    lifecycleStatus: "LOST",
    isRequired: false,
  });
  const result = computeKitCompleteness([optional]);
  assert.equal(result.missingRequiredCount, 0);
  assert.equal(result.missingOptionalCount, 1);
  assert.equal(result.requiredCompleteness, 1); // no required items = 100%
});

// ── Out-of-service lifecycle statuses ────────────────────────────────────────

test("computeKitCompleteness: RETIRED item counts as out-of-service", () => {
  const retired = makeSnapshot({ lifecycleStatus: "RETIRED" });
  const result = computeKitCompleteness([retired]);
  assert.equal(result.outOfServiceCount, 1);
});

test("computeKitCompleteness: MAINTENANCE item counts as out-of-service", () => {
  const maint = makeSnapshot({ lifecycleStatus: "MAINTENANCE" });
  const result = computeKitCompleteness([maint]);
  assert.equal(result.outOfServiceCount, 1);
});

test("computeKitCompleteness: QUARANTINED item counts as out-of-service", () => {
  const q = makeSnapshot({ lifecycleStatus: "QUARANTINED" });
  const result = computeKitCompleteness([q]);
  assert.equal(result.outOfServiceCount, 1);
});

test("computeKitCompleteness: LOST item counts as out-of-service", () => {
  const lost = makeSnapshot({ lifecycleStatus: "LOST" });
  const result = computeKitCompleteness([lost]);
  assert.equal(result.outOfServiceCount, 1);
});

// ── Damaged condition ─────────────────────────────────────────────────────────

test("computeKitCompleteness: DAMAGED condition increments damagedCount", () => {
  const damaged = makeSnapshot({ conditionStatus: "DAMAGED" });
  const result = computeKitCompleteness([damaged]);
  assert.equal(result.damagedCount, 1);
});

test("computeKitCompleteness: POOR condition increments damagedCount", () => {
  const poor = makeSnapshot({ conditionStatus: "POOR" });
  const result = computeKitCompleteness([poor]);
  assert.equal(result.damagedCount, 1);
});

test("computeKitCompleteness: GOOD condition does not increment damagedCount", () => {
  const good = makeSnapshot({ conditionStatus: "GOOD" });
  const result = computeKitCompleteness([good]);
  assert.equal(result.damagedCount, 0);
});

// ── Maintenance needed readiness state ────────────────────────────────────────

test("computeKitCompleteness: MAINTENANCE_REQUIRED readiness increments maintenanceNeededCount", () => {
  const snap = makeSnapshot({ readinessState: "MAINTENANCE_REQUIRED" });
  const result = computeKitCompleteness([snap]);
  assert.equal(result.maintenanceNeededCount, 1);
});

test("computeKitCompleteness: NOT_READY readiness increments maintenanceNeededCount", () => {
  const snap = makeSnapshot({ readinessState: "NOT_READY" });
  const result = computeKitCompleteness([snap]);
  assert.equal(result.maintenanceNeededCount, 1);
});

// ── Mixed required and optional ───────────────────────────────────────────────

test("computeKitCompleteness: mixed required and optional items all present", () => {
  const snapshots: GearKitComponentSnapshot[] = [
    makeSnapshot({ kitItemId: "k1", gearItemId: "g1", isRequired: true }),
    makeSnapshot({ kitItemId: "k2", gearItemId: "g2", isRequired: true }),
    makeSnapshot({ kitItemId: "k3", gearItemId: "g3", isRequired: false }),
    makeSnapshot({ kitItemId: "k4", gearItemId: "g4", isRequired: false }),
  ];
  const result = computeKitCompleteness(snapshots);
  assert.equal(result.totalComponents, 4);
  assert.equal(result.requiredComponents, 2);
  assert.equal(result.optionalComponents, 2);
  assert.equal(result.presentCount, 4);
  assert.equal(result.missingRequiredCount, 0);
  assert.equal(result.missingOptionalCount, 0);
  assert.equal(result.requiredCompleteness, 1);
  assert.equal(result.overallCompleteness, 1);
});

test("computeKitCompleteness: one LOST required among mix", () => {
  const snapshots: GearKitComponentSnapshot[] = [
    makeSnapshot({ kitItemId: "k1", gearItemId: "g1", isRequired: true }),
    makeSnapshot({
      kitItemId: "k2",
      gearItemId: "g2",
      isRequired: true,
      lifecycleStatus: "LOST",
    }),
    makeSnapshot({ kitItemId: "k3", gearItemId: "g3", isRequired: false }),
  ];
  const result = computeKitCompleteness(snapshots);
  assert.equal(result.requiredComponents, 2);
  assert.equal(result.missingRequiredCount, 1);
  assert.equal(result.presentCount, 2); // k1 + k3 present
  assert.ok(result.requiredCompleteness < 1);
});

// ── requiredCompleteness fraction ────────────────────────────────────────────

test("computeKitCompleteness: requiredCompleteness is 0.5 when half required present", () => {
  const snapshots: GearKitComponentSnapshot[] = [
    makeSnapshot({ kitItemId: "k1", gearItemId: "g1", isRequired: true }),
    makeSnapshot({
      kitItemId: "k2",
      gearItemId: "g2",
      isRequired: true,
      lifecycleStatus: "LOST",
    }),
  ];
  const result = computeKitCompleteness(snapshots);
  assert.equal(result.requiredCompleteness, 0.5);
});

// ── components array ──────────────────────────────────────────────────────────

test("computeKitCompleteness: components array length matches active input", () => {
  const snapshots = [
    makeSnapshot({ kitItemId: "k1", gearItemId: "g1" }),
    makeSnapshot({ kitItemId: "k2", gearItemId: "g2" }),
    makeSnapshot({ kitItemId: "k3", gearItemId: "g3", removedAt: new Date() }),
  ];
  // removedAt item excluded → only 2 in components
  const result = computeKitCompleteness(snapshots);
  assert.equal(result.components.length, 2);
});

test("computeKitCompleteness: component summary present flag reflects lifecycle", () => {
  const active = makeSnapshot({ kitItemId: "k1", gearItemId: "g1", lifecycleStatus: "ACTIVE" });
  const lost = makeSnapshot({ kitItemId: "k2", gearItemId: "g2", lifecycleStatus: "LOST" });
  const result = computeKitCompleteness([active, lost]);
  const activeSummary = result.components.find((c) => c.kitItemId === "k1");
  const lostSummary = result.components.find((c) => c.kitItemId === "k2");
  assert.equal(activeSummary?.present, true);
  assert.equal(lostSummary?.present, false);
});
