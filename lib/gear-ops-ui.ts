/**
 * gear-ops-ui.ts
 *
 * Shared UI-level helpers for GearOps status badges, labels, color classes, and
 * operator-facing display logic. These are pure functions with no database or
 * auth dependencies, safe to import in both Server and Client components.
 *
 * Responsibilities:
 * - Derive badge/chip CSS classes for lifecycle, condition, readiness, custody status
 * - Derive human-readable short labels for badges
 * - Derive icon label hints (emoji-free, text-safe) for operator status chips
 * - Determine availability / concern signals for operator view
 */

import type {
  GearCheckoutStatus,
  GearAssignmentStatus,
  GearConditionStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
  InventoryReadinessState,
} from "@prisma/client";

// ---------------------------------------------------------------------------
// Lifecycle status
// ---------------------------------------------------------------------------

export type LifecycleTone = "success" | "warning" | "danger" | "neutral" | "info";

export function getLifecycleTone(status: GearItemLifecycleStatus): LifecycleTone {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "RESERVED":
      return "info";
    case "ASSIGNED":
    case "CHECKED_OUT":
      return "info";
    case "MAINTENANCE":
    case "QUARANTINED":
      return "warning";
    case "RETIRED":
    case "LOST":
      return "danger";
    default:
      return "neutral";
  }
}

export function getLifecycleBadgeClass(status: GearItemLifecycleStatus): string {
  const tone = getLifecycleTone(status);
  return toneToChipClass(tone);
}

export function getLifecycleLabel(status: GearItemLifecycleStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "RESERVED":
      return "Reserved";
    case "ASSIGNED":
      return "Assigned";
    case "CHECKED_OUT":
      return "Checked out";
    case "MAINTENANCE":
      return "Maintenance";
    case "QUARANTINED":
      return "Quarantined";
    case "RETIRED":
      return "Retired";
    case "LOST":
      return "Lost";
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// Condition status
// ---------------------------------------------------------------------------

export function getConditionTone(status: GearConditionStatus | null): LifecycleTone {
  if (!status) return "neutral";
  switch (status) {
    case "NEW":
    case "GOOD":
      return "success";
    case "FAIR":
      return "info";
    case "POOR":
    case "DAMAGED":
      return "warning";
    default:
      return "danger";
  }
}

export function getConditionBadgeClass(status: GearConditionStatus | null): string {
  return toneToChipClass(getConditionTone(status));
}

export function getConditionLabel(status: GearConditionStatus | null): string {
  if (!status) return "Unknown condition";
  switch (status) {
    case "NEW":
      return "New";
    case "GOOD":
      return "Good";
    case "FAIR":
      return "Fair";
    case "POOR":
      return "Poor";
    case "DAMAGED":
      return "Damaged";
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// Readiness state
// ---------------------------------------------------------------------------

export function getReadinessTone(state: InventoryReadinessState | null): LifecycleTone {
  if (!state) return "neutral";
  switch (state) {
    case "READY":
      return "success";
    case "NEEDS_INSPECTION":
      return "info";
    case "MAINTENANCE_REQUIRED":
    case "NOT_READY":
      return "warning";
    case "DECOMMISSIONED":
      return "danger";
    default:
      return "neutral";
  }
}

export function getReadinessBadgeClass(state: InventoryReadinessState | null): string {
  return toneToChipClass(getReadinessTone(state));
}

export function getReadinessLabel(state: InventoryReadinessState | null): string {
  if (!state) return "Readiness unknown";
  switch (state) {
    case "READY":
      return "Ready";
    case "NEEDS_INSPECTION":
      return "Needs inspection";
    case "MAINTENANCE_REQUIRED":
      return "Maintenance needed";
    case "NOT_READY":
      return "Not ready";
    case "DECOMMISSIONED":
      return "Decommissioned";
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Checkout status
// ---------------------------------------------------------------------------

export function getCheckoutTone(status: GearCheckoutStatus): LifecycleTone {
  switch (status) {
    case "OPEN":
      return "info";
    case "OVERDUE":
      return "warning";
    case "RETURNED":
      return "success";
    case "VOIDED":
      return "neutral";
    default:
      return "neutral";
  }
}

export function getCheckoutBadgeClass(status: GearCheckoutStatus): string {
  return toneToChipClass(getCheckoutTone(status));
}

export function getCheckoutLabel(status: GearCheckoutStatus): string {
  switch (status) {
    case "OPEN":
      return "Open";
    case "OVERDUE":
      return "Overdue";
    case "RETURNED":
      return "Returned";
    case "VOIDED":
      return "Voided";
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// Assignment status
// ---------------------------------------------------------------------------

export function getAssignmentTone(status: GearAssignmentStatus): LifecycleTone {
  switch (status) {
    case "PENDING":
      return "neutral";
    case "ACTIVE":
      return "info";
    case "OVERDUE":
      return "warning";
    case "RETURNED":
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "neutral";
    default:
      return "neutral";
  }
}

export function getAssignmentBadgeClass(status: GearAssignmentStatus): string {
  return toneToChipClass(getAssignmentTone(status));
}

export function getAssignmentLabel(status: GearAssignmentStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "ACTIVE":
      return "Active";
    case "OVERDUE":
      return "Overdue";
    case "RETURNED":
      return "Returned";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// Inventory type
// ---------------------------------------------------------------------------

export function getInventoryTypeLabel(type: GearInventoryType): string {
  return type === "CONSUMABLE" ? "Consumable" : "Durable";
}

export function getInventoryTypeBadgeClass(type: GearInventoryType): string {
  return type === "CONSUMABLE"
    ? "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
}

// ---------------------------------------------------------------------------
// Concern / exception signal derivation
// ---------------------------------------------------------------------------

export type GearConcernLevel = "critical" | "warning" | "info" | "ok";

/** Derive the single highest-priority concern level for an item summary. */
export function deriveItemConcernLevel({
  lifecycleStatus,
  conditionStatus,
  readinessState,
  quantityOnHand,
  quantityMin,
}: {
  lifecycleStatus: GearItemLifecycleStatus;
  conditionStatus: GearConditionStatus | null;
  readinessState: InventoryReadinessState | null;
  quantityOnHand: number;
  quantityMin: number | null;
}): GearConcernLevel {
  // Hard failures
  if (lifecycleStatus === "RETIRED" || lifecycleStatus === "LOST" || readinessState === "DECOMMISSIONED") {
    return "critical";
  }

  // Maintenance / quarantine
  if (
    lifecycleStatus === "QUARANTINED" ||
    lifecycleStatus === "MAINTENANCE" ||
    readinessState === "MAINTENANCE_REQUIRED" ||
    readinessState === "NOT_READY" ||
    conditionStatus === "DAMAGED" ||
    conditionStatus === "POOR"
  ) {
    return "warning";
  }

  // Low consumable stock
  if (quantityMin !== null && quantityOnHand <= quantityMin) {
    return "warning";
  }

  // Needs inspection
  if (readinessState === "NEEDS_INSPECTION") {
    return "info";
  }

  return "ok";
}

export function getConcernLevelChipClass(level: GearConcernLevel): string {
  switch (level) {
    case "critical":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
    case "warning":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
    case "info":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
    case "ok":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }
}

// ---------------------------------------------------------------------------
// Operator availability signal — one summary label for cage/field use
// ---------------------------------------------------------------------------

export type GearAvailabilitySignal =
  | "AVAILABLE"
  | "CHECKED_OUT"
  | "ASSIGNED"
  | "MAINTENANCE"
  | "UNAVAILABLE";

export function deriveAvailabilitySignal({
  lifecycleStatus,
  hasOpenCheckout,
  hasActiveAssignment,
}: {
  lifecycleStatus: GearItemLifecycleStatus;
  hasOpenCheckout: boolean;
  hasActiveAssignment: boolean;
}): GearAvailabilitySignal {
  if (
    lifecycleStatus === "MAINTENANCE" ||
    lifecycleStatus === "QUARANTINED" ||
    lifecycleStatus === "RETIRED" ||
    lifecycleStatus === "LOST"
  ) {
    return "MAINTENANCE";
  }

  if (hasOpenCheckout) return "CHECKED_OUT";
  if (hasActiveAssignment) return "ASSIGNED";
  if (lifecycleStatus === "RESERVED") return "ASSIGNED";
  if (lifecycleStatus === "ACTIVE") return "AVAILABLE";

  return "UNAVAILABLE";
}

export function getAvailabilitySignalLabel(signal: GearAvailabilitySignal): string {
  switch (signal) {
    case "AVAILABLE":
      return "Available";
    case "CHECKED_OUT":
      return "Checked out";
    case "ASSIGNED":
      return "Assigned";
    case "MAINTENANCE":
      return "Out of service";
    case "UNAVAILABLE":
      return "Unavailable";
  }
}

export function getAvailabilitySignalChipClass(signal: GearAvailabilitySignal): string {
  switch (signal) {
    case "AVAILABLE":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "CHECKED_OUT":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
    case "ASSIGNED":
      return "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200";
    case "MAINTENANCE":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
    case "UNAVAILABLE":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
  }
}

// ---------------------------------------------------------------------------
// Tone → CSS chip classes
// ---------------------------------------------------------------------------

export function toneToChipClass(tone: LifecycleTone): string {
  switch (tone) {
    case "success":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "warning":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
    case "danger":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
    case "info":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
    case "neutral":
      return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  }
}

/** Shared border variant for larger availability banners. */
export function toneToBoxClass(tone: LifecycleTone): string {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
    case "danger":
      return "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200";
    case "info":
      return "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200";
    case "neutral":
      return "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-200";
  }
}

// ---------------------------------------------------------------------------
// Dashboard summary concern classification
// ---------------------------------------------------------------------------

export type DashboardConcernSummary = {
  criticalCount: number;
  warningCount: number;
  readinessConcernCount: number;
  overallTone: LifecycleTone;
  overallLabel: string;
};

export function buildDashboardConcernSummary({
  maintenanceItems,
  conditionConcernItems,
  lowAvailabilityConsumables,
  readinessConcerns,
}: {
  maintenanceItems: number;
  conditionConcernItems: number;
  lowAvailabilityConsumables: number;
  readinessConcerns: number;
}): DashboardConcernSummary {
  const criticalCount = 0; // lifecycle critical (retired/lost) not exposed as standalone count yet
  const warningCount = maintenanceItems + conditionConcernItems + lowAvailabilityConsumables;
  const readinessConcernCount = readinessConcerns;

  let overallTone: LifecycleTone;
  let overallLabel: string;

  if (warningCount === 0 && readinessConcernCount === 0) {
    overallTone = "success";
    overallLabel = "All clear";
  } else if (warningCount >= 5) {
    overallTone = "warning";
    overallLabel = `${warningCount} items need attention`;
  } else if (warningCount > 0) {
    overallTone = "warning";
    overallLabel = `${warningCount} concern${warningCount === 1 ? "" : "s"}`;
  } else {
    overallTone = "info";
    overallLabel = `${readinessConcernCount} readiness concern${readinessConcernCount === 1 ? "" : "s"}`;
  }

  return {
    criticalCount,
    warningCount,
    readinessConcernCount,
    overallTone,
    overallLabel,
  };
}
