/**
 * Arc 25D — Inventory pool helpers tests.
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import {
  filterPoolMembersForRequirement,
  groupMembersByPool,
  isPoolMemberDisplayAvailable,
  summarizePoolAvailability,
  type PoolMemberSnapshot,
} from "../../lib/gear-inventory-pool";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMember(
  overrides: Partial<PoolMemberSnapshot> = {},
): PoolMemberSnapshot {
  return {
    membershipId: "mem-1",
    gearItemId: "item-1",
    gearItemName: "Radio A",
    inventoryType: "DURABLE",
    gearCategoryId: "cat-radio",
    gearCategoryName: "Radio",
    lifecycleStatus: "ACTIVE",
    readinessState: "READY",
    poolId: "pool-radio",
    ...overrides,
  };
}

// ── isPoolMemberDisplayAvailable ─────────────────────────────────────────────

test("active item with READY readiness is display-available", () => {
  assert.equal(isPoolMemberDisplayAvailable(makeMember()), true);
});

test("MAINTENANCE lifecycle marks member unavailable", () => {
  assert.equal(
    isPoolMemberDisplayAvailable(makeMember({ lifecycleStatus: "MAINTENANCE" })),
    false,
  );
});

test("RETIRED lifecycle marks member unavailable", () => {
  assert.equal(
    isPoolMemberDisplayAvailable(makeMember({ lifecycleStatus: "RETIRED" })),
    false,
  );
});

test("LOST lifecycle marks member unavailable", () => {
  assert.equal(
    isPoolMemberDisplayAvailable(makeMember({ lifecycleStatus: "LOST" })),
    false,
  );
});

test("CHECKED_OUT lifecycle marks member unavailable", () => {
  assert.equal(
    isPoolMemberDisplayAvailable(makeMember({ lifecycleStatus: "CHECKED_OUT" })),
    false,
  );
});

test("RESERVED lifecycle marks member unavailable", () => {
  assert.equal(
    isPoolMemberDisplayAvailable(makeMember({ lifecycleStatus: "RESERVED" })),
    false,
  );
});

test("NOT_READY readiness marks member unavailable", () => {
  assert.equal(
    isPoolMemberDisplayAvailable(makeMember({ readinessState: "NOT_READY" })),
    false,
  );
});

test("DECOMMISSIONED readiness marks member unavailable", () => {
  assert.equal(
    isPoolMemberDisplayAvailable(
      makeMember({ readinessState: "DECOMMISSIONED" }),
    ),
    false,
  );
});

test("null readiness state does not block availability", () => {
  assert.equal(
    isPoolMemberDisplayAvailable(makeMember({ readinessState: null })),
    true,
  );
});

// ── summarizePoolAvailability ─────────────────────────────────────────────────

test("summarizePoolAvailability counts available vs unavailable members", () => {
  const members: PoolMemberSnapshot[] = [
    makeMember({ membershipId: "m1", gearItemId: "i1" }),
    makeMember({ membershipId: "m2", gearItemId: "i2", lifecycleStatus: "MAINTENANCE" }),
    makeMember({ membershipId: "m3", gearItemId: "i3" }),
  ];

  const summary = summarizePoolAvailability(
    { poolId: "pool-radio", poolName: "Radio Pool" },
    members,
  );

  assert.equal(summary.totalMembers, 3);
  assert.equal(summary.availableMembers, 2);
  assert.equal(summary.unavailableMembers, 1);
});

test("empty pool has zero counts", () => {
  const summary = summarizePoolAvailability(
    { poolId: "pool-empty", poolName: "Empty Pool" },
    [],
  );

  assert.equal(summary.totalMembers, 0);
  assert.equal(summary.availableMembers, 0);
  assert.equal(summary.unavailableMembers, 0);
});

// ── filterPoolMembersForRequirement ──────────────────────────────────────────

test("filterPoolMembersForRequirement filters by inventoryType and category", () => {
  const members: PoolMemberSnapshot[] = [
    makeMember({ gearItemId: "radio-1", inventoryType: "DURABLE", gearCategoryId: "cat-radio" }),
    makeMember({ gearItemId: "case-1", inventoryType: "DURABLE", gearCategoryId: "cat-case" }),
    makeMember({ gearItemId: "ammo-1", inventoryType: "CONSUMABLE", gearCategoryId: "cat-ammo" }),
  ];

  const result = filterPoolMembersForRequirement(members, "DURABLE", "cat-radio");
  assert.equal(result.length, 1);
  assert.equal(result[0].gearItemId, "radio-1");
});

test("filterPoolMembersForRequirement with null category returns all matching type", () => {
  const members: PoolMemberSnapshot[] = [
    makeMember({ gearItemId: "item-1", inventoryType: "DURABLE" }),
    makeMember({ gearItemId: "item-2", inventoryType: "DURABLE", gearCategoryId: "cat-other" }),
    makeMember({ gearItemId: "item-3", inventoryType: "CONSUMABLE" }),
  ];

  const result = filterPoolMembersForRequirement(members, "DURABLE", null);
  assert.equal(result.length, 2);
});

// ── groupMembersByPool ────────────────────────────────────────────────────────

test("groupMembersByPool groups members by poolId", () => {
  const members: PoolMemberSnapshot[] = [
    makeMember({ gearItemId: "item-1", poolId: "pool-a" }),
    makeMember({ gearItemId: "item-2", poolId: "pool-b" }),
    makeMember({ gearItemId: "item-3", poolId: "pool-a" }),
  ];

  const groups = groupMembersByPool(members);
  assert.equal(groups.size, 2);
  assert.equal(groups.get("pool-a")!.length, 2);
  assert.equal(groups.get("pool-b")!.length, 1);
});

test("groupMembersByPool returns empty map for empty input", () => {
  const groups = groupMembersByPool([]);
  assert.equal(groups.size, 0);
});
