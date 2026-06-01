/**
 * Arc 25D — Dynamic kit return validation tests.
 *
 * GEAR-DYN-020 through GEAR-DYN-025 (return validation scenarios).
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import {
  validateDynamicKitReturn,
  labelForReturnIssue,
  type DynamicKitReturnItemInput,
} from "../../lib/gear-dynamic-kit";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReturnItem(
  overrides: Partial<DynamicKitReturnItemInput> = {},
): DynamicKitReturnItemInput {
  return {
    allocationItemId: "alloc-item-1",
    expectedGearItemId: "gear-1",
    returnedGearItemId: "gear-1",
    conditionStatus: "GOOD",
    missing: false,
    ...overrides,
  };
}

// ── GEAR-DYN-020: clean return ────────────────────────────────────────────────

test("GEAR-DYN-020: all items returned correctly passes validation", () => {
  const result = validateDynamicKitReturn([
    makeReturnItem({ allocationItemId: "a1" }),
    makeReturnItem({ allocationItemId: "a2", expectedGearItemId: "gear-2", returnedGearItemId: "gear-2" }),
  ]);

  assert.equal(result.allValid, true);
  assert.equal(result.missingCount, 0);
  assert.equal(result.wrongItemCount, 0);
  assert.equal(result.damagedCount, 0);
  assert.ok(result.itemResults.every((r) => r.valid));
});

// ── GEAR-DYN-021: missing item ────────────────────────────────────────────────

test("GEAR-DYN-021: missing item flagged as MISSING_ITEM", () => {
  const result = validateDynamicKitReturn([
    makeReturnItem({ missing: true }),
  ]);

  assert.equal(result.allValid, false);
  assert.equal(result.missingCount, 1);
  assert.equal(result.itemResults[0].issue, "MISSING_ITEM");
  assert.equal(result.itemResults[0].valid, false);
});

test("GEAR-DYN-021b: null returnedGearItemId also flags as MISSING_ITEM", () => {
  const result = validateDynamicKitReturn([
    makeReturnItem({ returnedGearItemId: null }),
  ]);

  assert.equal(result.missingCount, 1);
  assert.equal(result.itemResults[0].issue, "MISSING_ITEM");
});

// ── GEAR-DYN-022: wrong item ──────────────────────────────────────────────────

test("GEAR-DYN-022: different item returned flagged as WRONG_ITEM_RETURNED", () => {
  const result = validateDynamicKitReturn([
    makeReturnItem({ returnedGearItemId: "gear-99" }),
  ]);

  assert.equal(result.allValid, false);
  assert.equal(result.wrongItemCount, 1);
  assert.equal(result.itemResults[0].issue, "WRONG_ITEM_RETURNED");
  assert.equal(result.itemResults[0].returnedGearItemId, "gear-99");
});

// ── GEAR-DYN-023: damaged item ────────────────────────────────────────────────

test("GEAR-DYN-023: POOR condition flagged as DAMAGED_ITEM", () => {
  const result = validateDynamicKitReturn([
    makeReturnItem({ conditionStatus: "POOR" }),
  ]);

  assert.equal(result.allValid, false);
  assert.equal(result.damagedCount, 1);
  assert.equal(result.itemResults[0].issue, "DAMAGED_ITEM");
});

test("GEAR-DYN-023b: DAMAGED condition also flagged as DAMAGED_ITEM", () => {
  const result = validateDynamicKitReturn([
    makeReturnItem({ conditionStatus: "DAMAGED" }),
  ]);

  assert.equal(result.damagedCount, 1);
  assert.equal(result.itemResults[0].issue, "DAMAGED_ITEM");
});

// ── GEAR-DYN-024: mixed return issues ────────────────────────────────────────

test("GEAR-DYN-024: mixed issues counted independently", () => {
  const result = validateDynamicKitReturn([
    makeReturnItem({ allocationItemId: "a1", missing: true }),
    makeReturnItem({ allocationItemId: "a2", returnedGearItemId: "wrong-item" }),
    makeReturnItem({ allocationItemId: "a3", conditionStatus: "POOR" }),
    makeReturnItem({ allocationItemId: "a4" }), // clean
  ]);

  assert.equal(result.allValid, false);
  assert.equal(result.missingCount, 1);
  assert.equal(result.wrongItemCount, 1);
  assert.equal(result.damagedCount, 1);
  assert.equal(result.itemResults.filter((r) => r.valid).length, 1);
});

// ── GEAR-DYN-025: empty return ────────────────────────────────────────────────

test("GEAR-DYN-025: empty return list is considered valid", () => {
  const result = validateDynamicKitReturn([]);

  assert.equal(result.allValid, true);
  assert.equal(result.missingCount, 0);
  assert.equal(result.wrongItemCount, 0);
  assert.equal(result.damagedCount, 0);
});

// ── Label helpers ─────────────────────────────────────────────────────────────

test("labelForReturnIssue returns human-readable labels", () => {
  assert.equal(labelForReturnIssue("MISSING_ITEM"), "Missing Item");
  assert.equal(labelForReturnIssue("WRONG_ITEM_RETURNED"), "Wrong Item Returned");
  assert.equal(labelForReturnIssue("DAMAGED_ITEM"), "Damaged Item");
});

test("missing takes priority over wrong item when both could apply", () => {
  // When missing=true, returnedGearItemId is ignored
  const result = validateDynamicKitReturn([
    makeReturnItem({ missing: true, returnedGearItemId: "gear-99" }),
  ]);

  assert.equal(result.itemResults[0].issue, "MISSING_ITEM");
});
