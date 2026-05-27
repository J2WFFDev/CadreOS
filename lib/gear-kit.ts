/**
 * Arc 20X — GearOps Advanced Kit and Bundle Operations
 *
 * Core kit/bundle logic: completeness checking, readiness derivation,
 * badge helpers, and type definitions for the GearKit domain.
 *
 * All functions are pure (no DB calls) and operate on lightweight snapshots
 * to keep computation fast and testable.
 */

import type {
  GearConditionStatus,
  GearInspectionDueStatus,
  GearItemLifecycleStatus,
  GearKitComponentRole,
  GearKitCustodyStatus,
  GearKitInspectionStatus,
  GearKitReadinessLabel,
  GearKitType,
  GearMaintenanceDueStatus,
  InventoryReadinessState,
} from "@prisma/client";

// ── Component snapshot ───────────────────────────────────────────────────────

/**
 * Lightweight projection of a kit component used for completeness
 * and readiness calculation. Does not include DB-specific types.
 */
export type GearKitComponentSnapshot = {
  kitItemId: string;
  gearItemId: string;
  gearItemName: string;
  componentRole: GearKitComponentRole;
  isRequired: boolean;
  quantityExpected: number;
  quantityActual: number;
  removedAt: Date | null;
  lifecycleStatus: GearItemLifecycleStatus;
  conditionStatus: GearConditionStatus | null;
  readinessState: InventoryReadinessState | null;
  // Arc 20Y: inspection/maintenance due status
  inspectionDueStatus?: GearInspectionDueStatus | null;
  maintenanceDueStatus?: GearMaintenanceDueStatus | null;
};

// ── Completeness result ──────────────────────────────────────────────────────

export type GearKitComponentSummary = {
  kitItemId: string;
  gearItemId: string;
  gearItemName: string;
  componentRole: GearKitComponentRole;
  isRequired: boolean;
  present: boolean;
  outOfService: boolean;
  maintenanceNeeded: boolean;
  damaged: boolean;
  quantityExpected: number;
  quantityActual: number;
  lifecycleStatus: GearItemLifecycleStatus;
  conditionStatus: GearConditionStatus | null;
  readinessState: InventoryReadinessState | null;
  // Arc 20Y
  inspectionDueStatus: GearInspectionDueStatus | null;
  maintenanceDueStatus: GearMaintenanceDueStatus | null;
};

export type GearKitCompletenessResult = {
  totalComponents: number;
  requiredComponents: number;
  optionalComponents: number;
  presentCount: number;
  missingRequiredCount: number;
  missingOptionalCount: number;
  outOfServiceCount: number;
  maintenanceNeededCount: number;
  damagedCount: number;
  // Arc 20Y
  inspectionOverdueCount: number;
  maintenanceOverdueCount: number;
  /** Fraction of required components present (0.0 – 1.0). */
  requiredCompleteness: number;
  /** Fraction of all components present (0.0 – 1.0). */
  overallCompleteness: number;
  components: GearKitComponentSummary[];
};

// ── Readiness evaluation input ───────────────────────────────────────────────

export type GearKitReadinessInput = {
  completeness: GearKitCompletenessResult;
  custodyStatus: GearKitCustodyStatus;
  lastInspectionStatus: GearKitInspectionStatus | null;
  /** Whether any active reservation or hold conflicts exist. */
  hasConflict?: boolean;
};

// ── Out-of-service lifecycle statuses ───────────────────────────────────────

const OUT_OF_SERVICE_STATUSES: Set<GearItemLifecycleStatus> = new Set([
  "MAINTENANCE",
  "QUARANTINED",
  "RETIRED",
  "LOST",
]);

const MAINTENANCE_READINESS_STATES: Set<InventoryReadinessState> = new Set([
  "MAINTENANCE_REQUIRED",
  "NOT_READY",
  "DECOMMISSIONED",
]);

const DAMAGED_CONDITIONS: Set<GearConditionStatus> = new Set([
  "POOR",
  "DAMAGED",
]);

// ── Completeness computation ─────────────────────────────────────────────────

/**
 * Computes kit completeness from component snapshots.
 *
 * Only active components (removedAt === null) are considered.
 * Completeness measures whether required components are present
 * and in usable condition.
 */
export function computeKitCompleteness(
  components: GearKitComponentSnapshot[],
): GearKitCompletenessResult {
  const active = components.filter((c) => c.removedAt === null);

  const summaries: GearKitComponentSummary[] = active.map((c) => {
    const outOfService = OUT_OF_SERVICE_STATUSES.has(c.lifecycleStatus);
    const maintenanceNeeded =
      !outOfService &&
      c.readinessState !== null &&
      MAINTENANCE_READINESS_STATES.has(c.readinessState);
    const damaged =
      c.conditionStatus !== null && DAMAGED_CONDITIONS.has(c.conditionStatus);
    const present =
      c.quantityActual >= c.quantityExpected &&
      !outOfService &&
      c.lifecycleStatus !== "LOST";

    return {
      kitItemId: c.kitItemId,
      gearItemId: c.gearItemId,
      gearItemName: c.gearItemName,
      componentRole: c.componentRole,
      isRequired: c.isRequired,
      present,
      outOfService,
      maintenanceNeeded,
      damaged,
      quantityExpected: c.quantityExpected,
      quantityActual: c.quantityActual,
      lifecycleStatus: c.lifecycleStatus,
      conditionStatus: c.conditionStatus,
      readinessState: c.readinessState,
      // Arc 20Y
      inspectionDueStatus: c.inspectionDueStatus ?? null,
      maintenanceDueStatus: c.maintenanceDueStatus ?? null,
    };
  });

  const requiredComponents = summaries.filter((s) => s.isRequired);
  const optionalComponents = summaries.filter((s) => !s.isRequired);

  const presentCount = summaries.filter((s) => s.present).length;
  const missingRequiredCount = requiredComponents.filter(
    (s) => !s.present,
  ).length;
  const missingOptionalCount = optionalComponents.filter(
    (s) => !s.present,
  ).length;
  const outOfServiceCount = summaries.filter((s) => s.outOfService).length;
  const maintenanceNeededCount = summaries.filter(
    (s) => s.maintenanceNeeded,
  ).length;
  const damagedCount = summaries.filter((s) => s.damaged).length;
  // Arc 20Y
  const inspectionOverdueCount = summaries.filter(
    (s) => s.inspectionDueStatus === "OVERDUE",
  ).length;
  const maintenanceOverdueCount = summaries.filter(
    (s) => s.maintenanceDueStatus === "OVERDUE",
  ).length;

  const requiredCompleteness =
    requiredComponents.length === 0
      ? 1.0
      : summaries.filter((s) => s.isRequired && s.present).length /
        requiredComponents.length;

  const overallCompleteness =
    summaries.length === 0
      ? 1.0
      : presentCount / summaries.length;

  return {
    totalComponents: summaries.length,
    requiredComponents: requiredComponents.length,
    optionalComponents: optionalComponents.length,
    presentCount,
    missingRequiredCount,
    missingOptionalCount,
    outOfServiceCount,
    maintenanceNeededCount,
    damagedCount,
    inspectionOverdueCount,
    maintenanceOverdueCount,
    requiredCompleteness,
    overallCompleteness,
    components: summaries,
  };
}

// ── Readiness derivation ─────────────────────────────────────────────────────

/**
 * Derives a GearKitReadinessLabel from completeness and operational state.
 *
 * Priority order (highest concern first):
 * 1. CONFLICT          — active reservation/hold conflict
 * 2. OUT_OF_SERVICE    — kit custody status is IN_MAINTENANCE or kit has OOS required components
 * 3. MISSING_COMPONENTS — required components missing
 * 4. MAINTENANCE_NEEDED — required components need maintenance or have overdue scheduled maintenance
 * 5. NEEDS_INSPECTION  — last inspection failed, kit in inspection, or required component inspection overdue
 * 6. INCOMPLETE        — optional components missing (required all present)
 * 7. LIMITED_USE       — damaged components present but kit is complete
 * 8. READY_WITH_WARNING — all present, minor issues
 * 9. READY             — all required present, no concerns
 */
export function computeKitReadiness(
  input: GearKitReadinessInput,
): GearKitReadinessLabel {
  const { completeness, custodyStatus, lastInspectionStatus, hasConflict } =
    input;

  if (hasConflict) {
    return "CONFLICT";
  }

  if (
    custodyStatus === "IN_MAINTENANCE" ||
    completeness.components.some((c) => c.isRequired && c.outOfService)
  ) {
    return "OUT_OF_SERVICE";
  }

  if (completeness.missingRequiredCount > 0) {
    return "MISSING_COMPONENTS";
  }

  const requiredMaintenanceNeeded =
    completeness.components.some((c) => c.isRequired && c.maintenanceNeeded) ||
    // Arc 20Y: required components with overdue scheduled maintenance
    completeness.components.some((c) => c.isRequired && c.maintenanceDueStatus === "OVERDUE");
  if (requiredMaintenanceNeeded) {
    return "MAINTENANCE_NEEDED";
  }

  if (
    lastInspectionStatus === "FAILED" ||
    custodyStatus === "IN_INSPECTION" ||
    // Arc 20Y: required components with overdue inspection
    completeness.components.some((c) => c.isRequired && c.inspectionDueStatus === "OVERDUE")
  ) {
    return "NEEDS_INSPECTION";
  }

  if (completeness.missingOptionalCount > 0) {
    return "INCOMPLETE";
  }

  const requiredDamaged = completeness.components.some(
    (c) => c.isRequired && c.damaged,
  );
  if (requiredDamaged) {
    return "LIMITED_USE";
  }

  const hasAnyWarning =
    completeness.outOfServiceCount > 0 ||
    completeness.maintenanceNeededCount > 0 ||
    completeness.damagedCount > 0 ||
    completeness.inspectionOverdueCount > 0 ||
    completeness.maintenanceOverdueCount > 0 ||
    lastInspectionStatus === "PASSED_WITH_NOTES";

  if (hasAnyWarning) {
    return "READY_WITH_WARNING";
  }

  return "READY";
}

// ── Label helpers ────────────────────────────────────────────────────────────

/** Returns a human-readable label for a GearKitType. */
export function labelForKitType(kitType: GearKitType): string {
  const labels: Record<GearKitType, string> = {
    KIT: "Kit",
    BUNDLE: "Bundle",
    CASE: "Case",
    BAG: "Bag",
    SET: "Set",
    LOADOUT: "Loadout",
    EQUIPMENT_PACKAGE: "Equipment Package",
  };
  return labels[kitType];
}

/** Returns a human-readable label for a GearKitReadinessLabel. */
export function labelForKitReadiness(label: GearKitReadinessLabel): string {
  const labels: Record<GearKitReadinessLabel, string> = {
    READY: "Ready",
    READY_WITH_WARNING: "Ready with Warning",
    INCOMPLETE: "Incomplete",
    LIMITED_USE: "Limited Use",
    NEEDS_INSPECTION: "Needs Inspection",
    MAINTENANCE_NEEDED: "Maintenance Needed",
    OUT_OF_SERVICE: "Out of Service",
    MISSING_COMPONENTS: "Missing Components",
    CONFLICT: "Conflict",
  };
  return labels[label];
}

/** Returns a human-readable label for a GearKitCustodyStatus. */
export function labelForKitCustodyStatus(status: GearKitCustodyStatus): string {
  const labels: Record<GearKitCustodyStatus, string> = {
    AVAILABLE: "Available",
    CHECKED_OUT: "Checked Out",
    ASSIGNED: "Assigned",
    DEPLOYED: "Deployed",
    RESERVED: "Reserved",
    IN_INSPECTION: "In Inspection",
    IN_MAINTENANCE: "In Maintenance",
  };
  return labels[status];
}

/** Returns a human-readable label for a GearKitComponentRole. */
export function labelForKitComponentRole(role: GearKitComponentRole): string {
  const labels: Record<GearKitComponentRole, string> = {
    REQUIRED: "Required",
    OPTIONAL: "Optional",
    QUANTITY_MANAGED: "Quantity Managed",
    CONSUMABLE: "Consumable",
    REPLACEABLE: "Replaceable",
  };
  return labels[role];
}

/** Returns a human-readable label for a GearKitInspectionStatus. */
export function labelForKitInspectionStatus(
  status: GearKitInspectionStatus,
): string {
  const labels: Record<GearKitInspectionStatus, string> = {
    PASSED: "Passed",
    PASSED_WITH_NOTES: "Passed with Notes",
    FAILED: "Failed",
    INCOMPLETE: "Incomplete",
  };
  return labels[status];
}

// ── Badge class helpers ──────────────────────────────────────────────────────

/** Returns Tailwind badge classes for a GearKitReadinessLabel. */
export function getKitReadinessBadgeClass(label: GearKitReadinessLabel): string {
  if (label === "READY") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (label === "READY_WITH_WARNING") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
  }
  if (label === "INCOMPLETE" || label === "LIMITED_USE") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }
  if (
    label === "NEEDS_INSPECTION" ||
    label === "MAINTENANCE_NEEDED" ||
    label === "CONFLICT"
  ) {
    return "bg-orange-100 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200";
  }
  // OUT_OF_SERVICE, MISSING_COMPONENTS
  return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
}

/** Returns Tailwind badge classes for a GearKitCustodyStatus. */
export function getKitCustodyStatusBadgeClass(
  status: GearKitCustodyStatus,
): string {
  if (status === "AVAILABLE") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (status === "CHECKED_OUT" || status === "DEPLOYED") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
  }
  if (status === "ASSIGNED") {
    return "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200";
  }
  if (status === "RESERVED") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }
  // IN_INSPECTION, IN_MAINTENANCE
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
}

/** Returns Tailwind badge classes for a GearKitInspectionStatus. */
export function getKitInspectionStatusBadgeClass(
  status: GearKitInspectionStatus,
): string {
  if (status === "PASSED") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
  if (status === "PASSED_WITH_NOTES") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
  }
  if (status === "FAILED") {
    return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
  }
  return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
}

// ── Offline policy helpers ───────────────────────────────────────────────────

/**
 * Kit custody actions require server confirmation.
 * They must not be finalized offline.
 *
 * Inspection drafts may be drafted offline but require sync before
 * updating kit readiness or custody records.
 */
export const GearKitOfflinePolicies = {
  CHECKOUT: "ONLINE_REQUIRED",
  CHECKIN: "ONLINE_REQUIRED",
  ASSIGN: "ONLINE_REQUIRED",
  INSPECT: "OFFLINE_DRAFTABLE",
  RESERVE: "ONLINE_REQUIRED",
  ADD_ITEM: "ONLINE_REQUIRED",
  REMOVE_ITEM: "ONLINE_REQUIRED",
} as const;

export type GearKitOfflinePolicy = keyof typeof GearKitOfflinePolicies;

// ── Completeness percentage helper ───────────────────────────────────────────

/** Returns completeness as a formatted percentage string (e.g., "75%"). */
export function formatKitCompleteness(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

// ── Readiness label for dashboard summaries ──────────────────────────────────

/**
 * Returns true when a kit readiness label represents an operationally
 * acceptable state (kit can be deployed or checked out).
 */
export function isKitOperationallyReady(label: GearKitReadinessLabel): boolean {
  return label === "READY" || label === "READY_WITH_WARNING";
}

/**
 * Returns true when a kit requires immediate attention before use.
 */
export function isKitBlockedFromUse(label: GearKitReadinessLabel): boolean {
  return (
    label === "OUT_OF_SERVICE" ||
    label === "MISSING_COMPONENTS" ||
    label === "CONFLICT"
  );
}
