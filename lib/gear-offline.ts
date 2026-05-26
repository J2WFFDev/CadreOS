import type { ScanContext } from "@/lib/inventory-scan/types";

export const GEAR_PENDING_ACTION_STATUSES = [
  "DRAFTED_LOCALLY",
  "PENDING_SYNC",
  "SYNC_FAILED",
  "NEEDS_REVIEW",
  "COMPLETED",
  "ONLINE_REQUIRED",
] as const;

export type GearPendingActionStatus = (typeof GEAR_PENDING_ACTION_STATUSES)[number];

export const GEAR_OFFLINE_CAPABILITIES = [
  "OFFLINE_SAFE",
  "OFFLINE_DRAFTABLE",
  "OFFLINE_LIMITED",
  "ONLINE_REQUIRED",
] as const;

export type GearOfflineCapability = (typeof GEAR_OFFLINE_CAPABILITIES)[number];
export type GearOfflineRetryMode = "AUTO" | "MANUAL" | "BLOCKED";
export type GearOfflineBoundary = "LOCAL_ONLY" | "SERVER_CONFIRMATION" | "REVIEW_BEFORE_CONFIRM";
export type GearPendingActionSubjectType = "GEAR_ITEM" | "EVENT" | "SCAN_WORKFLOW" | "GEAR_OPS";

export type GearOfflineActionType =
  | "gear.reservation.create"
  | "gear.reservation.update"
  | "gear.checkout.create"
  | "gear.assignment.create"
  | "gear.maintenance.create"
  | "gear.consumable.create"
  | "event.gear.plan.save"
  | "event.gear.requirement.create"
  | "event.gear.assignment.create"
  | "event.gear.staging"
  | "event.gear.recovery"
  | "scan.lookup"
  | "scan.verification"
  | "scan.custody"
  | "scan.audit";

export type GearOfflinePolicy = {
  actionType: GearOfflineActionType;
  label: string;
  capability: GearOfflineCapability;
  boundary: GearOfflineBoundary;
  retryMode: GearOfflineRetryMode;
  queueable: boolean;
  optimisticLabel: string;
  offlineDescription: string;
  onlineRequiredReason?: string;
};

export type GearPendingActionRecord = {
  id: string;
  organizationId: string;
  actionType: GearOfflineActionType;
  label: string;
  capability: GearOfflineCapability;
  status: GearPendingActionStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  retryCount: number;
  retryMode: GearOfflineRetryMode;
  request: {
    action: string;
    method: "POST";
    formEntries: Array<[string, string]>;
  };
  context: {
    subjectType: GearPendingActionSubjectType;
    subjectId?: string | null;
    subjectLabel?: string | null;
    scanContext?: ScanContext | null;
    returnHref?: string | null;
  };
  permissionKey?: string | null;
  lastError?: string | null;
};

export type GearRetryResult = {
  outcome: "COMPLETED" | "FAILED" | "BLOCKED";
  message: string;
  completedAt?: string;
};

const POLICY_MAP: Record<GearOfflineActionType, GearOfflinePolicy> = {
  "gear.reservation.create": {
    actionType: "gear.reservation.create",
    label: "Gear reservation / hold",
    capability: "ONLINE_REQUIRED",
    boundary: "SERVER_CONFIRMATION",
    retryMode: "BLOCKED",
    queueable: false,
    optimisticLabel: "Online required",
    offlineDescription: "Reservation and hold availability checks stay online-only so conflicts and custody state remain current.",
    onlineRequiredReason: "Creating a reservation or hold requires a live connection.",
  },
  "gear.reservation.update": {
    actionType: "gear.reservation.update",
    label: "Gear reservation / hold update",
    capability: "ONLINE_REQUIRED",
    boundary: "SERVER_CONFIRMATION",
    retryMode: "BLOCKED",
    queueable: false,
    optimisticLabel: "Online required",
    offlineDescription: "Reservation releases, cancellations, and approval changes stay online-only to keep availability trustworthy.",
    onlineRequiredReason: "Updating a reservation or hold requires a live connection.",
  },
  "gear.checkout.create": {
    actionType: "gear.checkout.create",
    label: "Gear check-out",
    capability: "OFFLINE_LIMITED",
    boundary: "REVIEW_BEFORE_CONFIRM",
    retryMode: "MANUAL",
    queueable: true,
    optimisticLabel: "Pending review",
    offlineDescription: "You can stage the checkout locally, but custody is not final until the server confirms it.",
  },
  "gear.assignment.create": {
    actionType: "gear.assignment.create",
    label: "Gear assignment",
    capability: "OFFLINE_LIMITED",
    boundary: "REVIEW_BEFORE_CONFIRM",
    retryMode: "MANUAL",
    queueable: true,
    optimisticLabel: "Pending review",
    offlineDescription: "Assignments may conflict with live custody state, so offline capture stays queued for review.",
  },
  "gear.maintenance.create": {
    actionType: "gear.maintenance.create",
    label: "Maintenance log",
    capability: "OFFLINE_SAFE",
    boundary: "SERVER_CONFIRMATION",
    retryMode: "AUTO",
    queueable: true,
    optimisticLabel: "Pending sync",
    offlineDescription: "Maintenance notes are safe to capture offline and retry automatically on reconnect.",
  },
  "gear.consumable.create": {
    actionType: "gear.consumable.create",
    label: "Consumable adjustment",
    capability: "OFFLINE_DRAFTABLE",
    boundary: "REVIEW_BEFORE_CONFIRM",
    retryMode: "MANUAL",
    queueable: true,
    optimisticLabel: "Drafted locally",
    offlineDescription: "Consumable adjustments can be drafted offline, but stock counts remain unconfirmed until reviewed online.",
  },
  "event.gear.plan.save": {
    actionType: "event.gear.plan.save",
    label: "Event gear plan",
    capability: "ONLINE_REQUIRED",
    boundary: "SERVER_CONFIRMATION",
    retryMode: "BLOCKED",
    queueable: false,
    optimisticLabel: "Online required",
    offlineDescription: "Plan changes stay online-only so event coordination always uses current server state.",
    onlineRequiredReason: "Event planning changes require a live connection before they can be saved.",
  },
  "event.gear.requirement.create": {
    actionType: "event.gear.requirement.create",
    label: "Event gear requirement",
    capability: "ONLINE_REQUIRED",
    boundary: "SERVER_CONFIRMATION",
    retryMode: "BLOCKED",
    queueable: false,
    optimisticLabel: "Online required",
    offlineDescription: "Requirement changes are online-only because they drive assignment and readiness coordination.",
    onlineRequiredReason: "Adding or changing event gear requirements requires a live connection.",
  },
  "event.gear.assignment.create": {
    actionType: "event.gear.assignment.create",
    label: "Event gear assignment",
    capability: "ONLINE_REQUIRED",
    boundary: "SERVER_CONFIRMATION",
    retryMode: "BLOCKED",
    queueable: false,
    optimisticLabel: "Online required",
    offlineDescription: "Specific event assignments are online-only to avoid stale readiness and custody conflicts.",
    onlineRequiredReason: "Assigning specific gear to an event requires current server availability.",
  },
  "event.gear.staging": {
    actionType: "event.gear.staging",
    label: "Event gear staging",
    capability: "OFFLINE_LIMITED",
    boundary: "REVIEW_BEFORE_CONFIRM",
    retryMode: "MANUAL",
    queueable: true,
    optimisticLabel: "Pending review",
    offlineDescription: "Staging can be captured offline, but final deployment state remains pending until confirmed online.",
  },
  "event.gear.recovery": {
    actionType: "event.gear.recovery",
    label: "Event gear recovery",
    capability: "OFFLINE_LIMITED",
    boundary: "REVIEW_BEFORE_CONFIRM",
    retryMode: "MANUAL",
    queueable: true,
    optimisticLabel: "Pending review",
    offlineDescription: "Recovery notes can be queued offline, but cage/vault state is not final until sync completes.",
  },
  "scan.lookup": {
    actionType: "scan.lookup",
    label: "Scan lookup draft",
    capability: "OFFLINE_DRAFTABLE",
    boundary: "LOCAL_ONLY",
    retryMode: "AUTO",
    queueable: true,
    optimisticLabel: "Drafted locally",
    offlineDescription: "Lookup scans can be held locally and retried when the connection returns.",
  },
  "scan.verification": {
    actionType: "scan.verification",
    label: "Readiness verification draft",
    capability: "OFFLINE_SAFE",
    boundary: "SERVER_CONFIRMATION",
    retryMode: "AUTO",
    queueable: true,
    optimisticLabel: "Pending sync",
    offlineDescription: "Verification scans can be drafted offline and retried automatically on reconnect.",
  },
  "scan.custody": {
    actionType: "scan.custody",
    label: "Custody scan draft",
    capability: "OFFLINE_LIMITED",
    boundary: "REVIEW_BEFORE_CONFIRM",
    retryMode: "MANUAL",
    queueable: true,
    optimisticLabel: "Pending review",
    offlineDescription: "Custody scans can be staged locally, but custody changes stay unconfirmed until the server accepts them.",
  },
  "scan.audit": {
    actionType: "scan.audit",
    label: "Audit / location scan draft",
    capability: "OFFLINE_DRAFTABLE",
    boundary: "LOCAL_ONLY",
    retryMode: "AUTO",
    queueable: true,
    optimisticLabel: "Drafted locally",
    offlineDescription: "Audit and location scans can be safely drafted offline for later resolution.",
  },
};

export function resolveGearOfflinePolicy(actionType: GearOfflineActionType): GearOfflinePolicy {
  return POLICY_MAP[actionType];
}

export function resolveGearOfflineActionTypeForScanContext(scanContext: ScanContext): GearOfflineActionType {
  switch (scanContext) {
    case "CHECKOUT":
    case "CHECKIN":
    case "ASSIGNMENT":
      return "scan.custody";
    case "INVENTORY_VERIFICATION":
      return "scan.verification";
    case "CAGE_VAULT":
    case "AUDIT_PREP":
      return "scan.audit";
    case "INVENTORY_LOOKUP":
    default:
      return "scan.lookup";
  }
}

export function getGearPendingActionStatusLabel(status: GearPendingActionStatus): string {
  switch (status) {
    case "DRAFTED_LOCALLY":
      return "Drafted locally";
    case "PENDING_SYNC":
      return "Pending sync";
    case "SYNC_FAILED":
      return "Sync failed";
    case "NEEDS_REVIEW":
      return "Needs review";
    case "COMPLETED":
      return "Completed";
    case "ONLINE_REQUIRED":
      return "Online required";
  }
}

export function getGearOfflineCapabilityLabel(capability: GearOfflineCapability): string {
  switch (capability) {
    case "OFFLINE_SAFE":
      return "Offline-safe";
    case "OFFLINE_DRAFTABLE":
      return "Offline-draftable";
    case "OFFLINE_LIMITED":
      return "Offline-limited";
    case "ONLINE_REQUIRED":
      return "Online-required";
  }
}

export function initialStatusForGearOfflinePolicy(policy: GearOfflinePolicy): GearPendingActionStatus {
  switch (policy.capability) {
    case "OFFLINE_SAFE":
      return "PENDING_SYNC";
    case "OFFLINE_DRAFTABLE":
      return "DRAFTED_LOCALLY";
    case "OFFLINE_LIMITED":
      return "NEEDS_REVIEW";
    case "ONLINE_REQUIRED":
      return "ONLINE_REQUIRED";
  }
}

export function createGearPendingAction(input: {
  id: string;
  organizationId: string;
  actionType: GearOfflineActionType;
  actionLabel?: string;
  requestAction: string;
  formEntries: Array<[string, string]>;
  subjectType: GearPendingActionSubjectType;
  subjectId?: string | null;
  subjectLabel?: string | null;
  scanContext?: ScanContext | null;
  returnHref?: string | null;
  permissionKey?: string | null;
  createdAt: string;
}): GearPendingActionRecord {
  const policy = resolveGearOfflinePolicy(input.actionType);
  return {
    id: input.id,
    organizationId: input.organizationId,
    actionType: input.actionType,
    label: input.actionLabel ?? policy.label,
    capability: policy.capability,
    status: initialStatusForGearOfflinePolicy(policy),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    retryCount: 0,
    retryMode: policy.retryMode,
    request: {
      action: input.requestAction,
      method: "POST",
      formEntries: input.formEntries,
    },
    context: {
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      subjectLabel: input.subjectLabel ?? null,
      scanContext: input.scanContext ?? null,
      returnHref: input.returnHref ?? null,
    },
    permissionKey: input.permissionKey ?? null,
    lastError: null,
    completedAt: null,
  };
}

export function markGearPendingActionRetrying(action: GearPendingActionRecord, updatedAt: string): GearPendingActionRecord {
  return {
    ...action,
    status: "PENDING_SYNC",
    retryCount: action.retryCount + 1,
    updatedAt,
    lastError: null,
  };
}

export function applyGearRetryResult(
  action: GearPendingActionRecord,
  result: GearRetryResult,
  updatedAt: string,
): GearPendingActionRecord {
  if (result.outcome === "COMPLETED") {
    return {
      ...action,
      status: "COMPLETED",
      updatedAt,
      completedAt: result.completedAt ?? updatedAt,
      lastError: null,
    };
  }

  if (result.outcome === "BLOCKED") {
    return {
      ...action,
      status: "ONLINE_REQUIRED",
      updatedAt,
      lastError: result.message,
    };
  }

  return {
    ...action,
    status: "SYNC_FAILED",
    updatedAt,
    lastError: result.message,
  };
}

export function discardGearPendingAction(actions: GearPendingActionRecord[], actionId: string) {
  return actions.filter((action) => action.id !== actionId);
}

export function summarizeGearPendingActions(actions: GearPendingActionRecord[]) {
  return actions.reduce(
    (summary, action) => {
      switch (action.status) {
        case "PENDING_SYNC":
        case "DRAFTED_LOCALLY":
          summary.pendingCount += 1;
          break;
        case "SYNC_FAILED":
          summary.failedCount += 1;
          break;
        case "NEEDS_REVIEW":
          summary.reviewCount += 1;
          break;
        case "COMPLETED":
          summary.completedCount += 1;
          break;
        case "ONLINE_REQUIRED":
          summary.blockedCount += 1;
          break;
      }
      return summary;
    },
    { pendingCount: 0, failedCount: 0, reviewCount: 0, completedCount: 0, blockedCount: 0 },
  );
}

export function filterGearPendingActionsByOrganization(actions: GearPendingActionRecord[], organizationId: string) {
  return actions.filter((action) => action.organizationId === organizationId);
}

export function filterGearPendingActionsBySubject(
  actions: GearPendingActionRecord[],
  subjectType: GearPendingActionSubjectType,
  subjectId: string,
) {
  return actions.filter((action) => action.context.subjectType === subjectType && action.context.subjectId === subjectId);
}

export function shouldAutoRetryGearPendingAction(action: GearPendingActionRecord) {
  return (
    action.retryMode === "AUTO" &&
    (action.status === "PENDING_SYNC" || action.status === "DRAFTED_LOCALLY" || action.status === "SYNC_FAILED")
  );
}

export function canRetryGearPendingAction(action: GearPendingActionRecord) {
  return action.retryMode !== "BLOCKED" && action.status !== "COMPLETED";
}

export function shouldShowGearActionInConfirmedHistory(action: GearPendingActionRecord) {
  return action.status === "COMPLETED";
}

export function shouldShowGearActionInLocalHistory(action: GearPendingActionRecord) {
  return action.status !== "COMPLETED";
}

export function buildGearConnectivityBannerModel(input: {
  online: boolean;
  pendingCount: number;
  failedCount: number;
  reviewCount: number;
}) {
  if (!input.online) {
    return {
      tone: "warning" as const,
      title: "Offline mode",
      detail:
        input.pendingCount + input.reviewCount > 0
          ? `${input.pendingCount + input.reviewCount} field action(s) are being held locally until connectivity returns.`
          : "Field actions will be drafted locally where safe. Online-required work stays blocked.",
    };
  }

  if (input.failedCount > 0) {
    return {
      tone: "warning" as const,
      title: "Sync attention needed",
      detail: `${input.failedCount} pending action(s) failed to sync and need review or retry.`,
    };
  }

  if (input.pendingCount > 0 || input.reviewCount > 0) {
    return {
      tone: "info" as const,
      title: "Reconnected",
      detail: `${input.pendingCount} pending and ${input.reviewCount} review action(s) remain visible until the server confirms them.`,
    };
  }

  return {
    tone: "success" as const,
    title: "Connected",
    detail: "GearOps is online. Confirmed activity remains server-backed and trustworthy.",
  };
}
