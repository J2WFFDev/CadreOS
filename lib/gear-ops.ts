import type { GearConditionStatus, GearItemLifecycleStatus, InventoryReadinessState } from "@prisma/client";

export function formatGearOpsEnum(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatGearOpsDateTime(value: Date | null) {
  if (!value) {
    return "—";
  }

  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export function getGearConditionBadgeClass(status: GearConditionStatus | null) {
  if (!status) {
    return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  }

  if (status === "NEW" || status === "GOOD") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  if (status === "FAIR") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
  }

  if (status === "POOR" || status === "DAMAGED") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }

  return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
}

export function getGearLifecycleBadgeClass(status: GearItemLifecycleStatus) {
  if (status === "ACTIVE") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  if (status === "RETIRED" || status === "LOST") {
    return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
  }

  if (status === "MAINTENANCE" || status === "QUARANTINED") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }

  if (status === "RESERVED") {
    return "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200";
  }

  return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
}

export function getReadinessBadgeClass(state: InventoryReadinessState | null) {
  if (!state) {
    return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  }

  if (state === "READY") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  if (state === "DECOMMISSIONED") {
    return "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200";
  }

  if (state === "MAINTENANCE_REQUIRED" || state === "NOT_READY") {
    return "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
  }

  return "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
}
