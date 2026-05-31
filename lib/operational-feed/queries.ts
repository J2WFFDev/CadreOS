/**
 * Arc 19B — Unified Feed & Today View
 *
 * Query architecture for the operational feed service.
 *
 * Pure helpers (computeTodayWindow, computeUpcomingWindow, isOverdueEntry) are
 * exported for testing. Async DB functions are the runtime API.
 */

import { EntryStatus, EntryType, HabitStatus, InboxItemStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { deriveSafeHabitActivityText, isHabitActionableToday } from "@/lib/habits/policy";
import { deriveSafeJournalActivityText } from "@/lib/journals/policy";
import { ACTIVE_FEED_STATUSES, ACTIVE_OPERATIONAL_TYPES, DEFAULT_UPCOMING_DAYS } from "./types";
import type {
  ActionableHabitItem,
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
  assignedTo: { select: { firstName: true, lastName: true } },
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
      type: { not: EntryType.JOURNAL },
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
 * Queries open inbox-routed entries created through quick capture when they do
 * not yet have richer operational context.
 */
export async function queryInboxEntries(ctx: FeedQueryContext): Promise<FeedEntryItem[]> {
  const inboxItems = await db.inboxRoutingItem.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: InboxItemStatus.OPEN,
      subjectRefType: "ENTRY",
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: { subjectRefId: true },
    take: 100,
  });

  const entryIds = Array.from(new Set(inboxItems.map((item) => item.subjectRefId)));
  if (entryIds.length === 0) return [];

  const entries = await db.entry.findMany({
    where: {
      organizationId: ctx.organizationId,
      id: { in: entryIds },
      deletedAt: null,
      type: { not: EntryType.JOURNAL },
      status: { in: [...ACTIVE_FEED_STATUSES] },
    },
    orderBy: [{ updatedAt: "desc" }],
    select: FEED_ENTRY_SELECT,
  });

  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  return entryIds.map((entryId) => entriesById.get(entryId)).filter((entry): entry is FeedEntryItem => Boolean(entry));
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
    where: {
      organizationId: ctx.organizationId,
      entry: { deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      entryId: true,
      action: true,
      actorPersonId: true,
      createdAt: true,
      entry: { select: { title: true, type: true } },
    },
    take: limit,
  });

  return activities.map((a) => ({
    id: a.id,
    entryId: a.entryId,
    entryTitle: sanitizeActivityEntryTitle(a.action, a.entry.type, a.entry.title),
    entryType: a.entry.type,
    action: a.action,
    actorPersonId: a.actorPersonId,
    createdAt: a.createdAt,
  }));
}

/**
 * Arc 24D.8: Queries the most recent HabitActivity records for the organization.
 * Maps habitId onto the entryId field (with entryType: "HABIT") for unified
 * rendering through the existing FeedActivityItem pipeline.
 */
export async function queryRecentHabitActivity(
  ctx: Pick<FeedQueryContext, "organizationId">,
  limit = 20,
): Promise<FeedActivityItem[]> {
  const activities = await db.habitActivity.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      habitId: true,
      action: true,
      actorPersonId: true,
      createdAt: true,
      habit: { select: { title: true } },
    },
    take: limit,
  });

  return activities.map((a) => ({
    id: a.id,
    entryId: a.habitId,
    entryTitle: deriveSafeHabitActivityText(a.action, a.habit.title),
    entryType: "HABIT" as const,
    action: a.action,
    actorPersonId: a.actorPersonId,
    createdAt: a.createdAt,
  }));
}

/**
 * Arc 24D.8: Queries ACTIVE habits for the organization and filters them to
 * those that are actionable today (per isHabitActionableToday). Also marks
 * whether the habit has already been checked in today.
 */
export async function queryActionableHabitsToday(ctx: FeedQueryContext): Promise<ActionableHabitItem[]> {
  const now = ctx.now ?? new Date();
  const { todayStart, tomorrowStart } = computeTodayWindow(now);

  const habits = await db.habit.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: HabitStatus.ACTIVE,
    },
    select: {
      id: true,
      title: true,
      trackingMode: true,
      targetCount: true,
      targetUnit: true,
      schedules: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          frequency: true,
          daysOfWeek: true,
          startDate: true,
          endDate: true,
        },
      },
      completions: {
        where: {
          completedOn: { gte: todayStart, lt: tomorrowStart },
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  const result: ActionableHabitItem[] = [];
  for (const habit of habits) {
    const schedule = habit.schedules[0] ?? null;
    const actionable = isHabitActionableToday(
      {
        status: HabitStatus.ACTIVE,
        scheduleFrequency: schedule?.frequency ?? null,
        scheduleDaysOfWeek: schedule?.daysOfWeek ?? null,
        scheduleStartDate: schedule?.startDate ?? null,
        scheduleEndDate: schedule?.endDate ?? null,
        todayDate: now,
      },
    );
    if (!actionable) continue;

    result.push({
      id: habit.id,
      title: habit.title,
      frequency: schedule?.frequency ?? null,
      trackingMode: habit.trackingMode ?? null,
      targetCount: habit.targetCount,
      targetUnit: habit.targetUnit,
      completedToday: habit.completions.length > 0,
    });
  }

  return result;
}

/**
 * Sanitizes activity title text for feed rendering.
 * Journal entries are always replaced with safe generic labels so sensitive
 * journal body/title content never leaks into broad activity surfaces.
 * Habit entries are also sanitized as a defensive guard — habit titles should
 * not appear as raw entry titles in the broad activity feed.
 */
export function sanitizeActivityEntryTitle(action: string, entryType: EntryType, entryTitle: string): string {
  if (entryType === EntryType.JOURNAL) {
    return deriveSafeJournalActivityText(action);
  }

  if (entryType === EntryType.HABIT) {
    return deriveSafeHabitActivityText(action);
  }

  return entryTitle;
}

/**
 * Aggregates the full operational feed for an organization and actor.
 * Runs all queries in parallel for efficiency.
 * Arc 24D.8: Also includes habit activity and actionable habits today.
 */
export async function aggregateOperationalFeed(ctx: FeedQueryContext): Promise<OperationalFeedResult> {
  const [inbox, today, assigned, upcoming, entryActivity, habitActivity, habitsToday] = await Promise.all([
    queryInboxEntries(ctx),
    queryTodayEntries(ctx),
    queryAssignedEntries(ctx),
    queryUpcomingEntries(ctx),
    queryRecentActivity(ctx),
    queryRecentHabitActivity(ctx),
    queryActionableHabitsToday(ctx),
  ]);

  // Merge entry and habit activity, sort by createdAt desc, take top 20.
  const allActivity = [...entryActivity, ...habitActivity].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  ).slice(0, 20);

  return { inbox, today, assigned, upcoming, recentActivity: allActivity, habitsToday };
}
