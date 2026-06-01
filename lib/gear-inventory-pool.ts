/**
 * Arc 25D — GearOps Inventory Pools
 *
 * Pure functions for inventory pool eligibility and membership resolution.
 * Pools are named collections of GearItems that the allocation engine can
 * draw from when fulfilling DynamicKitRequirements.
 *
 * An item may belong to multiple pools. Pool membership does not itself
 * block allocation; availability is still checked at allocation time.
 */

import type {
  GearInventoryType,
  GearItemLifecycleStatus,
  InventoryReadinessState,
} from "@prisma/client";

// ── Pool snapshot types ───────────────────────────────────────────────────────

export type InventoryPoolSnapshot = {
  poolId: string;
  poolName: string;
  description: string | null;
  active: boolean;
  memberCount: number;
};

export type PoolMemberSnapshot = {
  membershipId: string;
  gearItemId: string;
  gearItemName: string;
  inventoryType: GearInventoryType;
  gearCategoryId: string;
  gearCategoryName: string;
  lifecycleStatus: GearItemLifecycleStatus;
  readinessState: InventoryReadinessState | null;
  poolId: string;
};

// ── Pool summary ──────────────────────────────────────────────────────────────

export type PoolAvailabilitySummary = {
  poolId: string;
  poolName: string;
  totalMembers: number;
  availableMembers: number;
  unavailableMembers: number;
};

// ── Blocked lifecycle statuses for pool availability display ─────────────────

const UNAVAILABLE_LIFECYCLE_STATUSES: Set<GearItemLifecycleStatus> = new Set([
  "MAINTENANCE",
  "QUARANTINED",
  "RETIRED",
  "LOST",
  "CHECKED_OUT",
  "RESERVED",
]);

const UNAVAILABLE_READINESS_STATES: Set<InventoryReadinessState> = new Set([
  "NOT_READY",
  "DECOMMISSIONED",
]);

// ── Pool membership helpers ───────────────────────────────────────────────────

/**
 * Returns true when a pool member snapshot represents an item that is
 * immediately available (not blocked by lifecycle or readiness state).
 *
 * This is a display-only check; the allocation engine performs a more
 * complete check including active reservation/checkout status.
 */
export function isPoolMemberDisplayAvailable(member: PoolMemberSnapshot): boolean {
  if (UNAVAILABLE_LIFECYCLE_STATUSES.has(member.lifecycleStatus)) {
    return false;
  }
  if (
    member.readinessState !== null &&
    UNAVAILABLE_READINESS_STATES.has(member.readinessState)
  ) {
    return false;
  }
  return true;
}

/**
 * Summarises availability within a pool from a list of member snapshots.
 */
export function summarizePoolAvailability(
  pool: Pick<InventoryPoolSnapshot, "poolId" | "poolName">,
  members: PoolMemberSnapshot[],
): PoolAvailabilitySummary {
  const totalMembers = members.length;
  const availableMembers = members.filter(isPoolMemberDisplayAvailable).length;
  return {
    poolId: pool.poolId,
    poolName: pool.poolName,
    totalMembers,
    availableMembers,
    unavailableMembers: totalMembers - availableMembers,
  };
}

/**
 * Filters pool members to those matching a given inventory type and optional
 * category. Used to identify which pool members are candidates for a specific
 * DynamicKitRequirement.
 */
export function filterPoolMembersForRequirement(
  members: PoolMemberSnapshot[],
  inventoryType: GearInventoryType,
  gearCategoryId: string | null,
): PoolMemberSnapshot[] {
  return members.filter((m) => {
    if (m.inventoryType !== inventoryType) return false;
    if (gearCategoryId !== null && m.gearCategoryId !== gearCategoryId) return false;
    return true;
  });
}

/**
 * Groups pool members by pool name for display in item detail pages.
 * Returns a map of poolName → member snapshots.
 */
export function groupMembersByPool(
  members: PoolMemberSnapshot[],
): Map<string, PoolMemberSnapshot[]> {
  const groups = new Map<string, PoolMemberSnapshot[]>();
  for (const member of members) {
    const key = member.poolId;
    const existing = groups.get(key);
    if (existing) {
      existing.push(member);
    } else {
      groups.set(key, [member]);
    }
  }
  return groups;
}
