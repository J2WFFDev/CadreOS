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
  createdAt: Date;
};

/** A single entry activity record in the feed. */
export type FeedActivityItem = {
  id: string;
  entryId: string;
  entryTitle: string;
  action: string;
  actorPersonId: string | null;
  createdAt: Date;
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
};
