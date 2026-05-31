/**
 * Arc 19B — Unified Feed & Today View
 *
 * Type definitions for the operational feed service.
 */

import type { EntryPriority, EntryStatus, EntryType } from "@prisma/client";

// ── Active operational types ────────────────────────────────────────────────

/**
 * Entry types eligible for the Today and Upcoming sections.
 * These are actionable, time-bounded operational items.
 */
export const ACTIVE_OPERATIONAL_TYPES = ["TASK", "FOLLOW_UP", "READINESS_ITEM"] as const;

export type ActiveOperationalType = (typeof ACTIVE_OPERATIONAL_TYPES)[number];

/** Entry statuses considered "active" — shown in Today, Upcoming, and Assigned sections. */
export const ACTIVE_FEED_STATUSES = ["OPEN", "IN_PROGRESS"] as const satisfies EntryStatus[];

export type ActiveFeedStatus = (typeof ACTIVE_FEED_STATUSES)[number];

/** Default number of days ahead to include in the upcoming window. */
export const DEFAULT_UPCOMING_DAYS = 14;

// ── Feed item projections ───────────────────────────────────────────────────

/** Minimal entry projection used in feed lists. */
export type FeedEntryItem = {
  id: string;
  type: EntryType;
  title: string;
  status: EntryStatus;
  priority: EntryPriority;
  dueDate: Date | null;
  dueTime: string | null;
  teamId: string | null;
  assignedToPersonId: string | null;
  /** Resolved assignee name from the Entry.assignedTo relation. Null when unassigned. */
  assignedTo: { firstName: string; lastName: string } | null;
  createdAt: Date;
};

/** A single entry activity record in the feed. */
export type FeedActivityItem = {
  id: string;
  entryId: string;
  entryTitle: string;
  entryType: EntryType | "HABIT";
  action: string;
  actorPersonId: string | null;
  createdAt: Date;
};

/**
 * Arc 24D.8: An actionable habit item for the My Work / Today section.
 * Shown when a habit is ACTIVE and its schedule says it should be acted on today.
 */
export type ActionableHabitItem = {
  id: string;
  title: string;
  frequency: string | null;
  trackingMode: string | null;
  targetCount: number | null;
  targetUnit: string | null;
  completedToday: boolean;
};

// ── Query context ───────────────────────────────────────────────────────────

/** Context passed to feed query functions. */
export type FeedQueryContext = {
  organizationId: string;
  actorPersonId: string | null;
  /** Override for the current timestamp (useful in tests). Defaults to new Date(). */
  now?: Date;
  /** Override for the number of upcoming days. Defaults to DEFAULT_UPCOMING_DAYS. */
  upcomingDays?: number;
};

// ── Time windows ────────────────────────────────────────────────────────────

export type TodayWindow = {
  /** Midnight UTC today. */
  todayStart: Date;
  /** Midnight UTC tomorrow — entries due before this are "today or overdue". */
  tomorrowStart: Date;
};

export type UpcomingWindow = {
  /** First moment of the upcoming window (tomorrow start). */
  from: Date;
  /** Exclusive end of the upcoming window. */
  to: Date;
};

// ── Aggregated feed ─────────────────────────────────────────────────────────

/** The full aggregated operational feed result. */
export type OperationalFeedResult = {
  inbox: FeedEntryItem[];
  today: FeedEntryItem[];
  assigned: FeedEntryItem[];
  upcoming: FeedEntryItem[];
  recentActivity: FeedActivityItem[];
  /** Arc 24D.8: Actionable habits for today's My Work section. */
  habitsToday: ActionableHabitItem[];
};
