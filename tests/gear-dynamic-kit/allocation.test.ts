/**
 * Arc 25D — DynamicKit allocation engine tests.
 *
 * GEAR-DYN-001 through GEAR-DYN-015 (allocation scenarios).
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import {
  allocateDynamicKit,
  isItemAvailableForAllocation,
  itemMatchesRequirement,
  labelForAllocationStatus,
  getAllocationStatusBadgeClass,
  type AllocatableItemSnapshot,
  type DynamicKitRequirementSnapshot,
} from "../../lib/gear-dynamic-kit";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeItem(
  overrides: Partial<AllocatableItemSnapshot> = {},
): AllocatableItemSnapshot {
  return {
    gearItemId: "item-1",
    gearItemName: "Test Item",
    inventoryType: "DURABLE",
    gearCategoryId: "cat-rifle",
    lifecycleStatus: "ACTIVE",
    conditionStatus: "GOOD",
    readinessState: "READY",
    isAllocated: false,
    isCheckedOut: false,
    isInMaintenance: false,
    ...overrides,
  };
}

function makeRequirement(
  overrides: Partial<DynamicKitRequirementSnapshot> = {},
): DynamicKitRequirementSnapshot {
  return {
    requirementId: "req-1",
    inventoryType: "DURABLE",
    gearCategoryId: "cat-rifle",
    categoryLabel: "Rifle",
    quantityRequired: 1,
    ...overrides,
  };
}

// ── GEAR-DYN-001: isItemAvailableForAllocation ────────────────────────────────

test("GEAR-DYN-001: available item passes allocation check", () => {
  assert.equal(isItemAvailableForAllocation(makeItem()), true);
});

test("GEAR-DYN-002: allocated item is excluded", () => {
  assert.equal(
    isItemAvailableForAllocation(makeItem({ isAllocated: true })),
    false,
  );
});

test("GEAR-DYN-003: checked-out item is excluded", () => {
  assert.equal(
    isItemAvailableForAllocation(makeItem({ isCheckedOut: true })),
    false,
  );
});

test("GEAR-DYN-004: maintenance item is excluded", () => {
  assert.equal(
    isItemAvailableForAllocation(makeItem({ isInMaintenance: true })),
    false,
  );
});

test("GEAR-DYN-004b: item with MAINTENANCE lifecycle is excluded", () => {
  assert.equal(
    isItemAvailableForAllocation(makeItem({ lifecycleStatus: "MAINTENANCE" })),
    false,
  );
});

test("GEAR-DYN-005: lost item is excluded", () => {
  assert.equal(
    isItemAvailableForAllocation(makeItem({ lifecycleStatus: "LOST" })),
    false,
  );
});

test("GEAR-DYN-006: retired item is excluded", () => {
  assert.equal(
    isItemAvailableForAllocation(makeItem({ lifecycleStatus: "RETIRED" })),
    false,
  );
});

test("GEAR-DYN-007: NOT_READY readiness excludes item", () => {
  assert.equal(
    isItemAvailableForAllocation(makeItem({ readinessState: "NOT_READY" })),
    false,
  );
});

test("GEAR-DYN-008: DECOMMISSIONED readiness excludes item", () => {
  assert.equal(
    isItemAvailableForAllocation(makeItem({ readinessState: "DECOMMISSIONED" })),
    false,
  );
});

// ── GEAR-DYN-009: itemMatchesRequirement ──────────────────────────────────────

test("GEAR-DYN-009: item matches requirement with same type and category", () => {
  assert.equal(
    itemMatchesRequirement(makeItem(), makeRequirement()),
    true,
  );
});

test("GEAR-DYN-010: item does not match requirement with different category", () => {
  assert.equal(
    itemMatchesRequirement(
      makeItem({ gearCategoryId: "cat-pistol" }),
      makeRequirement({ gearCategoryId: "cat-rifle" }),
    ),
    false,
  );
});

test("GEAR-DYN-010b: requirement with null category matches any category of same type", () => {
  assert.equal(
    itemMatchesRequirement(
      makeItem({ gearCategoryId: "cat-anything" }),
      makeRequirement({ gearCategoryId: null }),
    ),
    true,
  );
});

test("GEAR-DYN-011: item does not match requirement with different inventory type", () => {
  assert.equal(
    itemMatchesRequirement(
      makeItem({ inventoryType: "CONSUMABLE" }),
      makeRequirement({ inventoryType: "DURABLE" }),
    ),
    false,
  );
});

// ── GEAR-DYN-012: allocateDynamicKit — full allocation ────────────────────────

test("GEAR-DYN-012: fully allocates when enough matching items are available", () => {
  const result = allocateDynamicKit({
    requirements: [makeRequirement({ quantityRequired: 2 })],
    availableItems: [
      makeItem({ gearItemId: "item-1" }),
      makeItem({ gearItemId: "item-2" }),
    ],
  });

  assert.equal(result.status, "FULLY_ALLOCATED");
  assert.equal(result.totalRequired, 2);
  assert.equal(result.totalAllocated, 2);
  assert.equal(result.totalMissing, 0);
  assert.equal(result.fulfilledRequirementCount, 1);
});

test("GEAR-DYN-013: partially allocates when only some items are available", () => {
  const result = allocateDynamicKit({
    requirements: [makeRequirement({ quantityRequired: 3 })],
    availableItems: [
      makeItem({ gearItemId: "item-1" }),
    ],
  });

  assert.equal(result.status, "PARTIALLY_ALLOCATED");
  assert.equal(result.totalRequired, 3);
  assert.equal(result.totalAllocated, 1);
  assert.equal(result.totalMissing, 2);
});

test("GEAR-DYN-014: unable to allocate when no eligible items exist", () => {
  const result = allocateDynamicKit({
    requirements: [makeRequirement()],
    availableItems: [
      makeItem({ gearCategoryId: "cat-other" }),
    ],
  });

  assert.equal(result.status, "UNABLE_TO_ALLOCATE");
  assert.equal(result.totalAllocated, 0);
});

test("GEAR-DYN-015: prevents double allocation across requirements", () => {
  // Two requirements for the same category — only 1 item available
  const result = allocateDynamicKit({
    requirements: [
      makeRequirement({ requirementId: "req-1", quantityRequired: 1 }),
      makeRequirement({ requirementId: "req-2", quantityRequired: 1 }),
    ],
    availableItems: [makeItem({ gearItemId: "item-1" })],
  });

  // One requirement fulfilled, one not
  assert.equal(result.status, "PARTIALLY_ALLOCATED");
  assert.equal(result.totalAllocated, 1);
  assert.equal(result.fulfilledRequirementCount, 1);
  assert.equal(result.unfulfilledRequirementCount, 1);
});

// ── Multi-requirement kit ─────────────────────────────────────────────────────

test("GEAR-DYN-016: multi-requirement kit allocates different categories independently", () => {
  const result = allocateDynamicKit({
    requirements: [
      makeRequirement({
        requirementId: "req-rifle",
        gearCategoryId: "cat-rifle",
        quantityRequired: 1,
      }),
      makeRequirement({
        requirementId: "req-mag",
        gearCategoryId: "cat-magazine",
        quantityRequired: 2,
      }),
    ],
    availableItems: [
      makeItem({ gearItemId: "rifle-1", gearCategoryId: "cat-rifle" }),
      makeItem({ gearItemId: "mag-1", gearCategoryId: "cat-magazine" }),
      makeItem({ gearItemId: "mag-2", gearCategoryId: "cat-magazine" }),
    ],
  });

  assert.equal(result.status, "FULLY_ALLOCATED");
  assert.equal(result.totalRequired, 3);
  assert.equal(result.totalAllocated, 3);
});

test("GEAR-DYN-017: excluded items are skipped during allocation", () => {
  const result = allocateDynamicKit({
    requirements: [makeRequirement()],
    availableItems: [
      makeItem({ gearItemId: "item-reserved", isAllocated: true }),
      makeItem({ gearItemId: "item-out", lifecycleStatus: "MAINTENANCE" }),
      makeItem({ gearItemId: "item-good" }),
    ],
  });

  assert.equal(result.status, "FULLY_ALLOCATED");
  assert.equal(result.requirementResults[0].allocatedItems[0].gearItemId, "item-good");
});

test("GEAR-DYN-018: empty requirements list results in FULLY_ALLOCATED with zero counts", () => {
  const result = allocateDynamicKit({
    requirements: [],
    availableItems: [makeItem()],
  });

  assert.equal(result.status, "FULLY_ALLOCATED");
  assert.equal(result.totalRequired, 0);
  assert.equal(result.totalAllocated, 0);
  assert.equal(result.totalMissing, 0);
});

test("GEAR-DYN-019: unable to allocate when all items are blocked", () => {
  const result = allocateDynamicKit({
    requirements: [makeRequirement()],
    availableItems: [
      makeItem({ gearItemId: "a", isAllocated: true }),
      makeItem({ gearItemId: "b", isCheckedOut: true }),
      makeItem({ gearItemId: "c", lifecycleStatus: "RETIRED" }),
    ],
  });

  assert.equal(result.status, "UNABLE_TO_ALLOCATE");
});

// ── Label helpers ─────────────────────────────────────────────────────────────

test("labelForAllocationStatus returns correct labels", () => {
  assert.equal(labelForAllocationStatus("FULLY_ALLOCATED"), "Fully Allocated");
  assert.equal(labelForAllocationStatus("PARTIALLY_ALLOCATED"), "Partially Allocated");
  assert.equal(labelForAllocationStatus("UNABLE_TO_ALLOCATE"), "Unable to Allocate");
});

test("getAllocationStatusBadgeClass returns distinct classes", () => {
  const fully = getAllocationStatusBadgeClass("FULLY_ALLOCATED");
  const partial = getAllocationStatusBadgeClass("PARTIALLY_ALLOCATED");
  const unable = getAllocationStatusBadgeClass("UNABLE_TO_ALLOCATE");

  assert.ok(fully.includes("emerald"));
  assert.ok(partial.includes("amber"));
  assert.ok(unable.includes("rose"));
});
