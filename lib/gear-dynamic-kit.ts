/**
 * Arc 25D — GearOps Dynamic Kit Allocation and Inventory Pools
 *
 * Pure functions for dynamic kit allocation, availability resolution,
 * and return validation. All functions are DB-free and fully testable.
 *
 * Allocation status semantics:
 *   FULLY_ALLOCATED     — all requirements satisfied
 *   PARTIALLY_ALLOCATED — some requirements satisfied, at least one fulfilled
 *   UNABLE_TO_ALLOCATE  — zero requirements could be satisfied
 */

import type {
  DynamicKitAllocationStatus,
  DynamicKitReturnIssue,
  GearConditionStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
  InventoryReadinessState,
} from "@prisma/client";

// ── Requirement snapshot ─────────────────────────────────────────────────────

/**
 * A lightweight snapshot of one requirement line in a DynamicKitDefinition.
 */
export type DynamicKitRequirementSnapshot = {
  requirementId: string;
  inventoryType: GearInventoryType;
  gearCategoryId: string | null;
  categoryLabel: string | null;
  quantityRequired: number;
};

// ── Allocatable inventory snapshot ──────────────────────────────────────────

/**
 * Minimal projection of a GearItem used by the allocation engine.
 * Lifecycle statuses that block allocation are checked here.
 */
export type AllocatableItemSnapshot = {
  gearItemId: string;
  gearItemName: string;
  inventoryType: GearInventoryType;
  gearCategoryId: string;
  lifecycleStatus: GearItemLifecycleStatus;
  conditionStatus: GearConditionStatus | null;
  readinessState: InventoryReadinessState | null;
  /** True when this item is currently reserved by an active allocation. */
  isAllocated: boolean;
  /** True when this item is checked out or has an open checkout. */
  isCheckedOut: boolean;
  /** True when this item is in a maintenance or out-of-service state. */
  isInMaintenance: boolean;
};

// ── Allocation result types ───────────────────────────────────────────────────

export type DynamicKitRequirementResult = {
  requirement: DynamicKitRequirementSnapshot;
  allocatedItems: AllocatableItemSnapshot[];
  allocatedCount: number;
  missingCount: number;
  fulfilled: boolean;
};

export type DynamicKitAllocationResult = {
  status: DynamicKitAllocationStatus;
  requirementResults: DynamicKitRequirementResult[];
  totalRequired: number;
  totalAllocated: number;
  totalMissing: number;
  fulfilledRequirementCount: number;
  unfulfilledRequirementCount: number;
};

// ── Return validation types ───────────────────────────────────────────────────

export type DynamicKitReturnItemInput = {
  allocationItemId: string;
  expectedGearItemId: string;
  returnedGearItemId: string | null;
  conditionStatus: GearConditionStatus | null;
  missing: boolean;
};

export type DynamicKitReturnItemResult = {
  allocationItemId: string;
  expectedGearItemId: string;
  returnedGearItemId: string | null;
  issue: DynamicKitReturnIssue | null;
  valid: boolean;
};

export type DynamicKitReturnValidationResult = {
  allValid: boolean;
  itemResults: DynamicKitReturnItemResult[];
  missingCount: number;
  wrongItemCount: number;
  damagedCount: number;
};

// ── Lifecycle statuses that block allocation ─────────────────────────────────

const BLOCKED_LIFECYCLE_STATUSES: Set<GearItemLifecycleStatus> = new Set([
  "MAINTENANCE",
  "QUARANTINED",
  "RETIRED",
  "LOST",
]);

const BLOCKED_READINESS_STATES: Set<InventoryReadinessState> = new Set([
  "NOT_READY",
  "DECOMMISSIONED",
]);

const DAMAGED_CONDITIONS: Set<GearConditionStatus> = new Set([
  "POOR",
  "DAMAGED",
]);

// ── Availability check ────────────────────────────────────────────────────────

/**
 * Returns true when a GearItem snapshot is eligible for dynamic allocation.
 *
 * Excluded items:
 * - Reserved (isAllocated)
 * - Checked Out (isCheckedOut)
 * - Maintenance (isInMaintenance or lifecycle MAINTENANCE/QUARANTINED)
 * - Out of Service (RETIRED/LOST lifecycle, NOT_READY/DECOMMISSIONED readiness)
 * - Missing (LOST lifecycle)
 */
export function isItemAvailableForAllocation(
  item: AllocatableItemSnapshot,
): boolean {
  if (item.isAllocated || item.isCheckedOut || item.isInMaintenance) {
    return false;
  }
  if (BLOCKED_LIFECYCLE_STATUSES.has(item.lifecycleStatus)) {
    return false;
  }
  if (
    item.readinessState !== null &&
    BLOCKED_READINESS_STATES.has(item.readinessState)
  ) {
    return false;
  }
  return true;
}

// ── Requirement matching ──────────────────────────────────────────────────────

/**
 * Returns true when a GearItem snapshot satisfies a requirement's
 * type and category constraints.
 */
export function itemMatchesRequirement(
  item: AllocatableItemSnapshot,
  requirement: DynamicKitRequirementSnapshot,
): boolean {
  if (item.inventoryType !== requirement.inventoryType) {
    return false;
  }
  if (
    requirement.gearCategoryId !== null &&
    item.gearCategoryId !== requirement.gearCategoryId
  ) {
    return false;
  }
  return true;
}

// ── Allocation engine ─────────────────────────────────────────────────────────

/**
 * Allocates available inventory to fulfill a dynamic kit's requirements.
 *
 * Each requirement is evaluated independently. Items already used to
 * satisfy one requirement are not reused for another (greedy, ordered).
 *
 * Priority: items are allocated in the order they appear in `availableItems`.
 * Callers should pre-sort by preferred criteria (e.g. condition, location).
 */
export function allocateDynamicKit(input: {
  requirements: DynamicKitRequirementSnapshot[];
  availableItems: AllocatableItemSnapshot[];
}): DynamicKitAllocationResult {
  const { requirements, availableItems } = input;

  // Track items used across requirements to prevent double-allocation
  const usedItemIds = new Set<string>();

  const requirementResults: DynamicKitRequirementResult[] = [];

  for (const requirement of requirements) {
    const eligible = availableItems.filter(
      (item) =>
        isItemAvailableForAllocation(item) &&
        itemMatchesRequirement(item, requirement) &&
        !usedItemIds.has(item.gearItemId),
    );

    const allocatedItems: AllocatableItemSnapshot[] = [];
    for (const item of eligible) {
      if (allocatedItems.length >= requirement.quantityRequired) {
        break;
      }
      allocatedItems.push(item);
      usedItemIds.add(item.gearItemId);
    }

    const allocatedCount = allocatedItems.length;
    const missingCount = Math.max(0, requirement.quantityRequired - allocatedCount);
    const fulfilled = missingCount === 0;

    requirementResults.push({
      requirement,
      allocatedItems,
      allocatedCount,
      missingCount,
      fulfilled,
    });
  }

  const totalRequired = requirements.reduce(
    (sum, r) => sum + r.quantityRequired,
    0,
  );
  const totalAllocated = requirementResults.reduce(
    (sum, r) => sum + r.allocatedCount,
    0,
  );
  const totalMissing = totalRequired - totalAllocated;
  const fulfilledRequirementCount = requirementResults.filter(
    (r) => r.fulfilled,
  ).length;
  const unfulfilledRequirementCount =
    requirements.length - fulfilledRequirementCount;

  let status: DynamicKitAllocationStatus;
  if (totalMissing === 0) {
    status = "FULLY_ALLOCATED";
  } else if (totalAllocated === 0) {
    status = "UNABLE_TO_ALLOCATE";
  } else {
    status = "PARTIALLY_ALLOCATED";
  }

  return {
    status,
    requirementResults,
    totalRequired,
    totalAllocated,
    totalMissing,
    fulfilledRequirementCount,
    unfulfilledRequirementCount,
  };
}

// ── Return validation ─────────────────────────────────────────────────────────

/**
 * Validates items returned against a completed dynamic kit allocation.
 *
 * Issues detected:
 *   MISSING_ITEM       — item was not returned (missing = true or returnedGearItemId null)
 *   WRONG_ITEM_RETURNED — a different item was returned instead of the expected one
 *   DAMAGED_ITEM       — item returned but condition is POOR or DAMAGED
 */
export function validateDynamicKitReturn(
  items: DynamicKitReturnItemInput[],
): DynamicKitReturnValidationResult {
  const itemResults: DynamicKitReturnItemResult[] = items.map((item) => {
    if (item.missing || item.returnedGearItemId === null) {
      return {
        allocationItemId: item.allocationItemId,
        expectedGearItemId: item.expectedGearItemId,
        returnedGearItemId: null,
        issue: "MISSING_ITEM" as DynamicKitReturnIssue,
        valid: false,
      };
    }

    if (item.returnedGearItemId !== item.expectedGearItemId) {
      return {
        allocationItemId: item.allocationItemId,
        expectedGearItemId: item.expectedGearItemId,
        returnedGearItemId: item.returnedGearItemId,
        issue: "WRONG_ITEM_RETURNED" as DynamicKitReturnIssue,
        valid: false,
      };
    }

    if (
      item.conditionStatus !== null &&
      DAMAGED_CONDITIONS.has(item.conditionStatus)
    ) {
      return {
        allocationItemId: item.allocationItemId,
        expectedGearItemId: item.expectedGearItemId,
        returnedGearItemId: item.returnedGearItemId,
        issue: "DAMAGED_ITEM" as DynamicKitReturnIssue,
        valid: false,
      };
    }

    return {
      allocationItemId: item.allocationItemId,
      expectedGearItemId: item.expectedGearItemId,
      returnedGearItemId: item.returnedGearItemId,
      issue: null,
      valid: true,
    };
  });

  const missingCount = itemResults.filter(
    (r) => r.issue === "MISSING_ITEM",
  ).length;
  const wrongItemCount = itemResults.filter(
    (r) => r.issue === "WRONG_ITEM_RETURNED",
  ).length;
  const damagedCount = itemResults.filter(
    (r) => r.issue === "DAMAGED_ITEM",
  ).length;

  return {
    allValid: itemResults.every((r) => r.valid),
    itemResults,
    missingCount,
    wrongItemCount,
    damagedCount,
  };
}

// ── Label helpers ─────────────────────────────────────────────────────────────

/** Returns a human-readable label for a DynamicKitAllocationStatus. */
export function labelForAllocationStatus(
  status: DynamicKitAllocationStatus,
): string {
  const labels: Record<DynamicKitAllocationStatus, string> = {
    FULLY_ALLOCATED: "Fully Allocated",
    PARTIALLY_ALLOCATED: "Partially Allocated",
    UNABLE_TO_ALLOCATE: "Unable to Allocate",
  };
  return labels[status];
}

/** Returns Tailwind badge classes for a DynamicKitAllocationStatus. */
export function getAllocationStatusBadgeClass(
  status: DynamicKitAllocationStatus,
): string {
  if (status === "FULLY_ALLOCATED") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (status === "PARTIALLY_ALLOCATED") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }
  return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
}

/** Returns a human-readable label for a DynamicKitReturnIssue. */
export function labelForReturnIssue(issue: DynamicKitReturnIssue): string {
  const labels: Record<DynamicKitReturnIssue, string> = {
    MISSING_ITEM: "Missing Item",
    WRONG_ITEM_RETURNED: "Wrong Item Returned",
    DAMAGED_ITEM: "Damaged Item",
  };
  return labels[issue];
}
