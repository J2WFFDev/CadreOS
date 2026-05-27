import { strict as assert } from "node:assert";
import test from "node:test";

import {
  computeKitCompleteness,
  computeKitReadiness,
  isKitBlockedFromUse,
  isKitOperationallyReady,
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

function readinessFor(
  snapshots: GearKitComponentSnapshot[],
  extra: {
    custodyStatus?: import("@prisma/client").GearKitCustodyStatus;
    lastInspectionStatus?: import("@prisma/client").GearKitInspectionStatus | null;
    hasConflict?: boolean;
  } = {},
) {
  const completeness = computeKitCompleteness(snapshots);
  return computeKitReadiness({
    completeness,
    custodyStatus: extra.custodyStatus ?? "AVAILABLE",
    lastInspectionStatus: extra.lastInspectionStatus ?? null,
    hasConflict: extra.hasConflict,
  });
}

// ── Ready ─────────────────────────────────────────────────────────────────────

test("computeKitReadiness: all good components → READY", () => {
  const label = readinessFor([makeSnapshot()]);
  assert.equal(label, "READY");
});

test("computeKitReadiness: empty kit → READY (nothing required)", () => {
  const label = readinessFor([]);
  assert.equal(label, "READY");
});

// ── Inactive kit via IN_MAINTENANCE custody ───────────────────────────────────

test("computeKitReadiness: IN_MAINTENANCE custody → OUT_OF_SERVICE", () => {
  const label = readinessFor([makeSnapshot()], {
    custodyStatus: "IN_MAINTENANCE",
  });
  assert.equal(label, "OUT_OF_SERVICE");
});

// ── Out-of-service custody ────────────────────────────────────────────────────

test("computeKitReadiness: IN_MAINTENANCE custody → OUT_OF_SERVICE (duplicate check)", () => {
  const label = readinessFor([makeSnapshot()], {
    custodyStatus: "IN_MAINTENANCE",
  });
  assert.equal(label, "OUT_OF_SERVICE");
});

// ── Missing required components ───────────────────────────────────────────────

test("computeKitReadiness: LOST required item → OUT_OF_SERVICE (higher priority than MISSING_COMPONENTS)", () => {
  const snapshots: GearKitComponentSnapshot[] = [
    makeSnapshot({ kitItemId: "k1", gearItemId: "g1", isRequired: true }),
    makeSnapshot({
      kitItemId: "k2",
      gearItemId: "g2",
      isRequired: true,
      lifecycleStatus: "LOST",
    }),
  ];
  const label = readinessFor(snapshots);
  // LOST is outOfService=true for the required component → OUT_OF_SERVICE wins
  assert.equal(label, "OUT_OF_SERVICE");
});

// ── Out-of-service required child items ───────────────────────────────────────

test("computeKitReadiness: required RETIRED item → OUT_OF_SERVICE (oos component detected)", () => {
  const snapshots: GearKitComponentSnapshot[] = [
    makeSnapshot({ kitItemId: "k1", gearItemId: "g1", isRequired: true, lifecycleStatus: "RETIRED" }),
  ];
  const label = readinessFor(snapshots);
  // RETIRED is outOfService=true → OUT_OF_SERVICE (higher priority than MISSING_COMPONENTS)
  assert.equal(label, "OUT_OF_SERVICE");
});

// ── Maintenance needed ────────────────────────────────────────────────────────

test("computeKitReadiness: required item MAINTENANCE_REQUIRED readiness → MAINTENANCE_NEEDED", () => {
  const snapshots: GearKitComponentSnapshot[] = [
    makeSnapshot({ readinessState: "MAINTENANCE_REQUIRED" }),
  ];
  const label = readinessFor(snapshots);
  assert.equal(label, "MAINTENANCE_NEEDED");
});

// ── Inspection status ─────────────────────────────────────────────────────────

test("computeKitReadiness: FAILED inspection → NEEDS_INSPECTION", () => {
  const label = readinessFor([makeSnapshot()], {
    lastInspectionStatus: "FAILED",
  });
  assert.equal(label, "NEEDS_INSPECTION");
});

test("computeKitReadiness: IN_INSPECTION custody → NEEDS_INSPECTION", () => {
  const label = readinessFor([makeSnapshot()], {
    custodyStatus: "IN_INSPECTION",
  });
  assert.equal(label, "NEEDS_INSPECTION");
});

test("computeKitReadiness: PASSED inspection → READY", () => {
  const label = readinessFor([makeSnapshot()], {
    lastInspectionStatus: "PASSED",
  });
  assert.equal(label, "READY");
});

// ── Conflict via hasConflict flag ─────────────────────────────────────────────

test("computeKitReadiness: hasConflict=true → CONFLICT", () => {
  const label = readinessFor([makeSnapshot()], { hasConflict: true });
  assert.equal(label, "CONFLICT");
});

test("computeKitReadiness: hasConflict=false → READY", () => {
  const label = readinessFor([makeSnapshot()], { hasConflict: false });
  assert.equal(label, "READY");
});

// ── Ready with warning (damaged but not out-of-service) ───────────────────────

test("computeKitReadiness: optional damaged item → READY_WITH_WARNING or better", () => {
  const snapshots: GearKitComponentSnapshot[] = [
    makeSnapshot({ kitItemId: "k1", gearItemId: "g1", isRequired: true }),
    makeSnapshot({
      kitItemId: "k2",
      gearItemId: "g2",
      isRequired: false,
      conditionStatus: "DAMAGED",
    }),
  ];
  const label = readinessFor(snapshots);
  assert.ok(
    label === "READY" ||
      label === "READY_WITH_WARNING" ||
      label === "LIMITED_USE",
    `Expected READY or warning-level label, got ${label}`,
  );
});

// ── isKitOperationallyReady ───────────────────────────────────────────────────

test("isKitOperationallyReady: READY → true", () => {
  assert.equal(isKitOperationallyReady("READY"), true);
});

test("isKitOperationallyReady: READY_WITH_WARNING → true", () => {
  assert.equal(isKitOperationallyReady("READY_WITH_WARNING"), true);
});

test("isKitOperationallyReady: MISSING_COMPONENTS → false", () => {
  assert.equal(isKitOperationallyReady("MISSING_COMPONENTS"), false);
});

test("isKitOperationallyReady: OUT_OF_SERVICE → false", () => {
  assert.equal(isKitOperationallyReady("OUT_OF_SERVICE"), false);
});

// ── isKitBlockedFromUse ───────────────────────────────────────────────────────

test("isKitBlockedFromUse: OUT_OF_SERVICE → true", () => {
  assert.equal(isKitBlockedFromUse("OUT_OF_SERVICE"), true);
});

test("isKitBlockedFromUse: MISSING_COMPONENTS → true", () => {
  assert.equal(isKitBlockedFromUse("MISSING_COMPONENTS"), true);
});

test("isKitBlockedFromUse: READY → false", () => {
  assert.equal(isKitBlockedFromUse("READY"), false);
});

test("isKitBlockedFromUse: NEEDS_INSPECTION → false", () => {
  assert.equal(isKitBlockedFromUse("NEEDS_INSPECTION"), false);
});
