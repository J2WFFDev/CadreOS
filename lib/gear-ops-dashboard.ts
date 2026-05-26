import type {
  ConsumableTransactionType,
  GearAssignmentStatus,
  GearCheckoutStatus,
  GearConditionStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
  InventoryOwnershipType,
  InventoryReadinessState,
} from "@prisma/client";

export type GearOpsAssignmentSnapshot = {
  id: string;
  gearItemId: string;
  status: GearAssignmentStatus;
  expectedReturnAt: Date | null;
  returnedAt: Date | null;
  assignedToPersonId: string | null;
  assignedToPersonName: string | null;
  assignedToEventId: string | null;
  assignedToEventTitle: string | null;
};

export type GearOpsCheckoutSnapshot = {
  id: string;
  gearItemId: string;
  status: GearCheckoutStatus;
  expectedReturnAt: Date | null;
  returnedAt: Date | null;
  checkedOutById: string;
  checkedOutByName: string;
  eventId: string | null;
  eventTitle: string | null;
};

export type GearOpsConsumableTransactionSnapshot = {
  id: string;
  gearItemId: string;
  transactionType: ConsumableTransactionType;
  quantityDelta: number;
  recordedAt: Date;
};

export type GearOpsItemSnapshot = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  inventoryType: GearInventoryType;
  lifecycleStatus: GearItemLifecycleStatus;
  conditionStatus: GearConditionStatus | null;
  ownershipType: InventoryOwnershipType | null;
  readinessState: InventoryReadinessState | null;
  locationId: string | null;
  locationName: string | null;
  quantityOnHand: number;
  quantityMin: number | null;
  assignments: GearOpsAssignmentSnapshot[];
  checkouts: GearOpsCheckoutSnapshot[];
};

export type GearOpsEventRequirementSnapshot = {
  eventId: string;
  eventTitle: string;
  quantityNeeded: number;
  assignedCount: number;
  readyCount: number;
  unavailableCount: number;
  outOfServiceCount: number;
  maintenanceNeededCount: number;
  deployedCount: number;
  unreturnedCount: number;
};

export type GearOpsReportFilter = {
  categoryId?: string;
  locationId?: string;
  eventId?: string;
  status?: GearItemLifecycleStatus;
  owner?: InventoryOwnershipType;
  assigneePersonId?: string;
  readiness?: InventoryReadinessState;
};

export type GearOpsException = {
  id: string;
  kind:
    | "OUT_OF_SERVICE"
    | "MAINTENANCE_NEEDED"
    | "OVERDUE_UNRETURNED"
    | "LOW_CONSUMABLE"
    | "EVENT_GEAR_GAP"
    | "EVENT_GEAR_UNRETURNED";
  severity: "high" | "medium";
  title: string;
  detail: string;
  href: string;
};

function toKey(value: string | null | undefined) {
  return value && value.length > 0 ? value : "__none__";
}

export function isOutOfServiceItem(item: Pick<GearOpsItemSnapshot, "lifecycleStatus" | "readinessState">) {
  return (
    item.lifecycleStatus === "MAINTENANCE" ||
    item.lifecycleStatus === "QUARANTINED" ||
    item.lifecycleStatus === "RETIRED" ||
    item.lifecycleStatus === "LOST" ||
    item.readinessState === "NOT_READY" ||
    item.readinessState === "DECOMMISSIONED"
  );
}

export function isMaintenanceNeededItem(
  item: Pick<GearOpsItemSnapshot, "readinessState" | "conditionStatus" | "lifecycleStatus">,
) {
  if (isOutOfServiceItem(item)) {
    return false;
  }

  return (
    item.readinessState === "MAINTENANCE_REQUIRED" ||
    item.conditionStatus === "POOR" ||
    item.conditionStatus === "DAMAGED"
  );
}

export function isLowConsumableItem(item: Pick<GearOpsItemSnapshot, "inventoryType" | "quantityMin" | "quantityOnHand">) {
  return item.inventoryType === "CONSUMABLE" && item.quantityMin !== null && item.quantityOnHand <= item.quantityMin;
}

export function isOverdueAssignment(assignment: GearOpsAssignmentSnapshot, now = new Date()) {
  if (assignment.returnedAt) {
    return false;
  }

  return assignment.status === "OVERDUE" || (assignment.expectedReturnAt !== null && assignment.expectedReturnAt.getTime() < now.getTime());
}

export function isOverdueCheckout(checkout: GearOpsCheckoutSnapshot, now = new Date()) {
  if (checkout.returnedAt) {
    return false;
  }

  return checkout.status === "OVERDUE" || (checkout.expectedReturnAt !== null && checkout.expectedReturnAt.getTime() < now.getTime());
}

export function filterGearOpsItems(items: GearOpsItemSnapshot[], filter: GearOpsReportFilter) {
  return items.filter((item) => {
    if (filter.categoryId && item.categoryId !== filter.categoryId) {
      return false;
    }

    if (filter.locationId && item.locationId !== filter.locationId) {
      return false;
    }

    if (filter.status && item.lifecycleStatus !== filter.status) {
      return false;
    }

    if (filter.owner && item.ownershipType !== filter.owner) {
      return false;
    }

    if (filter.readiness && item.readinessState !== filter.readiness) {
      return false;
    }

    if (filter.eventId) {
      const hasEventLink =
        item.assignments.some((assignment) => assignment.assignedToEventId === filter.eventId) ||
        item.checkouts.some((checkout) => checkout.eventId === filter.eventId);
      if (!hasEventLink) {
        return false;
      }
    }

    if (filter.assigneePersonId) {
      const hasAssignee =
        item.assignments.some((assignment) => assignment.assignedToPersonId === filter.assigneePersonId) ||
        item.checkouts.some((checkout) => checkout.checkedOutById === filter.assigneePersonId);
      if (!hasAssignee) {
        return false;
      }
    }

    return true;
  });
}

export function summarizeReadiness(items: GearOpsItemSnapshot[]) {
  const summary = {
    total: items.length,
    ready: 0,
    needsInspection: 0,
    maintenanceRequired: 0,
    notReady: 0,
    decommissioned: 0,
    unspecified: 0,
    readyPercent: 0,
  };

  for (const item of items) {
    if (item.readinessState === "READY") {
      summary.ready += 1;
    } else if (item.readinessState === "NEEDS_INSPECTION") {
      summary.needsInspection += 1;
    } else if (item.readinessState === "MAINTENANCE_REQUIRED") {
      summary.maintenanceRequired += 1;
    } else if (item.readinessState === "NOT_READY") {
      summary.notReady += 1;
    } else if (item.readinessState === "DECOMMISSIONED") {
      summary.decommissioned += 1;
    } else {
      summary.unspecified += 1;
    }
  }

  summary.readyPercent = summary.total > 0 ? Math.round((summary.ready / summary.total) * 100) : 0;
  return summary;
}

export function summarizeCustody(
  assignments: GearOpsAssignmentSnapshot[],
  checkouts: GearOpsCheckoutSnapshot[],
  now = new Date(),
) {
  const assignmentStates = ["PENDING", "ACTIVE", "OVERDUE"] as const;
  const checkoutStates = ["OPEN", "OVERDUE"] as const;

  const activeAssignments = assignments.filter((assignment) => assignmentStates.includes(assignment.status));
  const openCheckouts = checkouts.filter((checkout) => checkoutStates.includes(checkout.status));

  const holders = new Set<string>();
  activeAssignments.forEach((assignment) => {
    if (assignment.assignedToPersonId) {
      holders.add(assignment.assignedToPersonId);
    }
  });
  openCheckouts.forEach((checkout) => holders.add(checkout.checkedOutById));

  return {
    activeAssignments: activeAssignments.length,
    openCheckouts: openCheckouts.length,
    overdueAssignments: activeAssignments.filter((assignment) => isOverdueAssignment(assignment, now)).length,
    overdueCheckouts: openCheckouts.filter((checkout) => isOverdueCheckout(checkout, now)).length,
    holderCount: holders.size,
  };
}

export function summarizeLocations(items: GearOpsItemSnapshot[]) {
  const grouped = new Map<string, { locationId: string | null; locationName: string; count: number }>();

  for (const item of items) {
    const key = toKey(item.locationId);
    const existing = grouped.get(key);

    if (existing) {
      existing.count += 1;
      continue;
    }

    grouped.set(key, {
      locationId: item.locationId,
      locationName: item.locationName ?? "Unassigned location",
      count: 1,
    });
  }

  return Array.from(grouped.values()).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.locationName.localeCompare(right.locationName);
  });
}

export function summarizeMaintenance(items: GearOpsItemSnapshot[]) {
  let outOfServiceCount = 0;
  let maintenanceNeededCount = 0;

  for (const item of items) {
    if (isOutOfServiceItem(item)) {
      outOfServiceCount += 1;
      continue;
    }

    if (isMaintenanceNeededItem(item)) {
      maintenanceNeededCount += 1;
    }
  }

  return {
    outOfServiceCount,
    maintenanceNeededCount,
    totalConcernCount: outOfServiceCount + maintenanceNeededCount,
  };
}

export function summarizeConsumables(
  items: GearOpsItemSnapshot[],
  transactions: GearOpsConsumableTransactionSnapshot[],
  now = new Date(),
) {
  const threshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  let adjustments30d = 0;

  for (const transaction of transactions) {
    if (transaction.recordedAt.getTime() < threshold.getTime()) {
      continue;
    }
    if (transaction.transactionType === "ADJUSTED") {
      adjustments30d += 1;
    }
  }

  return {
    lowConsumableCount: items.filter((item) => isLowConsumableItem(item)).length,
    adjustmentCount30d: adjustments30d,
  };
}

export function summarizeEventRequirements(requirements: GearOpsEventRequirementSnapshot[]) {
  const groupedByEvent = new Map<
    string,
    {
      eventId: string;
      eventTitle: string;
      requirementCount: number;
      quantityNeeded: number;
      assignedCount: number;
      gapCount: number;
      deployedCount: number;
      unreturnedCount: number;
      readyCount: number;
      concernCount: number;
      readinessPercent: number;
    }
  >();

  for (const requirement of requirements) {
    const existing = groupedByEvent.get(requirement.eventId) ?? {
      eventId: requirement.eventId,
      eventTitle: requirement.eventTitle,
      requirementCount: 0,
      quantityNeeded: 0,
      assignedCount: 0,
      gapCount: 0,
      deployedCount: 0,
      unreturnedCount: 0,
      readyCount: 0,
      concernCount: 0,
      readinessPercent: 0,
    };

    existing.requirementCount += 1;
    existing.quantityNeeded += requirement.quantityNeeded;
    existing.assignedCount += requirement.assignedCount;
    existing.gapCount += Math.max(requirement.quantityNeeded - requirement.assignedCount, 0);
    existing.deployedCount += requirement.deployedCount;
    existing.unreturnedCount += requirement.unreturnedCount;
    existing.readyCount += requirement.readyCount;
    existing.concernCount +=
      requirement.unavailableCount + requirement.outOfServiceCount + requirement.maintenanceNeededCount;

    groupedByEvent.set(requirement.eventId, existing);
  }

  const values = Array.from(groupedByEvent.values());
  values.forEach((value) => {
    value.readinessPercent = value.quantityNeeded > 0 ? Math.round((value.readyCount / value.quantityNeeded) * 100) : 0;
  });

  values.sort((left, right) => {
    if (right.gapCount !== left.gapCount) {
      return right.gapCount - left.gapCount;
    }
    return left.eventTitle.localeCompare(right.eventTitle);
  });

  return values;
}

export function buildGearOpsExceptions(input: {
  items: GearOpsItemSnapshot[];
  eventRequirements: GearOpsEventRequirementSnapshot[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const exceptions: GearOpsException[] = [];

  for (const item of input.items) {
    if (isOutOfServiceItem(item)) {
      exceptions.push({
        id: `item-oos-${item.id}`,
        kind: "OUT_OF_SERVICE",
        severity: "high",
        title: item.name,
        detail: "Marked out of service by lifecycle or readiness status.",
        href: `/gear-ops/items/${item.id}`,
      });
    } else if (isMaintenanceNeededItem(item)) {
      exceptions.push({
        id: `item-maintenance-${item.id}`,
        kind: "MAINTENANCE_NEEDED",
        severity: "medium",
        title: item.name,
        detail: "Condition or readiness indicates maintenance needed.",
        href: `/gear-ops/items/${item.id}`,
      });
    }

    if (isLowConsumableItem(item)) {
      exceptions.push({
        id: `item-low-consumable-${item.id}`,
        kind: "LOW_CONSUMABLE",
        severity: "medium",
        title: item.name,
        detail: `Consumable is below or at threshold (${item.quantityOnHand}/${item.quantityMin}).`,
        href: `/gear-ops/items/${item.id}`,
      });
    }

    for (const assignment of item.assignments) {
      if (assignment.status === "RETURNED" || assignment.status === "TRANSFERRED" || assignment.status === "CANCELLED") {
        continue;
      }

      if (!isOverdueAssignment(assignment, now)) {
        continue;
      }

      exceptions.push({
        id: `assignment-overdue-${assignment.id}`,
        kind: "OVERDUE_UNRETURNED",
        severity: "high",
        title: item.name,
        detail: `Assignment overdue${assignment.assignedToPersonName ? ` for ${assignment.assignedToPersonName}` : ""}.`,
        href: `/gear-ops/items/${item.id}`,
      });
    }

    for (const checkout of item.checkouts) {
      if (checkout.status === "RETURNED" || checkout.status === "LOST") {
        continue;
      }

      if (!isOverdueCheckout(checkout, now)) {
        continue;
      }

      exceptions.push({
        id: `checkout-overdue-${checkout.id}`,
        kind: "OVERDUE_UNRETURNED",
        severity: "high",
        title: item.name,
        detail: `Checkout overdue${checkout.checkedOutByName ? ` for ${checkout.checkedOutByName}` : ""}.`,
        href: `/gear-ops/items/${item.id}`,
      });
    }
  }

  for (const requirement of input.eventRequirements) {
    const gapCount = Math.max(requirement.quantityNeeded - requirement.assignedCount, 0);
    if (gapCount > 0) {
      exceptions.push({
        id: `event-gap-${requirement.eventId}-${requirement.quantityNeeded}-${requirement.assignedCount}`,
        kind: "EVENT_GEAR_GAP",
        severity: "high",
        title: requirement.eventTitle,
        detail: `${gapCount} required item${gapCount === 1 ? "" : "s"} missing assignment.`,
        href: `/events/${requirement.eventId}/gear`,
      });
    }

    if (requirement.unreturnedCount > 0) {
      exceptions.push({
        id: `event-unreturned-${requirement.eventId}-${requirement.unreturnedCount}`,
        kind: "EVENT_GEAR_UNRETURNED",
        severity: "medium",
        title: requirement.eventTitle,
        detail: `${requirement.unreturnedCount} deployed item${requirement.unreturnedCount === 1 ? "" : "s"} not yet returned.`,
        href: `/events/${requirement.eventId}/gear`,
      });
    }
  }

  const severityRank: Record<GearOpsException["severity"], number> = { high: 0, medium: 1 };
  return exceptions.sort((left, right) => {
    if (severityRank[left.severity] !== severityRank[right.severity]) {
      return severityRank[left.severity] - severityRank[right.severity];
    }

    return left.title.localeCompare(right.title);
  });
}

export function summarizeOperationalRisk(input: {
  maintenanceConcernCount: number;
  overdueCount: number;
  lowConsumableCount: number;
  eventGapCount: number;
  eventUnreturnedCount: number;
}) {
  return [
    {
      key: "overdue",
      label: "Overdue / unreturned custody",
      count: input.overdueCount,
      severity: input.overdueCount > 0 ? "high" : "low",
      href: "/gear-ops/reports?exception=OVERDUE_UNRETURNED",
    },
    {
      key: "maintenance",
      label: "Maintenance and out-of-service",
      count: input.maintenanceConcernCount,
      severity: input.maintenanceConcernCount > 0 ? "high" : "low",
      href: "/gear-ops/reports?exception=MAINTENANCE_NEEDED",
    },
    {
      key: "consumable",
      label: "Low consumables",
      count: input.lowConsumableCount,
      severity: input.lowConsumableCount > 0 ? "medium" : "low",
      href: "/gear-ops/reports?exception=LOW_CONSUMABLE",
    },
    {
      key: "event-gap",
      label: "Event required gear gaps",
      count: input.eventGapCount,
      severity: input.eventGapCount > 0 ? "high" : "low",
      href: "/gear-ops/reports?exception=EVENT_GEAR_GAP",
    },
    {
      key: "event-unreturned",
      label: "Event unreturned gear",
      count: input.eventUnreturnedCount,
      severity: input.eventUnreturnedCount > 0 ? "medium" : "low",
      href: "/gear-ops/reports?exception=EVENT_GEAR_UNRETURNED",
    },
  ] as const;
}
