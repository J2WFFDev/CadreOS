/**
 * Arc 22F — Assigned Work, Filters, Today/Upcoming, and Role-Aware Views
 *
 * Pure filter-building helpers for the operational entry list.
 * These functions have no DB or React dependencies and are fully testable.
 */

import type { EntryPriority, EntryStatus, EntryType } from "@prisma/client";

import { computeTodayWindow, computeUpcomingWindow } from "./queries";

// ── Validated filter param types ────────────────────────────────────────────

/** Recognised due-window filter values for entry list views. */
export type DueWindowFilter = "all" | "overdue" | "today" | "upcoming" | "no_date";

/** Recognised sort options for entry list views. */
export type EntrySortParam = "updated_desc" | "due_asc" | "created_desc" | "priority_desc";

/** Parsed, sanitised filter state for the entry list page. */
export type EntryListFilterState = {
  type: EntryType | undefined;
  status: EntryStatus | undefined;
  priority: EntryPriority | undefined;
  /** Resolved person ID — the caller must replace "me" with the actor's personId before passing here. */
  assigneePersonId: string | undefined;
  dueWindow: DueWindowFilter;
  sort: EntrySortParam;
};

// ── Validation helpers ───────────────────────────────────────────────────────

const VALID_DUE_WINDOWS = new Set<DueWindowFilter>(["all", "overdue", "today", "upcoming", "no_date"]);
const VALID_SORT_PARAMS = new Set<EntrySortParam>(["updated_desc", "due_asc", "created_desc", "priority_desc"]);

function isValidDueWindow(value: string): value is DueWindowFilter {
  return VALID_DUE_WINDOWS.has(value as DueWindowFilter);
}

function isValidSortParam(value: string): value is EntrySortParam {
  return VALID_SORT_PARAMS.has(value as EntrySortParam);
}

/**
 * Parses and sanitises raw URL search params into a typed EntryListFilterState.
 *
 * - Unknown enum values are dropped (return undefined / defaults).
 * - The special assigneePersonId value `"me"` must be resolved to an actual
 *   personId by the caller before the filter state is used for DB queries.
 */
export function parseEntryListFilter(
  params: Record<string, string>,
  validTypes: readonly string[],
  validStatuses: readonly string[],
  validPriorities: readonly string[],
): EntryListFilterState {
  const typeRaw = (params.type ?? "").toUpperCase();
  const statusRaw = (params.status ?? "").toUpperCase();
  const priorityRaw = (params.priority ?? "").toUpperCase();
  const dueWindowRaw = params.dueWindow ?? "all";
  const sortRaw = params.sort ?? "updated_desc";

  return {
    type: validTypes.includes(typeRaw) ? (typeRaw as EntryType) : undefined,
    status: validStatuses.includes(statusRaw) ? (statusRaw as EntryStatus) : undefined,
    priority: validPriorities.includes(priorityRaw) ? (priorityRaw as EntryPriority) : undefined,
    assigneePersonId: params.assigneePersonId || undefined,
    dueWindow: isValidDueWindow(dueWindowRaw) ? dueWindowRaw : "all",
    sort: isValidSortParam(sortRaw) ? sortRaw : "updated_desc",
  };
}

// ── Due window WHERE fragment ────────────────────────────────────────────────

/**
 * Builds a Prisma-compatible WHERE fragment for dueDate filtering.
 *
 * Returns `null` for the "all" window (no date restriction needed).
 * Returns an object with the appropriate `dueDate` constraint otherwise.
 */
export function buildDueWindowWhere(
  dueWindow: DueWindowFilter,
  now: Date,
): { dueDate: object } | { dueDate: null } | null {
  if (dueWindow === "all") return null;

  if (dueWindow === "no_date") {
    return { dueDate: null };
  }

  const { todayStart, tomorrowStart } = computeTodayWindow(now);

  if (dueWindow === "overdue") {
    return { dueDate: { lt: todayStart } };
  }

  if (dueWindow === "today") {
    return { dueDate: { gte: todayStart, lt: tomorrowStart } };
  }

  // "upcoming" — tomorrow through the default 14-day window
  const { from, to } = computeUpcomingWindow(now);
  return { dueDate: { gte: from, lt: to } };
}

// ── Sort orderBy fragment ────────────────────────────────────────────────────

/**
 * Builds a Prisma-compatible orderBy array from an EntrySortParam.
 */
export function buildEntryOrderBy(
  sort: EntrySortParam,
): Array<Record<string, "asc" | "desc">> {
  switch (sort) {
    case "due_asc":
      return [{ dueDate: "asc" }, { priority: "desc" }, { updatedAt: "desc" }];
    case "created_desc":
      return [{ createdAt: "desc" }];
    case "priority_desc":
      return [{ priority: "desc" }, { dueDate: "asc" }, { updatedAt: "desc" }];
    case "updated_desc":
    default:
      return [{ updatedAt: "desc" }];
  }
}
