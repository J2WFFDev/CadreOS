import type {
  GearConditionStatus,
  InventoryAuditScope,
  InventoryAuditSessionStatus,
  InventoryAuditType,
  InventoryDiscrepancyStatus,
  InventoryDiscrepancyType,
  InventoryVerificationStatus,
} from "@prisma/client";

export {
  InventoryAuditScope,
  InventoryAuditSessionStatus,
  InventoryAuditType,
  InventoryDiscrepancyStatus,
  InventoryDiscrepancyType,
  InventoryVerificationStatus,
};

export const INVENTORY_AUDIT_ACTIVITY_ACTIONS = {
  AUDIT_CREATED: "inventory.audit.created",
  SESSION_STARTED: "inventory.audit.session.started",
  VERIFICATION_RECORDED: "inventory.audit.verification.recorded",
  DISCREPANCY_OPENED: "inventory.audit.discrepancy.opened",
  DISCREPANCY_RESOLVED: "inventory.audit.discrepancy.resolved",
} as const;

export type CreateInventoryAuditInput = {
  organizationId: string;
  createdByPersonId: string;
  name: string;
  description?: string | null;
  auditType: InventoryAuditType;
  scope: InventoryAuditScope;
  scopeReferenceId?: string | null;
  cadenceDays?: number | null;
  nextScheduledAt?: Date | null;
};

export type StartInventoryAuditSessionInput = {
  organizationId: string;
  auditId?: string | null;
  title: string;
  startedByPersonId?: string | null;
  notes?: string | null;
  plannedAt?: Date | null;
  scopeSnapshotJson?: string | null;
};

export type RecordInventoryAuditVerificationInput = {
  organizationId: string;
  auditSessionId: string;
  verificationStatus: InventoryVerificationStatus;
  verifiedByPersonId?: string | null;
  gearItemId?: string | null;
  scanEventId?: string | null;
  scannedCode?: string | null;
  expectedLocationId?: string | null;
  observedLocationId?: string | null;
  expectedCustodyPersonId?: string | null;
  observedCustodyPersonId?: string | null;
  expectedQuantity?: number | null;
  observedQuantity?: number | null;
  expectedReadinessState?: import("@prisma/client").InventoryReadinessState | null;
  observedReadinessState?: import("@prisma/client").InventoryReadinessState | null;
  observedConditionStatus?: GearConditionStatus | null;
  notes?: string | null;
  discrepancyType?: InventoryDiscrepancyType | null;
};

export type ResolveInventoryAuditDiscrepancyInput = {
  organizationId: string;
  discrepancyId: string;
  resolvedByPersonId?: string | null;
  resolutionNotes?: string | null;
  dismissed?: boolean;
};

export function labelForInventoryAuditType(auditType: InventoryAuditType): string {
  const labels: Record<InventoryAuditType, string> = {
    SCHEDULED: "Scheduled",
    AD_HOC: "Ad hoc",
    VAULT_CAGE: "Vault / cage",
    EVENT_VERIFICATION: "Event inventory verification",
    CHECKOUT_RECONCILIATION: "Checkout reconciliation",
    CONSUMABLE_VERIFICATION: "Consumable verification",
    READINESS_INSPECTION: "Readiness inspection",
  };
  return labels[auditType];
}

export function labelForInventoryAuditScope(scope: InventoryAuditScope): string {
  const labels: Record<InventoryAuditScope, string> = {
    ORGANIZATION: "Organization",
    LOCATION: "Location",
    KIT: "Kit",
    EVENT: "Event",
    PERSON: "Person",
    CONSUMABLE: "Consumable",
    READINESS: "Readiness",
  };
  return labels[scope];
}

export function labelForInventoryAuditSessionStatus(status: InventoryAuditSessionStatus): string {
  const labels: Record<InventoryAuditSessionStatus, string> = {
    DRAFT: "Draft",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return labels[status];
}

export function labelForInventoryVerificationStatus(status: InventoryVerificationStatus): string {
  const labels: Record<InventoryVerificationStatus, string> = {
    PENDING: "Pending",
    VERIFIED_MATCH: "Verified match",
    VERIFIED_DISCREPANCY: "Verified discrepancy",
    NOT_FOUND: "Not found",
    SKIPPED: "Skipped",
  };
  return labels[status];
}

export function labelForInventoryDiscrepancyType(type: InventoryDiscrepancyType): string {
  const labels: Record<InventoryDiscrepancyType, string> = {
    MISSING_INVENTORY: "Missing inventory",
    WRONG_LOCATION: "Wrong location",
    DAMAGED_CONDITION: "Damaged condition",
    ASSIGNMENT_MISMATCH: "Assignment mismatch",
    QUANTITY_MISMATCH: "Quantity mismatch",
    READINESS_FAILURE: "Readiness failure",
    UNAUTHORIZED_CUSTODY_STATE: "Unauthorized custody state",
    OTHER: "Other",
  };
  return labels[type];
}

export function labelForInventoryDiscrepancyStatus(status: InventoryDiscrepancyStatus): string {
  const labels: Record<InventoryDiscrepancyStatus, string> = {
    OPEN: "Open",
    RESOLVED: "Resolved",
    DISMISSED: "Dismissed",
  };
  return labels[status];
}

export function inferDiscrepancyTypeFromVerification(input: {
  verificationStatus: InventoryVerificationStatus;
  expectedLocationId?: string | null;
  observedLocationId?: string | null;
  expectedCustodyPersonId?: string | null;
  observedCustodyPersonId?: string | null;
  expectedQuantity?: number | null;
  observedQuantity?: number | null;
  expectedReadinessState?: import("@prisma/client").InventoryReadinessState | null;
  observedReadinessState?: import("@prisma/client").InventoryReadinessState | null;
  observedConditionStatus?: GearConditionStatus | null;
}): InventoryDiscrepancyType | null {
  if (input.verificationStatus === "VERIFIED_MATCH" || input.verificationStatus === "PENDING") {
    return null;
  }

  if (input.verificationStatus === "NOT_FOUND") {
    return "MISSING_INVENTORY";
  }

  if (input.expectedLocationId && input.observedLocationId && input.expectedLocationId !== input.observedLocationId) {
    return "WRONG_LOCATION";
  }

  if (
    input.expectedCustodyPersonId &&
    input.observedCustodyPersonId &&
    input.expectedCustodyPersonId !== input.observedCustodyPersonId
  ) {
    return "ASSIGNMENT_MISMATCH";
  }

  if (input.expectedQuantity !== null && input.expectedQuantity !== undefined) {
    if ((input.observedQuantity ?? null) !== input.expectedQuantity) {
      return "QUANTITY_MISMATCH";
    }
  }

  if (
    input.expectedReadinessState &&
    input.observedReadinessState &&
    input.expectedReadinessState !== input.observedReadinessState
  ) {
    return "READINESS_FAILURE";
  }

  if (input.observedConditionStatus === "DAMAGED" || input.observedConditionStatus === "POOR") {
    return "DAMAGED_CONDITION";
  }

  return "OTHER";
}
