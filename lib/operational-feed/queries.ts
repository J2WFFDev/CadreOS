/**
 * Arc 19B — Unified Feed & Today View
 *
 * Query architecture for the operational feed service.
 *
 * Pure helpers (computeTodayWindow, computeUpcomingWindow, isOverdueEntry) are
 * exported for testing. Async DB functions are the runtime API.
 */

import { EntryStatus, EntryType, HabitFrequency, HabitStatus, InboxItemStatus, type Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { parseDecisionEntryPayload } from "@/lib/entries/decision-payload";
import { parseEventEntryPayload } from "@/lib/entries/event-payload";
import {
  canCheckInHabit,
  canReadHabit,
  resolveHabitAccessContext,
  type HabitAccessContext,
  type HabitRecord,
} from "@/lib/habits/access";
import { deriveSafeHabitActivityText, isHabitActionableToday } from "@/lib/habits/policy";
import { deriveSafeJournalActivityText } from "@/lib/journals/policy";
import { ACTIVE_FEED_STATUSES, DEFAULT_UPCOMING_DAYS } from "./types";
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
  startDate: true,
  endDate: true,
  teamId: true,
  assignedToPersonId: true,
  assignedTo: { select: { firstName: true, lastName: true } },
  typePayloads: {
    where: { entryType: { in: [EntryType.EVENT, EntryType.DECISION] } },
    orderBy: { updatedAt: "desc" },
    select: { entryType: true, payloadJson: true },
    take: 2,
  },
  createdAt: true,
} as const;

function isActionableJournal(status: EntryStatus) {
  return status === EntryStatus.IN_PROGRESS;
}

type FeedEntryQueryRow = Prisma.EntryGetPayload<{ select: typeof FEED_ENTRY_SELECT }>;
type EntryDateWindow = { from: Date; to: Date } | { before: Date } | null;

const DIRECT_ACTIONABLE_TYPES = [EntryType.TASK, EntryType.FOLLOW_UP, EntryType.READINESS_ITEM] as const;
const EVENT_PAYLOAD_DATE_KEYS = ['"startDateTimeLocal":"', '"endDateTimeLocal":"'] as const;
const DECISION_PAYLOAD_DATE_KEYS = ['"maturityDate":"', '"decisionDate":"'] as const;

function parseDateOnlyToUtc(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function parseDateTimeLocalToUtcDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const dateOnly = value.slice(0, 10);
  return parseDateOnlyToUtc(dateOnly);
}

function payloadJsonForEntryType(entry: FeedEntryQueryRow, entryType: EntryType): string | null {
  return entry.typePayloads.find((payload) => payload.entryType === entryType)?.payloadJson ?? null;
}

function eventPayloadScheduleDate(payloadJson: string | null): Date | null {
  const payload = parseEventEntryPayload(payloadJson);
  return parseDateTimeLocalToUtcDate(payload.startDateTimeLocal) ?? parseDateTimeLocalToUtcDate(payload.endDateTimeLocal);
}

function decisionPayloadScheduleDate(payloadJson: string | null): Date | null {
  const payload = parseDecisionEntryPayload(payloadJson);
  return parseDateOnlyToUtc(payload.maturityDate) ?? parseDateOnlyToUtc(payload.decisionDate);
}

function dateMatchesWindow(date: Date | null, window: EntryDateWindow): boolean {
  if (!date) return false;
  if (!window) return true;
  if ("before" in window) return date < window.before;
  return date >= window.from && date < window.to;
}

function hasEventScheduleSignal(entry: FeedEntryQueryRow, window: EntryDateWindow): boolean {
  return hasEventScheduleSignalForMyWork(
    {
      dueDate: entry.dueDate,
      startDate: entry.startDate,
      endDate: entry.endDate,
      eventPayloadJson: payloadJsonForEntryType(entry, EntryType.EVENT),
    },
    window,
  );
}

function hasDecisionScheduleSignal(entry: FeedEntryQueryRow, window: EntryDateWindow): boolean {
  return hasDecisionScheduleSignalForMyWork(
    {
      dueDate: entry.dueDate,
      decisionPayloadJson: payloadJsonForEntryType(entry, EntryType.DECISION),
    },
    window,
  );
}

export function hasEventScheduleSignalForMyWork(
  input: {
    dueDate: Date | null;
    startDate: Date | null;
    endDate: Date | null;
    eventPayloadJson: string | null;
  },
  window: EntryDateWindow,
): boolean {
  if (
    dateMatchesWindow(input.dueDate, window) ||
    dateMatchesWindow(input.startDate, window) ||
    dateMatchesWindow(input.endDate, window)
  ) {
    return true;
  }
  return dateMatchesWindow(eventPayloadScheduleDate(input.eventPayloadJson), window);
}

export function hasDecisionScheduleSignalForMyWork(
  input: {
    dueDate: Date | null;
    decisionPayloadJson: string | null;
  },
  window: EntryDateWindow,
): boolean {
  if (dateMatchesWindow(input.dueDate, window)) return true;
  return dateMatchesWindow(decisionPayloadScheduleDate(input.decisionPayloadJson), window);
}

function isActionableMyWorkEntry(
  entry: FeedEntryQueryRow,
  options: {
    requireScheduledSignalForEventAndDecision: boolean;
    dateWindow: EntryDateWindow;
  },
) {
  const requiresDateWindow = Boolean(options.dateWindow);

  if (DIRECT_ACTIONABLE_TYPES.includes(entry.type)) {
    return requiresDateWindow ? dateMatchesWindow(entry.dueDate, options.dateWindow) : true;
  }

  if (entry.type === EntryType.JOURNAL) {
    return isActionableJournal(entry.status) && (requiresDateWindow ? dateMatchesWindow(entry.dueDate, options.dateWindow) : true);
  }

  if (entry.type === EntryType.EVENT) {
    return options.requireScheduledSignalForEventAndDecision
      ? hasEventScheduleSignal(entry, options.dateWindow)
      : dateMatchesWindow(entry.dueDate, options.dateWindow);
  }

  if (entry.type === EntryType.DECISION) {
    return options.requireScheduledSignalForEventAndDecision
      ? hasDecisionScheduleSignal(entry, options.dateWindow)
      : dateMatchesWindow(entry.dueDate, options.dateWindow);
  }

  return true;
}

function toFeedEntryItem(entry: FeedEntryQueryRow): FeedEntryItem {
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    status: entry.status,
    priority: entry.priority,
    dueDate: entry.dueDate,
    dueTime: entry.dueTime,
    teamId: entry.teamId,
    assignedToPersonId: entry.assignedToPersonId,
    assignedTo: entry.assignedTo,
    createdAt: entry.createdAt,
  };
}

function buildDateWindowWhere(window: EntryDateWindow, payloadDateKeys?: readonly string[]): Prisma.EntryWhereInput | null {
  if (!window) return null;

  const dateConditions: Prisma.EntryWhereInput[] = [];
  if ("before" in window) {
    dateConditions.push(
      { dueDate: { lt: window.before } },
      { startDate: { lt: window.before } },
      { endDate: { lt: window.before } },
    );
  } else {
    dateConditions.push(
      { dueDate: { gte: window.from, lt: window.to } },
      { startDate: { gte: window.from, lt: window.to } },
      { endDate: { gte: window.from, lt: window.to } },
    );
  }

  if (payloadDateKeys?.length) {
    for (const key of payloadDateKeys) {
      dateConditions.push({
        typePayloads: {
          some: {
            payloadJson: { contains: key },
          },
        },
      });
    }
  }

  return { OR: dateConditions };
}

export function buildActionableWhere(
  window: EntryDateWindow,
  requireScheduledSignalForEventAndDecision: boolean,
): Prisma.EntryWhereInput {
  const directDateWhere = buildDateWindowWhere(window);
  const eventDateWhere = buildDateWindowWhere(
    window,
    requireScheduledSignalForEventAndDecision ? EVENT_PAYLOAD_DATE_KEYS : undefined,
  );
  const decisionDateWhere = buildDateWindowWhere(
    window,
    requireScheduledSignalForEventAndDecision ? DECISION_PAYLOAD_DATE_KEYS : undefined,
  );

  const branches: Prisma.EntryWhereInput[] = [
    {
      type: { in: [...DIRECT_ACTIONABLE_TYPES] },
      ...(directDateWhere ?? {}),
    },
    {
      type: EntryType.JOURNAL,
      status: EntryStatus.IN_PROGRESS,
      ...(directDateWhere ?? {}),
    },
  ];

  if (eventDateWhere) {
    branches.push({
      type: EntryType.EVENT,
      ...eventDateWhere,
    });
  }

  if (decisionDateWhere) {
    branches.push({
      type: EntryType.DECISION,
      ...decisionDateWhere,
    });
  }

  return { OR: branches };
}

// ── DB query functions ──────────────────────────────────────────────────────

/**
 * Queries entries that are due today or overdue.
 * Covers TASK, FOLLOW_UP, and READINESS_ITEM entry types with active statuses.
 */
export async function queryTodayEntries(ctx: FeedQueryContext): Promise<FeedEntryItem[]> {
  const now = ctx.now ?? new Date();
  const { tomorrowStart } = computeTodayWindow(now);

  const entries = await db.entry.findMany({
    where: {
      organizationId: ctx.organizationId,
      deletedAt: null,
      status: { in: [...ACTIVE_FEED_STATUSES] },
      ...buildActionableWhere({ before: tomorrowStart }, true),
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    select: FEED_ENTRY_SELECT,
    take: 100,
  });

  return entries
    .filter((entry) =>
      isActionableMyWorkEntry(entry, {
        requireScheduledSignalForEventAndDecision: true,
        dateWindow: { before: tomorrowStart },
      }),
    )
    .map(toFeedEntryItem);
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

  const entries = await db.entry.findMany({
    where: {
      organizationId: ctx.organizationId,
      deletedAt: null,
      status: { in: [...ACTIVE_FEED_STATUSES] },
      AND: [
        buildActionableWhere(null, true),
        {
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
      ],
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    select: FEED_ENTRY_SELECT,
    take: 50,
  });

  return entries
    .filter((entry) =>
      isActionableMyWorkEntry(entry, {
        requireScheduledSignalForEventAndDecision: true,
        dateWindow: null,
      }),
    )
    .map(toFeedEntryItem);
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

  const entries = await db.entry.findMany({
    where: {
      organizationId: ctx.organizationId,
      deletedAt: null,
      status: { in: [EntryStatus.OPEN, EntryStatus.IN_PROGRESS] },
      ...buildActionableWhere({ from, to }, true),
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    select: FEED_ENTRY_SELECT,
    take: 100,
  });

  return entries
    .filter((entry) =>
      isActionableMyWorkEntry(entry, {
        requireScheduledSignalForEventAndDecision: true,
        dateWindow: { from, to },
      }),
    )
    .map(toFeedEntryItem);
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

type HabitActivityRow = {
  id: string;
  habitId: string;
  action: string;
  actorPersonId: string | null;
  createdAt: Date;
  habit: {
    title: string;
    athletePersonId: string;
    assignedToTeamId: string | null;
    createdByPersonId: string;
    status: HabitStatus;
    assignedToTeam: { programId: string } | null;
  };
};

type ActionableHabitRow = {
  id: string;
  title: string;
  trackingMode: string | null;
  targetCount: number | null;
  targetUnit: string | null;
  athletePersonId: string;
  assignedToTeamId: string | null;
  createdByPersonId: string;
  status: HabitStatus;
  assignedToTeam: { programId: string } | null;
  schedules: Array<{
    frequency: HabitFrequency;
    daysOfWeek: string | null;
    startDate: Date;
    endDate: Date | null;
  }>;
  completions: Array<{ id: string }>;
};

function toHabitRecord(input: {
  id: string;
  athletePersonId: string;
  assignedToTeamId: string | null;
  createdByPersonId: string;
  status: HabitStatus;
  assignedToTeam: { programId: string } | null;
}): HabitRecord {
  return {
    id: input.id,
    athletePersonId: input.athletePersonId,
    assignedToTeamId: input.assignedToTeamId,
    createdByPersonId: input.createdByPersonId,
    status: input.status,
    teamProgramId: input.assignedToTeam?.programId ?? null,
  };
}

export function buildRecentHabitActivityItems(
  activities: HabitActivityRow[],
  accessContext: HabitAccessContext,
  limit = 20,
): FeedActivityItem[] {
  return activities
    .filter((activity) => canReadHabit(accessContext, toHabitRecord({ id: activity.habitId, ...activity.habit })))
    .map((activity) => ({
      id: activity.id,
      entryId: activity.habitId,
      entryTitle: deriveSafeHabitActivityText(activity.action, activity.habit.title),
      entryType: "HABIT_ACTIVITY" as const,
      action: activity.action,
      actorPersonId: activity.actorPersonId,
      createdAt: activity.createdAt,
    }))
    .slice(0, limit);
}

export function buildActionableHabitsTodayItems(
  habits: ActionableHabitRow[],
  accessContext: HabitAccessContext,
  now: Date,
): ActionableHabitItem[] {
  const result: ActionableHabitItem[] = [];

  for (const habit of habits) {
    const habitRecord = toHabitRecord(habit);
    if (!canReadHabit(accessContext, habitRecord)) continue;

    const schedule = habit.schedules[0] ?? null;
    const actionable = isHabitActionableToday({
      status: habit.status,
      scheduleFrequency: schedule?.frequency ?? null,
      scheduleDaysOfWeek: schedule?.daysOfWeek ?? null,
      scheduleStartDate: schedule?.startDate ?? null,
      scheduleEndDate: schedule?.endDate ?? null,
      todayDate: now,
    });
    if (!actionable) continue;

    result.push({
      id: habit.id,
      title: habit.title,
      frequency: schedule?.frequency ?? null,
      trackingMode: habit.trackingMode ?? null,
      targetCount: habit.targetCount,
      targetUnit: habit.targetUnit,
      completedToday: habit.completions.length > 0,
      canCheckIn: canCheckInHabit(accessContext, habitRecord),
    });
  }

  return result;
}

/**
 * Arc 24D.8: Queries the most recent HabitActivity records for the organization.
 * Maps habitId onto the entryId field (with entryType: "HABIT_ACTIVITY") for unified
 * rendering through the existing FeedActivityItem pipeline.
 */
export async function queryRecentHabitActivity(
  ctx: Pick<FeedQueryContext, "organizationId" | "actorPersonId">,
  limit = 20,
): Promise<FeedActivityItem[]> {
  const accessContext = await resolveHabitAccessContext({
    organizationId: ctx.organizationId,
    actorPersonId: ctx.actorPersonId,
  });
  const scopedFetchLimit = Math.max(limit * 5, limit);
  const activities = await db.habitActivity.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      habitId: true,
      action: true,
      actorPersonId: true,
      createdAt: true,
      habit: {
        select: {
          title: true,
          athletePersonId: true,
          assignedToTeamId: true,
          createdByPersonId: true,
          status: true,
          assignedToTeam: { select: { programId: true } },
        },
      },
    },
    take: scopedFetchLimit,
  });

  return buildRecentHabitActivityItems(activities, accessContext, limit);
}

/**
 * Arc 24D.8: Queries ACTIVE habits for the organization and filters them to
 * those that are actionable today (per isHabitActionableToday). Also marks
 * whether the habit has already been checked in today.
 */
export async function queryActionableHabitsToday(ctx: FeedQueryContext): Promise<ActionableHabitItem[]> {
  const now = ctx.now ?? new Date();
  const { todayStart, tomorrowStart } = computeTodayWindow(now);
  const accessContext = await resolveHabitAccessContext({
    organizationId: ctx.organizationId,
    actorPersonId: ctx.actorPersonId,
  });

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
      athletePersonId: true,
      assignedToTeamId: true,
      createdByPersonId: true,
      status: true,
      assignedToTeam: { select: { programId: true } },
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

  return buildActionableHabitsTodayItems(habits, accessContext, now);
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
