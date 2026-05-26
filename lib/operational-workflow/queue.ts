/**
 * Arc 19E — Operational Workflow Orchestration
 *
 * Operational queue query helpers.
 *
 * The operational queue is a filtered, priority-ordered view of open entries
 * assigned to a person or team. It is the primary surface for "what should I
 * work on next" coordination without needing a full task management system.
 *
 * Design: Queries are simple Prisma findMany calls with composable filter
 * objects. No caching, no real-time subscription. Suitable for server-side
 * page rendering.
 */

import type { EntryStatus, EntryType } from "@prisma/client";

import { db } from "@/lib/db";
import type { OperationalQueueFilter } from "./types";

const DEFAULT_QUEUE_STATUSES: EntryStatus[] = ["OPEN", "IN_PROGRESS"];
const DEFAULT_QUEUE_LIMIT = 50;

export type OperationalQueueEntry = {
  id: string;
  type: EntryType;
  title: string;
  status: EntryStatus;
  priority: string;
  dueDate: Date | null;
  assignedToPersonId: string | null;
  teamId: string | null;
  createdAt: Date;
};

/**
 * Returns an ordered list of entries matching the queue filter.
 *
 * Ordering:
 * 1. Overdue entries first (dueDate < today UTC)
 * 2. URGENT priority before HIGH before MEDIUM before LOW
 * 3. Earliest dueDate ascending (null due dates last)
 * 4. createdAt ascending as tiebreaker
 */
export async function listOperationalQueue(filter: OperationalQueueFilter): Promise<OperationalQueueEntry[]> {
  const statuses = filter.statuses?.length ? filter.statuses : DEFAULT_QUEUE_STATUSES;
  const limit = filter.limit ?? DEFAULT_QUEUE_LIMIT;

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const entries = await db.entry.findMany({
    where: {
      organizationId: filter.organizationId,
      deletedAt: null,
      status: { in: statuses },
      ...(filter.assignedToPersonId ? { assignedToPersonId: filter.assignedToPersonId } : {}),
      ...(filter.teamId ? { teamId: filter.teamId } : {}),
      ...(filter.entryTypes?.length ? { type: { in: filter.entryTypes } } : {}),
      ...(filter.overdueOnly ? { dueDate: { not: null, lt: todayStart } } : {}),
    },
    orderBy: [
      { dueDate: "asc" },
      { priority: "asc" },
      { createdAt: "asc" },
    ],
    take: limit,
    select: {
      id: true,
      type: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      assignedToPersonId: true,
      teamId: true,
      createdAt: true,
    },
  });

  return entries.map((e) => ({
    id: e.id,
    type: e.type,
    title: e.title,
    status: e.status,
    priority: e.priority,
    dueDate: e.dueDate,
    assignedToPersonId: e.assignedToPersonId,
    teamId: e.teamId,
    createdAt: e.createdAt,
  }));
}

/**
 * Returns the count of open (OPEN + IN_PROGRESS) entries assigned to a person.
 * Used for lightweight queue badge counts.
 */
export async function countOpenEntriesForPerson(organizationId: string, personId: string): Promise<number> {
  return db.entry.count({
    where: {
      organizationId,
      assignedToPersonId: personId,
      status: { in: DEFAULT_QUEUE_STATUSES },
      deletedAt: null,
    },
  });
}

/**
 * Builds a queue filter from individual parameters, applying defaults.
 * Useful for constructing filters from URL search params in route handlers.
 */
export function buildQueueFilter(
  organizationId: string,
  params: {
    assignedToPersonId?: string | null;
    teamId?: string | null;
    entryTypes?: string[];
    overdueOnly?: boolean;
    limit?: number;
  },
): OperationalQueueFilter {
  return {
    organizationId,
    assignedToPersonId: params.assignedToPersonId ?? null,
    teamId: params.teamId ?? null,
    entryTypes: (params.entryTypes ?? []) as EntryType[],
    statuses: DEFAULT_QUEUE_STATUSES,
    overdueOnly: params.overdueOnly ?? false,
    limit: params.limit ?? DEFAULT_QUEUE_LIMIT,
  };
}
