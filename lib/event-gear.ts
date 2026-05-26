import type {
  EventGearPlanStatus,
  EventGearRequirementType,
  GearCheckoutStatus,
  GearConditionStatus,
  GearItemLifecycleStatus,
  InventoryReadinessState,
} from "@/lib/prisma-client";

export type EventGearAvailabilityState =
  | "READY"
  | "UNAVAILABLE"
  | "OUT_OF_SERVICE"
  | "LIMITED_USE"
  | "MAINTENANCE_NEEDED";

export type EventGearAssignmentOperationalStatus =
  | "ASSIGNED"
  | "STAGED"
  | "DEPLOYED"
  | "RETURNED"
  | "RECOVERED";

export type EventGearItemSnapshot = {
  lifecycleStatus: GearItemLifecycleStatus;
  readinessState: InventoryReadinessState | null;
  conditionStatus: GearConditionStatus | null;
  quantityOnHand: number;
  quantityMin: number | null;
};

export type EventGearCheckoutSnapshot = {
  status: GearCheckoutStatus;
  returnedAt: Date | null;
};

export type EventGearAssignmentSnapshot = {
  stagedAt: Date | null;
  recoveredAt: Date | null;
  gearItem: EventGearItemSnapshot;
  activeEventCheckout?: EventGearCheckoutSnapshot | null;
  blockingCheckout?: EventGearCheckoutSnapshot | null;
  blockingAssignment?: boolean;
};

export type EventGearRequirementSnapshot = {
  requirementType: EventGearRequirementType;
  quantityNeeded: number;
  assignments: EventGearAssignmentSnapshot[];
};

export type EventGearRequirementSummary = {
  quantityNeeded: number;
  assignedCount: number;
  gapCount: number;
  readyCount: number;
  unavailableCount: number;
  outOfServiceCount: number;
  limitedUseCount: number;
  maintenanceNeededCount: number;
};

export type EventGearPlanSummary = {
  requirementCount: number;
  requiredRequirementCount: number;
  optionalRequirementCount: number;
  supportRequirementCount: number;
  assignmentCount: number;
  stagedCount: number;
  deployedCount: number;
  returnedCount: number;
  recoveredCount: number;
  gapCount: number;
  readyCount: number;
  unavailableCount: number;
  outOfServiceCount: number;
  limitedUseCount: number;
  maintenanceNeededCount: number;
  concernCount: number;
};

export function formatEventGearEnum(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getEventGearPlanStatusBadgeClass(status: EventGearPlanStatus) {
  if (status === "COMPLETED") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  if (status === "DEPLOYED" || status === "RECOVERING") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
  }

  if (status === "STAGED" || status === "READY_TO_STAGE") {
    return "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200";
  }

  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
}

export function getEventGearAvailabilityBadgeClass(status: EventGearAvailabilityState) {
  if (status === "READY") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  if (status === "LIMITED_USE") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
  }

  if (status === "UNAVAILABLE") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }

  return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
}

export function deriveEventGearAvailability(input: EventGearAssignmentSnapshot): EventGearAvailabilityState {
  if ((input.blockingCheckout && input.blockingCheckout.returnedAt === null) || input.blockingAssignment) {
    return "UNAVAILABLE";
  }

  if (
    input.gearItem.lifecycleStatus === "MAINTENANCE" ||
    input.gearItem.lifecycleStatus === "QUARANTINED" ||
    input.gearItem.lifecycleStatus === "RETIRED" ||
    input.gearItem.lifecycleStatus === "LOST" ||
    input.gearItem.readinessState === "DECOMMISSIONED" ||
    input.gearItem.readinessState === "NOT_READY"
  ) {
    return "OUT_OF_SERVICE";
  }

  if (
    input.gearItem.readinessState === "MAINTENANCE_REQUIRED" ||
    input.gearItem.conditionStatus === "POOR" ||
    input.gearItem.conditionStatus === "DAMAGED"
  ) {
    return "MAINTENANCE_NEEDED";
  }

  if (
    input.gearItem.lifecycleStatus === "ASSIGNED" ||
    input.gearItem.lifecycleStatus === "CHECKED_OUT" ||
    input.gearItem.lifecycleStatus === "RESERVED"
  ) {
    return "UNAVAILABLE";
  }

  if (
    input.gearItem.readinessState === "NEEDS_INSPECTION" ||
    input.gearItem.conditionStatus === "FAIR" ||
    (input.gearItem.quantityMin !== null && input.gearItem.quantityOnHand <= input.gearItem.quantityMin)
  ) {
    return "LIMITED_USE";
  }

  return "READY";
}

export function deriveEventGearAssignmentStatus(input: EventGearAssignmentSnapshot): EventGearAssignmentOperationalStatus {
  if (input.recoveredAt) {
    return "RECOVERED";
  }

  if (input.activeEventCheckout?.returnedAt) {
    return "RETURNED";
  }

  if (
    input.activeEventCheckout &&
    (input.activeEventCheckout.status === "OPEN" || input.activeEventCheckout.status === "OVERDUE")
  ) {
    return "DEPLOYED";
  }

  if (input.stagedAt) {
    return "STAGED";
  }

  return "ASSIGNED";
}

export function summarizeEventGearRequirement(
  input: EventGearRequirementSnapshot,
): EventGearRequirementSummary {
  const summary: EventGearRequirementSummary = {
    quantityNeeded: input.quantityNeeded,
    assignedCount: input.assignments.length,
    gapCount: Math.max(input.quantityNeeded - input.assignments.length, 0),
    readyCount: 0,
    unavailableCount: 0,
    outOfServiceCount: 0,
    limitedUseCount: 0,
    maintenanceNeededCount: 0,
  };

  for (const assignment of input.assignments) {
    const availability = deriveEventGearAvailability(assignment);

    if (availability === "READY") {
      summary.readyCount += 1;
    } else if (availability === "UNAVAILABLE") {
      summary.unavailableCount += 1;
    } else if (availability === "OUT_OF_SERVICE") {
      summary.outOfServiceCount += 1;
    } else if (availability === "LIMITED_USE") {
      summary.limitedUseCount += 1;
    } else if (availability === "MAINTENANCE_NEEDED") {
      summary.maintenanceNeededCount += 1;
    }
  }

  return summary;
}

export function summarizeEventGearPlan(input: {
  requirements: EventGearRequirementSnapshot[];
}): EventGearPlanSummary {
  const summary: EventGearPlanSummary = {
    requirementCount: input.requirements.length,
    requiredRequirementCount: 0,
    optionalRequirementCount: 0,
    supportRequirementCount: 0,
    assignmentCount: 0,
    stagedCount: 0,
    deployedCount: 0,
    returnedCount: 0,
    recoveredCount: 0,
    gapCount: 0,
    readyCount: 0,
    unavailableCount: 0,
    outOfServiceCount: 0,
    limitedUseCount: 0,
    maintenanceNeededCount: 0,
    concernCount: 0,
  };

  for (const requirement of input.requirements) {
    if (requirement.requirementType === "REQUIRED") {
      summary.requiredRequirementCount += 1;
    } else if (requirement.requirementType === "OPTIONAL") {
      summary.optionalRequirementCount += 1;
    } else {
      summary.supportRequirementCount += 1;
    }

    const requirementSummary = summarizeEventGearRequirement(requirement);
    summary.assignmentCount += requirement.assignments.length;
    summary.gapCount += requirementSummary.gapCount;
    summary.readyCount += requirementSummary.readyCount;
    summary.unavailableCount += requirementSummary.unavailableCount;
    summary.outOfServiceCount += requirementSummary.outOfServiceCount;
    summary.limitedUseCount += requirementSummary.limitedUseCount;
    summary.maintenanceNeededCount += requirementSummary.maintenanceNeededCount;

    for (const assignment of requirement.assignments) {
      const status = deriveEventGearAssignmentStatus(assignment);
      if (status === "STAGED") {
        summary.stagedCount += 1;
      } else if (status === "DEPLOYED") {
        summary.deployedCount += 1;
      } else if (status === "RETURNED") {
        summary.returnedCount += 1;
      } else if (status === "RECOVERED") {
        summary.recoveredCount += 1;
      }
    }
  }

  summary.concernCount =
    summary.gapCount +
    summary.unavailableCount +
    summary.outOfServiceCount +
    summary.maintenanceNeededCount;

  return summary;
}
