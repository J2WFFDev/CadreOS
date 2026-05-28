import {
  GearCheckoutStatus,
  GearConditionStatus,
  GearItemLifecycleStatus,
  InventoryReadinessState,
} from "@prisma/client";

const USAGE_LOG_PREFIX = "Usage log:";

export function buildGearCheckoutReturnNotes(input: {
  usageLog: string | null | undefined;
  returnNotes: string | null | undefined;
}): string | null {
  const usageLog = input.usageLog?.trim() ?? "";
  const returnNotes = input.returnNotes?.trim() ?? "";
  const sections: string[] = [];

  if (usageLog.length > 0) {
    sections.push(`${USAGE_LOG_PREFIX} ${usageLog}`);
  }

  if (returnNotes.length > 0) {
    sections.push(returnNotes);
  }

  return sections.length > 0 ? sections.join("\n\n") : null;
}

export function parseGearCheckoutReturnNotes(returnNotes: string | null | undefined): {
  usageLog: string;
  returnNotes: string;
} {
  const normalized = returnNotes?.trim() ?? "";
  if (normalized.length === 0) {
    return { usageLog: "", returnNotes: "" };
  }

  const [firstBlock, ...remainingBlocks] = normalized.split(/\n\s*\n/);
  if (!firstBlock.startsWith(USAGE_LOG_PREFIX)) {
    return { usageLog: "", returnNotes: normalized };
  }

  const usageLog = firstBlock.slice(USAGE_LOG_PREFIX.length).trim();
  return {
    usageLog,
    returnNotes: remainingBlocks.join("\n\n").trim(),
  };
}

export function buildGearCheckoutUsageHistoryLabel(usageLog: string | null | undefined): string | null {
  const normalized = usageLog?.trim() ?? "";
  return normalized.length > 0 ? `${USAGE_LOG_PREFIX} ${normalized}` : null;
}

export function deriveGearItemCheckinUpdate(input: {
  checkoutStatus: GearCheckoutStatus;
  conditionOnReturn: GearConditionStatus | null;
  currentLifecycleStatus: GearItemLifecycleStatus;
}): {
  conditionStatus?: GearConditionStatus;
  readinessState?: InventoryReadinessState;
  lifecycleStatus?: GearItemLifecycleStatus;
  needsMaintenanceFollowUp: boolean;
} {
  if (input.checkoutStatus !== GearCheckoutStatus.RETURNED) {
    return { needsMaintenanceFollowUp: false };
  }

  const updates: {
    conditionStatus?: GearConditionStatus;
    readinessState?: InventoryReadinessState;
    lifecycleStatus?: GearItemLifecycleStatus;
    needsMaintenanceFollowUp: boolean;
  } = {
    needsMaintenanceFollowUp: false,
  };

  if (input.conditionOnReturn) {
    updates.conditionStatus = input.conditionOnReturn;
  }

  if (input.conditionOnReturn === GearConditionStatus.POOR || input.conditionOnReturn === GearConditionStatus.DAMAGED) {
    updates.readinessState = InventoryReadinessState.MAINTENANCE_REQUIRED;
    updates.lifecycleStatus = GearItemLifecycleStatus.MAINTENANCE;
    updates.needsMaintenanceFollowUp = true;
    return updates;
  }

  if (input.currentLifecycleStatus === GearItemLifecycleStatus.CHECKED_OUT) {
    updates.lifecycleStatus = GearItemLifecycleStatus.ACTIVE;
  }

  return updates;
}
