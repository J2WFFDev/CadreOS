/**
 * Arc 20Y — GearOps Inspection Scheduling
 *
 * Pure functions for inspection interval calculation, due/overdue status
 * derivation, checklist types, notification handoff definitions, and
 * pre/post-event inspection helpers.
 *
 * All functions operate on lightweight snapshots with no DB calls,
 * keeping computation fast and testable.
 *
 * Design boundaries:
 * - Does NOT build a full CMMS or predictive inspection engine.
 * - Does NOT perform notification delivery.
 * - Does NOT finalize readiness/availability changes directly (those are
 *   server-confirmed DB mutations in route handlers).
 * - Interval types EVERY_N_DAYS, AFTER_N_USES, AFTER_N_DEPLOYMENTS require
 *   the corresponding config values (intervalDays, intervalUses,
 *   intervalDeployments) to be set; if missing, the result falls back to
 *   NOT_SCHEDULED.
 * - EVERY_USE, BEFORE_EVENT, and AFTER_EVENT are date-agnostic — due status
 *   is derived from context signals, not a next-due date.
 * - MANUAL_DATE relies entirely on nextInspectionDueAt being set externally.
 */

import type {
  GearInspectionContext,
  GearInspectionDueStatus,
  GearInspectionIntervalType,
  GearItemInspectionResult,
} from "@prisma/client";

// ── Constants ─────────────────────────────────────────────────────────────────

export const INSPECTION_FREQUENCY_DAYS: Record<string, number> = {
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 91,
  ANNUALLY: 365,
};

// ── Schedule config ───────────────────────────────────────────────────────────

/** Category- or item-level inspection schedule configuration. */
export type GearInspectionScheduleConfig = {
  intervalType: GearInspectionIntervalType | null;
  /** Used when intervalType = EVERY_N_DAYS (or WEEKLY/MONTHLY/QUARTERLY/ANNUALLY). */
  intervalDays: number | null;
  /** Used when intervalType = AFTER_N_USES. */
  intervalUses: number | null;
  /** Used when intervalType = AFTER_N_DEPLOYMENTS. */
  intervalDeployments: number | null;
  /** Days before due date when status becomes DUE_SOON (default: 14). */
  dueSoonDays: number;
  requiresPreEventInspection: boolean;
  requiresPostEventInspection: boolean;
};

// ── Item snapshot ─────────────────────────────────────────────────────────────

/** Lightweight projection of a GearItem used for due-status calculation. */
export type GearInspectionItemSnapshot = {
  id: string;
  name: string;
  lastInspectedAt: Date | null;
  lastInspectionResult: GearItemInspectionResult | null;
  nextInspectionDueAt: Date | null;
  inspectionDueStatus: GearInspectionDueStatus;
  totalUseCount: number;
  totalDeploymentCount: number;
};

// ── Due result ────────────────────────────────────────────────────────────────

export type GearInspectionDueResult = {
  itemId: string;
  itemName: string;
  status: GearInspectionDueStatus;
  nextInspectionDueAt: Date | null;
  /** True when the item is due or overdue. */
  actionRequired: boolean;
  /** True when the item is overdue. */
  isOverdue: boolean;
  /** True when the last inspection failed or needs maintenance. */
  lastInspectionFailed: boolean;
};

// ── Checklist types ───────────────────────────────────────────────────────────

export type GearInspectionChecklistItemResult = "pass" | "fail" | "na";

export type GearInspectionChecklistEntry = {
  key: string;
  label: string;
  result: GearInspectionChecklistItemResult | null;
  note: string | null;
};

export type GearInspectionChecklist = {
  items: GearInspectionChecklistEntry[];
  overallPassed: boolean;
  failedCount: number;
  naCount: number;
  passedCount: number;
};

// ── Notification handoff types ────────────────────────────────────────────────

export type GearInspectionNotificationKind =
  | "INSPECTION_DUE"
  | "INSPECTION_OVERDUE"
  | "INSPECTION_FAILED"
  | "READINESS_BLOCKED_BY_INSPECTION"
  | "EVENT_GEAR_INSPECTION_ISSUE"
  | "KIT_COMPONENT_INSPECTION_ISSUE";

export type GearInspectionNotificationHandoff = {
  kind: GearInspectionNotificationKind;
  organizationId: string;
  gearItemId: string;
  gearItemName: string;
  severity: "high" | "medium";
  /** ISO string for the notification handoff timestamp. */
  occurredAt: string;
  payload: Record<string, string | number | boolean | null>;
};

// ── Core calculation functions ────────────────────────────────────────────────

/**
 * Calculate the next inspection due date based on the schedule config and
 * when the last inspection was performed.
 *
 * Returns null when:
 * - no intervalType is configured
 * - the intervalType is EVERY_USE, BEFORE_EVENT, AFTER_EVENT (context-driven)
 * - required interval values are missing
 * - performedAt is null and no use/deployment counts are provided
 */
export function calculateNextInspectionDueDate(
  config: GearInspectionScheduleConfig,
  performedAt: Date | null,
): Date | null {
  if (!config.intervalType) {
    return null;
  }

  // Context-driven intervals — no fixed next-due date
  if (
    config.intervalType === "EVERY_USE" ||
    config.intervalType === "BEFORE_EVENT" ||
    config.intervalType === "AFTER_EVENT"
  ) {
    return null;
  }

  // MANUAL_DATE — caller manages the date externally
  if (config.intervalType === "MANUAL_DATE") {
    return null;
  }

  // Use-count-based interval
  if (config.intervalType === "AFTER_N_USES") {
    if (!config.intervalUses || config.intervalUses <= 0) {
      return null;
    }
    // Due at next threshold crossing; returns null (tracked via use count comparison)
    return null;
  }

  // Deployment-count-based interval
  if (config.intervalType === "AFTER_N_DEPLOYMENTS") {
    if (!config.intervalDeployments || config.intervalDeployments <= 0) {
      return null;
    }
    return null;
  }

  if (!performedAt) {
    return null;
  }

  let days: number | null = null;

  if (config.intervalType === "EVERY_N_DAYS") {
    days = config.intervalDays && config.intervalDays > 0 ? config.intervalDays : null;
  } else {
    days = INSPECTION_FREQUENCY_DAYS[config.intervalType] ?? null;
  }

  if (!days) {
    return null;
  }

  const nextDue = new Date(performedAt.getTime() + days * 24 * 60 * 60 * 1000);
  return nextDue;
}

/**
 * Calculate the inspection due status for a single gear item.
 *
 * Status precedence:
 * 1. NOT_SCHEDULED — no interval configured or interval requires missing config
 * 2. OVERDUE — past nextInspectionDueAt, or use/deployment count exceeded
 * 3. DUE — at or past nextInspectionDueAt (within same day), same day threshold
 * 4. DUE_SOON — within dueSoonDays of nextInspectionDueAt
 * 5. CURRENT — inspection is up to date
 *
 * For context-driven intervals (EVERY_USE, BEFORE_EVENT, AFTER_EVENT) this
 * function returns NOT_SCHEDULED unless the caller supplies contextSignal.
 */
export function calculateInspectionDueStatus(
  config: GearInspectionScheduleConfig,
  item: Pick<
    GearInspectionItemSnapshot,
    "nextInspectionDueAt" | "totalUseCount" | "totalDeploymentCount" | "lastInspectedAt"
  >,
  now = new Date(),
): GearInspectionDueStatus {
  if (!config.intervalType) {
    return "NOT_SCHEDULED";
  }

  // Count-based: use totalUseCount vs. intervalUses
  if (config.intervalType === "AFTER_N_USES") {
    if (!config.intervalUses || config.intervalUses <= 0) {
      return "NOT_SCHEDULED";
    }
    if (item.totalUseCount >= config.intervalUses) {
      return "OVERDUE";
    }
    const usesRemaining = config.intervalUses - item.totalUseCount;
    return usesRemaining <= Math.ceil(config.intervalUses * 0.1) ? "DUE_SOON" : "CURRENT";
  }

  if (config.intervalType === "AFTER_N_DEPLOYMENTS") {
    if (!config.intervalDeployments || config.intervalDeployments <= 0) {
      return "NOT_SCHEDULED";
    }
    if (item.totalDeploymentCount >= config.intervalDeployments) {
      return "OVERDUE";
    }
    const deploymentsRemaining = config.intervalDeployments - item.totalDeploymentCount;
    return deploymentsRemaining <= Math.ceil(config.intervalDeployments * 0.1) ? "DUE_SOON" : "CURRENT";
  }

  // Context-driven — due status is asserted externally (pre/post-event check flows)
  if (
    config.intervalType === "EVERY_USE" ||
    config.intervalType === "BEFORE_EVENT" ||
    config.intervalType === "AFTER_EVENT"
  ) {
    return "NOT_SCHEDULED";
  }

  // Date-based intervals (including MANUAL_DATE, EVERY_N_DAYS, WEEKLY, MONTHLY, etc.)
  const nextDue = item.nextInspectionDueAt;

  if (!nextDue) {
    // For date-based intervals without a next-due date, treat as never inspected
    if (!item.lastInspectedAt && config.intervalType !== "MANUAL_DATE") {
      return "DUE";
    }
    return "NOT_SCHEDULED";
  }

  const nowMs = now.getTime();
  const dueMs = nextDue.getTime();

  if (nowMs > dueMs) {
    return "OVERDUE";
  }

  const dueSoonThresholdMs = config.dueSoonDays * 24 * 60 * 60 * 1000;
  if (dueMs - nowMs <= dueSoonThresholdMs) {
    return "DUE_SOON";
  }

  return "CURRENT";
}

/**
 * Build a complete GearInspectionDueResult from an item snapshot and config.
 */
export function buildInspectionDueResult(
  item: GearInspectionItemSnapshot,
  config: GearInspectionScheduleConfig,
  now = new Date(),
): GearInspectionDueResult {
  const status = calculateInspectionDueStatus(config, item, now);

  return {
    itemId: item.id,
    itemName: item.name,
    status,
    nextInspectionDueAt: item.nextInspectionDueAt,
    actionRequired: status === "DUE" || status === "OVERDUE",
    isOverdue: status === "OVERDUE",
    lastInspectionFailed:
      item.lastInspectionResult === "FAILED" ||
      item.lastInspectionResult === "MAINTENANCE_NEEDED" ||
      item.lastInspectionResult === "OUT_OF_SERVICE",
  };
}

/** Returns true when inspection status is DUE or OVERDUE. */
export function isInspectionActionRequired(status: GearInspectionDueStatus): boolean {
  return status === "DUE" || status === "OVERDUE";
}

/** Returns true when inspection status is OVERDUE. */
export function isInspectionOverdue(status: GearInspectionDueStatus): boolean {
  return status === "OVERDUE";
}

/** Returns true when inspection status is DUE_SOON. */
export function isInspectionDueSoon(status: GearInspectionDueStatus): boolean {
  return status === "DUE_SOON";
}

/**
 * Determine whether an overdue/due inspection should block availability,
 * based on a per-category blocking rule.
 *
 * Defaults to warning (not blocking) when blockOnOverdue is false.
 */
export function shouldBlockByInspection(status: GearInspectionDueStatus, blockOnOverdue: boolean): boolean {
  if (!blockOnOverdue) {
    return false;
  }
  return status === "OVERDUE";
}

/**
 * Returns true when an inspection result indicates the item requires follow-up
 * action (maintenance needed or out of service).
 */
export function isFailedInspectionResult(result: GearItemInspectionResult | null): boolean {
  return result === "FAILED" || result === "MAINTENANCE_NEEDED" || result === "OUT_OF_SERVICE";
}

// ── Checklist helpers ─────────────────────────────────────────────────────────

/**
 * Build a default lightweight inspection checklist for a category template slug.
 * Returns an empty checklist for unknown slugs.
 *
 * These are starting-point suggestions — operators may add notes to any item.
 */
export function buildDefaultChecklistItems(templateSlug: string | null): GearInspectionChecklistEntry[] {
  const base: GearInspectionChecklistEntry[] = [
    { key: "visual_condition", label: "Visual condition check", result: null, note: null },
    { key: "functional_test", label: "Functional test", result: null, note: null },
    { key: "storage_secure", label: "Stored securely / no damage", result: null, note: null },
  ];

  if (templateSlug === "firearm") {
    return [
      { key: "safe_direction", label: "Verified safe direction and unloaded", result: null, note: null },
      { key: "bore_clear", label: "Bore clear", result: null, note: null },
      { key: "action_function", label: "Action function check", result: null, note: null },
      { key: "sights_secure", label: "Sights secure and aligned", result: null, note: null },
      { key: "serial_visible", label: "Serial number visible", result: null, note: null },
      { key: "storage_secure", label: "Stored securely", result: null, note: null },
    ];
  }

  if (templateSlug === "radio") {
    return [
      { key: "power_on", label: "Powers on", result: null, note: null },
      { key: "channel_check", label: "Channel selection functional", result: null, note: null },
      { key: "battery_level", label: "Battery level acceptable", result: null, note: null },
      { key: "antenna_secure", label: "Antenna secure", result: null, note: null },
      { key: "case_intact", label: "Case / housing intact", result: null, note: null },
    ];
  }

  if (templateSlug === "first-aid-kit") {
    return [
      { key: "seals_intact", label: "Kit seals intact / not tampered", result: null, note: null },
      { key: "contents_complete", label: "Contents complete per manifest", result: null, note: null },
      { key: "expiration_check", label: "No expired items", result: null, note: null },
      { key: "container_intact", label: "Container intact and waterproof", result: null, note: null },
    ];
  }

  if (templateSlug === "tablet-electronic") {
    return [
      { key: "power_on", label: "Powers on", result: null, note: null },
      { key: "screen_intact", label: "Screen intact", result: null, note: null },
      { key: "charge_level", label: "Charge level acceptable", result: null, note: null },
      { key: "case_intact", label: "Protective case intact", result: null, note: null },
    ];
  }

  return base;
}

/**
 * Evaluate checklist items and return a summary.
 */
export function evaluateChecklist(items: GearInspectionChecklistEntry[]): GearInspectionChecklist {
  let failedCount = 0;
  let naCount = 0;
  let passedCount = 0;

  for (const item of items) {
    if (item.result === "fail") {
      failedCount += 1;
    } else if (item.result === "na") {
      naCount += 1;
    } else if (item.result === "pass") {
      passedCount += 1;
    }
  }

  return {
    items,
    overallPassed: failedCount === 0 && passedCount > 0,
    failedCount,
    naCount,
    passedCount,
  };
}

// ── Pre/post-event check helpers ──────────────────────────────────────────────

export type PreEventInspectionGap = {
  gearItemId: string;
  gearItemName: string;
  reason: "INSPECTION_OVERDUE" | "INSPECTION_DUE" | "LAST_FAILED" | "PRE_EVENT_REQUIRED";
  severity: "high" | "medium";
};

export type PostEventRecoveryFlag = {
  gearItemId: string;
  gearItemName: string;
  reason:
    | "MAINTENANCE_FLAG_SET"
    | "CONDITION_DEGRADED"
    | "POST_EVENT_INSPECTION_REQUIRED"
    | "FAILED_POST_EVENT_INSPECTION";
  severity: "high" | "medium";
};

/**
 * Build pre-event inspection gaps for a list of gear item snapshots.
 *
 * Returns items that require attention before an event:
 * - Overdue or due inspection
 * - Last inspection failed
 * - Category requires pre-event inspection and item has never been inspected
 */
export function buildPreEventInspectionGaps(
  items: Array<GearInspectionItemSnapshot & { categoryRequiresPreEvent: boolean }>,
): PreEventInspectionGap[] {
  const gaps: PreEventInspectionGap[] = [];

  for (const item of items) {
    if (item.inspectionDueStatus === "OVERDUE") {
      gaps.push({
        gearItemId: item.id,
        gearItemName: item.name,
        reason: "INSPECTION_OVERDUE",
        severity: "high",
      });
      continue;
    }

    if (item.inspectionDueStatus === "DUE") {
      gaps.push({
        gearItemId: item.id,
        gearItemName: item.name,
        reason: "INSPECTION_DUE",
        severity: "medium",
      });
      continue;
    }

    if (isFailedInspectionResult(item.lastInspectionResult)) {
      gaps.push({
        gearItemId: item.id,
        gearItemName: item.name,
        reason: "LAST_FAILED",
        severity: "high",
      });
      continue;
    }

    if (item.categoryRequiresPreEvent && !item.lastInspectedAt) {
      gaps.push({
        gearItemId: item.id,
        gearItemName: item.name,
        reason: "PRE_EVENT_REQUIRED",
        severity: "medium",
      });
    }
  }

  return gaps;
}

// ── Notification handoff helpers ──────────────────────────────────────────────

/**
 * Build a notification handoff definition for an inspection event.
 *
 * Does NOT send notifications. The caller is responsible for persisting or
 * routing the handoff through a future communications module.
 */
export function buildInspectionNotificationHandoff(
  kind: GearInspectionNotificationKind,
  organizationId: string,
  gearItemId: string,
  gearItemName: string,
  extra: Record<string, string | number | boolean | null> = {},
  now = new Date(),
): GearInspectionNotificationHandoff {
  const severityMap: Record<GearInspectionNotificationKind, "high" | "medium"> = {
    INSPECTION_OVERDUE: "high",
    INSPECTION_FAILED: "high",
    READINESS_BLOCKED_BY_INSPECTION: "high",
    INSPECTION_DUE: "medium",
    EVENT_GEAR_INSPECTION_ISSUE: "high",
    KIT_COMPONENT_INSPECTION_ISSUE: "medium",
  };

  return {
    kind,
    organizationId,
    gearItemId,
    gearItemName,
    severity: severityMap[kind],
    occurredAt: now.toISOString(),
    payload: {
      gearItemId,
      gearItemName,
      ...extra,
    },
  };
}

// ── Badge/UI helpers ──────────────────────────────────────────────────────────

/** Returns a human-readable label for an inspection due status. */
export function formatInspectionDueStatus(status: GearInspectionDueStatus): string {
  switch (status) {
    case "NOT_SCHEDULED":
      return "Not scheduled";
    case "CURRENT":
      return "Current";
    case "DUE_SOON":
      return "Due soon";
    case "DUE":
      return "Due";
    case "OVERDUE":
      return "Overdue";
    default:
      return status;
  }
}

/** Returns Tailwind badge classes for an inspection due status. */
export function getInspectionDueStatusBadgeClass(status: GearInspectionDueStatus): string {
  switch (status) {
    case "NOT_SCHEDULED":
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
    case "CURRENT":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "DUE_SOON":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
    case "DUE":
      return "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200";
    case "OVERDUE":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

/** Returns a human-readable label for an inspection result. */
export function formatInspectionResult(result: GearItemInspectionResult): string {
  switch (result) {
    case "PASSED":
      return "Passed";
    case "PASSED_WITH_NOTES":
      return "Passed with notes";
    case "FAILED":
      return "Failed";
    case "MAINTENANCE_NEEDED":
      return "Maintenance needed";
    case "OUT_OF_SERVICE":
      return "Out of service";
    case "LIMITED_USE":
      return "Limited use";
    default:
      return result;
  }
}

/** Returns Tailwind badge classes for an inspection result. */
export function getInspectionResultBadgeClass(result: GearItemInspectionResult): string {
  switch (result) {
    case "PASSED":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "PASSED_WITH_NOTES":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
    case "FAILED":
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
    case "MAINTENANCE_NEEDED":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
    case "OUT_OF_SERVICE":
      return "bg-rose-200 text-rose-900 dark:bg-rose-950/60 dark:text-rose-100";
    case "LIMITED_USE":
      return "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200";
    default:
      return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

/** Returns a human-readable label for an inspection context. */
export function formatInspectionContext(context: GearInspectionContext): string {
  switch (context) {
    case "ROUTINE":
      return "Routine";
    case "PRE_EVENT":
      return "Pre-event";
    case "POST_EVENT":
      return "Post-event";
    case "PERIODIC":
      return "Periodic";
    case "RETURN_INSPECTION":
      return "Return inspection";
    case "CONDITION_CHECK":
      return "Condition check";
    default:
      return context;
  }
}
