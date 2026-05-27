/**
 * Arc 20Y — GearOps Maintenance Scheduling
 *
 * Pure functions for maintenance interval calculation, due/overdue status
 * derivation, and notification handoff definitions.
 *
 * All functions operate on lightweight snapshots with no DB calls,
 * keeping computation fast and testable.
 *
 * Design boundaries:
 * - Does NOT build a full CMMS, work-order engine, or predictive maintenance
 *   platform.
 * - Does NOT perform vendor management, procurement, or warranty tracking.
 * - Does NOT deliver notifications (handoff types only).
 * - Interval types EVERY_N_DAYS, AFTER_N_USES, AFTER_N_DEPLOYMENTS require
 *   the corresponding config values to be set; if missing, falls back to
 *   NOT_SCHEDULED.
 */

import type { GearMaintenanceDueStatus, GearMaintenanceFrequency } from "@prisma/client";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Canonical day-interval mapping for legacy GearMaintenanceFrequency enum values. */
export const MAINTENANCE_FREQUENCY_DAYS: Record<GearMaintenanceFrequency, number | null> = {
  AS_NEEDED: null,
  MONTHLY: 30,
  QUARTERLY: 91,
  SEMI_ANNUAL: 182,
  ANNUAL: 365,
};

// ── Schedule config ───────────────────────────────────────────────────────────

/**
 * Category- or item-level maintenance schedule configuration.
 *
 * Supports four trigger modes:
 *   1. Date-based (intervalDays / maintenanceFrequency)
 *   2. Use-count-based (intervalUses)
 *   3. Deployment-count-based (intervalDeployments)
 *   4. Manual (no interval; staff sets nextMaintenanceDueAt directly)
 *
 * Multiple triggers can coexist; the most urgent wins in status calculation.
 */
export type GearMaintenanceScheduleConfig = {
  /** Legacy frequency enum for backward compatibility. */
  maintenanceFrequency: GearMaintenanceFrequency | null;
  /** Explicit day interval (takes precedence over maintenanceFrequency when set). */
  intervalDays: number | null;
  /** Use-count interval. */
  intervalUses: number | null;
  /** Deployment-count interval. */
  intervalDeployments: number | null;
  /** Days before due date when status becomes DUE_SOON (default: 14). */
  dueSoonDays: number;
};

// ── Item snapshot ─────────────────────────────────────────────────────────────

/** Lightweight projection of a GearItem used for maintenance due-status calculation. */
export type GearMaintenanceItemSnapshot = {
  id: string;
  name: string;
  nextMaintenanceDueAt: Date | null;
  maintenanceDueStatus: GearMaintenanceDueStatus;
  totalUseCount: number;
  totalDeploymentCount: number;
  /** True when the most recent maintenance log has isPostEventRecovery = true. */
  lastMaintenanceWasPostEvent: boolean;
};

// ── Due result ────────────────────────────────────────────────────────────────

export type GearMaintenanceDueResult = {
  itemId: string;
  itemName: string;
  status: GearMaintenanceDueStatus;
  nextMaintenanceDueAt: Date | null;
  /** True when the item is due or overdue. */
  actionRequired: boolean;
  /** True when the item is overdue. */
  isOverdue: boolean;
};

// ── Notification handoff types ────────────────────────────────────────────────

export type GearMaintenanceNotificationKind =
  | "MAINTENANCE_DUE"
  | "MAINTENANCE_OVERDUE"
  | "MAINTENANCE_COMPLETED"
  | "READINESS_BLOCKED_BY_MAINTENANCE";

export type GearMaintenanceNotificationHandoff = {
  kind: GearMaintenanceNotificationKind;
  organizationId: string;
  gearItemId: string;
  gearItemName: string;
  severity: "high" | "medium";
  occurredAt: string;
  payload: Record<string, string | number | boolean | null>;
};

// ── Core calculation functions ────────────────────────────────────────────────

/**
 * Resolve the effective day interval from a schedule config.
 *
 * Uses explicit `intervalDays` when set; falls back to `maintenanceFrequency`
 * day mapping; returns null when no day-based interval is configured.
 */
export function resolveMaintenanceIntervalDays(config: GearMaintenanceScheduleConfig): number | null {
  if (config.intervalDays && config.intervalDays > 0) {
    return config.intervalDays;
  }

  if (config.maintenanceFrequency) {
    return MAINTENANCE_FREQUENCY_DAYS[config.maintenanceFrequency] ?? null;
  }

  return null;
}

/**
 * Calculate the next maintenance due date based on a schedule config and
 * when the last maintenance was performed.
 *
 * Returns null when:
 * - no day-based interval is configured
 * - the interval is use- or deployment-count-based (no date returned)
 * - performedAt is null
 */
export function calculateNextMaintenanceDueDate(
  config: GearMaintenanceScheduleConfig,
  performedAt: Date | null,
): Date | null {
  if (!performedAt) {
    return null;
  }

  const days = resolveMaintenanceIntervalDays(config);

  if (!days) {
    return null;
  }

  return new Date(performedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Calculate the maintenance due status for a single gear item.
 *
 * When multiple interval types are configured (e.g. day-based AND use-based),
 * the most urgent status wins.
 *
 * Status precedence: OVERDUE > DUE > DUE_SOON > CURRENT > NOT_SCHEDULED
 */
export function calculateMaintenanceDueStatus(
  config: GearMaintenanceScheduleConfig,
  item: Pick<GearMaintenanceItemSnapshot, "nextMaintenanceDueAt" | "totalUseCount" | "totalDeploymentCount">,
  now = new Date(),
): GearMaintenanceDueStatus {
  const hasDateInterval = resolveMaintenanceIntervalDays(config) !== null;
  const hasUsesInterval = config.intervalUses !== null && config.intervalUses > 0;
  const hasDeploymentsInterval = config.intervalDeployments !== null && config.intervalDeployments > 0;

  if (!hasDateInterval && !hasUsesInterval && !hasDeploymentsInterval) {
    return "NOT_SCHEDULED";
  }

  let worst: GearMaintenanceDueStatus = "NOT_SCHEDULED";

  const rank: Record<GearMaintenanceDueStatus, number> = {
    NOT_SCHEDULED: 0,
    CURRENT: 1,
    DUE_SOON: 2,
    DUE: 3,
    OVERDUE: 4,
  };

  function update(candidate: GearMaintenanceDueStatus) {
    if (rank[candidate] > rank[worst]) {
      worst = candidate;
    }
  }

  // Date-based interval
  if (hasDateInterval) {
    const nextDue = item.nextMaintenanceDueAt;

    if (!nextDue) {
      // No next-due date recorded — assume due
      update("DUE");
    } else {
      const nowMs = now.getTime();
      const dueMs = nextDue.getTime();

      if (nowMs > dueMs) {
        update("OVERDUE");
      } else {
        const dueSoonThresholdMs = config.dueSoonDays * 24 * 60 * 60 * 1000;
        if (dueMs - nowMs <= dueSoonThresholdMs) {
          update("DUE_SOON");
        } else {
          update("CURRENT");
        }
      }
    }
  }

  // Use-count-based interval
  if (hasUsesInterval && config.intervalUses) {
    if (item.totalUseCount >= config.intervalUses) {
      update("OVERDUE");
    } else {
      const usesRemaining = config.intervalUses - item.totalUseCount;
      if (usesRemaining <= Math.ceil(config.intervalUses * 0.1)) {
        update("DUE_SOON");
      } else {
        update("CURRENT");
      }
    }
  }

  // Deployment-count-based interval
  if (hasDeploymentsInterval && config.intervalDeployments) {
    if (item.totalDeploymentCount >= config.intervalDeployments) {
      update("OVERDUE");
    } else {
      const deploymentsRemaining = config.intervalDeployments - item.totalDeploymentCount;
      if (deploymentsRemaining <= Math.ceil(config.intervalDeployments * 0.1)) {
        update("DUE_SOON");
      } else {
        update("CURRENT");
      }
    }
  }

  return worst;
}

/**
 * Build a complete GearMaintenanceDueResult from an item snapshot and config.
 */
export function buildMaintenanceDueResult(
  item: GearMaintenanceItemSnapshot,
  config: GearMaintenanceScheduleConfig,
  now = new Date(),
): GearMaintenanceDueResult {
  const status = calculateMaintenanceDueStatus(config, item, now);

  return {
    itemId: item.id,
    itemName: item.name,
    status,
    nextMaintenanceDueAt: item.nextMaintenanceDueAt,
    actionRequired: status === "DUE" || status === "OVERDUE",
    isOverdue: status === "OVERDUE",
  };
}

/** Returns true when maintenance status is DUE or OVERDUE. */
export function isMaintenanceActionRequired(status: GearMaintenanceDueStatus): boolean {
  return status === "DUE" || status === "OVERDUE";
}

/** Returns true when maintenance status is OVERDUE. */
export function isMaintenanceOverdue(status: GearMaintenanceDueStatus): boolean {
  return status === "OVERDUE";
}

/** Returns true when maintenance status is DUE_SOON. */
export function isMaintenanceDueSoon(status: GearMaintenanceDueStatus): boolean {
  return status === "DUE_SOON";
}

/**
 * Determine whether an overdue maintenance state should block availability.
 *
 * Defaults to warning (not blocking) when blockOnOverdue is false.
 */
export function shouldBlockByMaintenance(status: GearMaintenanceDueStatus, blockOnOverdue: boolean): boolean {
  if (!blockOnOverdue) {
    return false;
  }
  return status === "OVERDUE";
}

// ── Notification handoff helpers ──────────────────────────────────────────────

/**
 * Build a notification handoff definition for a maintenance event.
 *
 * Does NOT send notifications. The caller is responsible for routing the
 * handoff through a future communications module.
 */
export function buildMaintenanceNotificationHandoff(
  kind: GearMaintenanceNotificationKind,
  organizationId: string,
  gearItemId: string,
  gearItemName: string,
  extra: Record<string, string | number | boolean | null> = {},
  now = new Date(),
): GearMaintenanceNotificationHandoff {
  const severityMap: Record<GearMaintenanceNotificationKind, "high" | "medium"> = {
    MAINTENANCE_OVERDUE: "high",
    READINESS_BLOCKED_BY_MAINTENANCE: "high",
    MAINTENANCE_DUE: "medium",
    MAINTENANCE_COMPLETED: "medium",
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

/** Returns a human-readable label for a maintenance due status. */
export function formatMaintenanceDueStatus(status: GearMaintenanceDueStatus): string {
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

/** Returns Tailwind badge classes for a maintenance due status. */
export function getMaintenanceDueStatusBadgeClass(status: GearMaintenanceDueStatus): string {
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
