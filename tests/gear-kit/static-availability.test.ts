import { strict as assert } from "node:assert";
import test from "node:test";

import {
  computeKitCompleteness,
  deriveStaticKitAvailabilityStatus,
  type GearKitComponentSnapshot,
} from "../../lib/gear-kit";

function makeSnapshot(
  overrides: Partial<GearKitComponentSnapshot> = {},
): GearKitComponentSnapshot {
  return {
    kitItemId: "kit-item-1",
    gearItemId: "gear-1",
    gearItemName: "Gear 1",
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

test("deriveStaticKitAvailabilityStatus: available when members are complete and clear", () => {
  const completeness = computeKitCompleteness([makeSnapshot()]);
  const result = deriveStaticKitAvailabilityStatus({
    completeness,
    hasReservedMember: false,
    hasCheckedOutMember: false,
    hasOutOfServiceMember: false,
  });
  assert.equal(result, "AVAILABLE");
});

test("deriveStaticKitAvailabilityStatus: incomplete when only optional components are missing", () => {
  const completeness = computeKitCompleteness([
    makeSnapshot(),
    makeSnapshot({
      kitItemId: "kit-item-2",
      gearItemId: "gear-2",
      isRequired: false,
      componentRole: "OPTIONAL",
      lifecycleStatus: "LOST",
    }),
  ]);

  const result = deriveStaticKitAvailabilityStatus({
    completeness,
    hasReservedMember: false,
    hasCheckedOutMember: false,
    hasOutOfServiceMember: false,
  });
  assert.equal(result, "INCOMPLETE");
});

test("deriveStaticKitAvailabilityStatus: unavailable when any member is reserved", () => {
  const completeness = computeKitCompleteness([makeSnapshot()]);
  const result = deriveStaticKitAvailabilityStatus({
    completeness,
    hasReservedMember: true,
    hasCheckedOutMember: false,
    hasOutOfServiceMember: false,
  });
  assert.equal(result, "UNAVAILABLE");
});
