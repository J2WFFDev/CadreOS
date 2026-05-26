/**
 * Arc 19B — Unified Feed & Today View
 *
 * Query architecture for the operational feed service.
 *
 * Pure helpers (computeTodayWindow, computeUpcomingWindow, isOverdueEntry) are
 * exported for testing. Async DB functions are the runtime API.
 */

import { EntryStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { ACTIVE_FEED_STATUSES, ACTIVE_OPERATIONAL_TYPES, DEFAULT_UPCOMING_DAYS } from "./types";
import type {
  FeedActivityItem,
  FeedEntryItem,
  FeedQueryContext,
  OperationalFeedResult,
  TodayWindow,
  UpcomingWindow,
} from "./types";

// ── Pure window helpers ─────────────────────────────────────────────────────

/**
 * Computes UTC day boundaries for "today".
 * - todayStart: midnight UTC today
 * - tomorrowStart: midnight UTC tomorrow
 *
 * Entries with dueDate < tomorrowStart are overdue or due today.
 */
export function computeTodayWindow(now: Date): TodayWindow {
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return { todayStart, tomorrowStart };
}

/**
 * Computes the window for upcoming entries: tomorrow through tomorrow + days.
 * Entries with dueDate in [from, to) are in the upcoming window.
 */
export function computeUpcomingWindow(now: Date, days: number = DEFAULT_UPCOMING_DAYS): UpcomingWindow {
  const { tomorrowStart } = computeTodayWindow(now);
  const to = new Date(tomorrowStart.getTime() + days * 24 * 60 * 60 * 1000);
  return { from: tomorrowStart, to };
}

/**
 * Returns true if the entry's dueDate is strictly before today's UTC midnight.
 */
export function isOverdueEntry(dueDate: Date | null, now: Date): boolean {
  if (!dueDate) return false;
  const { todayStart } = computeTodayWindow(now);
  return dueDate.getTime() < todayStart.getTime();
}

// ── Shared select shape ─────────────────────────────────────────────────────

const FEED_ENTRY_SELECT = {
  id: true,
  type: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  dueTime: true,
  teamId: true,
  assignedToPersonId: true,
  createdAt: true,
} as const;

// ── DB query functions ──────────────────────────────────────────────────────

/**
 * Queries entries that are due today or overdue.
 * Covers TASK, FOLLOW_UP, and READINESS_ITEM entry types with active statuses.
 */
export async function queryTodayEntries(ctx: FeedQueryContext): Promise<FeedEntryItem[]> {
  const now = ctx.now ?? new Date();
  const { tomorrowStart } = computeTodayWindow(now);

  return db.entry.findMany({
    where: {
      organizationId: ctx.organizationId,
      type: { in: [...ACTIVE_OPERATIONAL_TYPES] },
      deletedAt: null,
      status: { in: [...ACTIVE_FEED_STATUSES] },
      dueDate: { lt: tomorrowStart },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    select: FEED_ENTRY_SELECT,
    take: 100,
  });
}

/**
 * Queries entries assigned to the actor person.
 * Uses both the scalar assignedToPersonId and the EntryAssignment join table
 * to surface entries from both the legacy single-assignee model and the
 * Arc 19A multi-assignee model.
 *
 * Returns an empty array when actorPersonId is null.
 */
export async function queryAssignedEntries(ctx: FeedQueryContext): Promise<FeedEntryItem[]> {
  if (!ctx.actorPersonId) return [];

  return db.entry.findMany({
    where: {
      organizationId: ctx.organizationId,
      deletedAt: null,
      status: { in: [...ACTIVE_FEED_STATUSES] },
      OR: [
        { assignedToPersonId: ctx.actorPersonId },
        {
          assignments: {
            some: {
              personId: ctx.actorPersonId,
              revokedAt: null,
            },
          },
        },
      ],
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    select: FEED_ENTRY_SELECT,
    take: 50,
  });
}

/**
 * Queries entries with due dates in the upcoming window (tomorrow through N days).
 * Covers TASK, FOLLOW_UP, and READINESS_ITEM entry types.
 */
export async function queryUpcomingEntries(ctx: FeedQueryContext): Promise<FeedEntryItem[]> {
  const now = ctx.now ?? new Date();
  const { from, to } = computeUpcomingWindow(now, ctx.upcomingDays);

  return db.entry.findMany({
    where: {
      organizationId: ctx.organizationId,
      type: { in: [...ACTIVE_OPERATIONAL_TYPES] },
      deletedAt: null,
      status: { in: [EntryStatus.OPEN, EntryStatus.IN_PROGRESS] },
      dueDate: { gte: from, lt: to },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    select: FEED_ENTRY_SELECT,
    take: 100,
  });
}

/**
 * Queries the most recent EntryActivity records for the organization.
 * Includes a resolved entry title for display.
 */
export async function queryRecentActivity(
  ctx: Pick<FeedQueryContext, "organizationId">,
  limit = 20,
): Promise<FeedActivityItem[]> {
  const activities = await db.entryActivity.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      entryId: true,
      action: true,
      actorPersonId: true,
      createdAt: true,
      entry: { select: { title: true } },
    },
    take: limit,
  });

  return activities.map((a) => ({
    id: a.id,
    entryId: a.entryId,
    entryTitle: a.entry.title,
    action: a.action,
    actorPersonId: a.actorPersonId,
    createdAt: a.createdAt,
  }));
}

/**
 * Aggregates the full operational feed for an organization and actor.
 * Runs all four queries in parallel for efficiency.
 */
export async function aggregateOperationalFeed(ctx: FeedQueryContext): Promise<OperationalFeedResult> {
  const [today, assigned, upcoming, recentActivity] = await Promise.all([
    queryTodayEntries(ctx),
    queryAssignedEntries(ctx),
    queryUpcomingEntries(ctx),
    queryRecentActivity(ctx),
  ]);

  return { today, assigned, upcoming, recentActivity };
}
