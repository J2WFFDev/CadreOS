import Link from "next/link";
import { EntryPriority, EntryStatus, EntryType, HabitStatus } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import {
  buildEntryOpsTypeAwareVisibilityWhere,
  resolveEntryOpsAllWorkDefaultVisibility,
  resolveEntryOpsVisibilityContext,
} from "@/lib/entryops/visibility";
import { fetchListsForActor, labelForEntryListContext } from "@/lib/entries/lists";
import { canReadHabit, resolveHabitAccessContext } from "@/lib/habits/access";
import { buildDueWindowWhere, buildEntryOrderBy, parseEntryListFilter } from "@/lib/operational-feed/filters";
import { formatDueDate, isOverdueFeedEntry, labelForEntryPriority, labelForEntryStatus, labelForEntryType } from "@/lib/operational-feed/render";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const ALL_ENTRY_TYPES = Object.values(EntryType);

function readParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function formatAssigneeName(assignedTo: { firstName: string; lastName: string } | null): string {
  if (!assignedTo) return "Unassigned";
  return `${assignedTo.firstName} ${assignedTo.lastName}`.trim() || "Unassigned";
}

export default async function EntriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const scope = await getOrganizationScope();
  const params = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="All Entries" description="Unified tasks, notes, events, decisions, and journals." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load entries right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="All Entries" description="Unified tasks, notes, events, decisions, and journals." />
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  const visibilityContext = await resolveEntryOpsVisibilityContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const allWorkDefaultVisibility = resolveEntryOpsAllWorkDefaultVisibility(visibilityContext);

  if (!allWorkDefaultVisibility.canRead) {
    return (
      <section className="space-y-4">
        <PageHeader title="All Entries" description="Unified tasks, notes, events, decisions, and journals." />
        <ErrorMessage message="You do not have permission to view work items in this organization." />
      </section>
    );
  }

  // Resolve "me" shorthand for assignee filter
  const rawAssignee = readParam(params, "assigneePersonId");
  const resolvedAssigneePersonId =
    rawAssignee === "me" ? (scope.auth.personId ?? undefined) : rawAssignee || undefined;

  const rawParams: Record<string, string> = {
    type: readParam(params, "type"),
    status: readParam(params, "status"),
    priority: readParam(params, "priority"),
    assigneePersonId: resolvedAssigneePersonId ?? "",
    dueWindow: readParam(params, "dueWindow"),
    sort: readParam(params, "sort"),
  };

  const filter = parseEntryListFilter(
    rawParams,
    ALL_ENTRY_TYPES,
    Object.values(EntryStatus),
    Object.values(EntryPriority),
  );

  const now = new Date();
  const dueWhere = buildDueWindowWhere(filter.dueWindow, now);
  const orderBy = buildEntryOrderBy(filter.sort);
  const defaultVisibilityWhere = buildEntryOpsTypeAwareVisibilityWhere(visibilityContext, allWorkDefaultVisibility);

  const entries = await db.entry.findMany({
    where: {
      organizationId: scope.organizationId,
      deletedAt: null,
      AND: [defaultVisibilityWhere],
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(!filter.status ? { status: { in: [EntryStatus.OPEN, EntryStatus.IN_PROGRESS] } } : {}),
      ...(filter.priority ? { priority: filter.priority } : {}),
      ...(filter.assigneePersonId ? { assignedToPersonId: filter.assigneePersonId } : {}),
      ...(dueWhere ?? {}),
    },
    orderBy,
    select: {
      id: true,
      type: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      dueTime: true,
      listId: true,
      updatedAt: true,
      assignedTo: { select: { firstName: true, lastName: true } },
    },
    take: 300,
  });
  const includeActiveHabits =
    (!filter.type || filter.type === EntryType.HABIT) &&
    !filter.status &&
    !filter.priority &&
    filter.dueWindow === "all";
  const habitAccessContext = includeActiveHabits
    ? await resolveHabitAccessContext({
        organizationId: scope.organizationId,
        actorPersonId: scope.auth.personId,
      })
    : null;
  const activeHabits = includeActiveHabits
    ? await db.habit.findMany({
        where: {
          organizationId: scope.organizationId,
          status: HabitStatus.ACTIVE,
          ...(filter.assigneePersonId ? { athletePersonId: filter.assigneePersonId } : {}),
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          status: true,
          athletePersonId: true,
          assignedToTeamId: true,
          createdByPersonId: true,
          updatedAt: true,
          athlete: { select: { firstName: true, lastName: true } },
          assignedToTeam: { select: { programId: true } },
        },
        take: 300,
      })
    : [];
  const visibleActiveHabits = habitAccessContext
    ? activeHabits.filter((habit) =>
        canReadHabit(habitAccessContext, {
          ...habit,
          teamProgramId: habit.assignedToTeam?.programId ?? null,
        }),
      )
    : [];
  const actorVisibleLists = await fetchListsForActor({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const oversightLists = allWorkDefaultVisibility.organizationWide
    ? await db.entryList.findMany({
        where: {
          organizationId: scope.organizationId,
          id: { in: entries.map((entry) => entry.listId).filter((listId): listId is string => Boolean(listId)) },
        },
        select: {
          id: true,
          name: true,
          scope: true,
          isInbox: true,
          isArchived: true,
          ownerPersonId: true,
          programId: true,
          teamId: true,
          owner: { select: { firstName: true, lastName: true } },
          program: { select: { name: true } },
          team: { select: { name: true } },
        },
      })
    : [];
  const visibleLists = [...actorVisibleLists, ...oversightLists];
  const visibleListsById = new Map(visibleLists.map((list) => [list.id, list]));

  // Load person list for assignee filter UI
  const people = await db.person.findMany({
    where: {
      organizationId: scope.organizationId,
      lifecycleStatus: { not: "ARCHIVED" },
      ...(allWorkDefaultVisibility.organizationWide
        ? {}
        : allWorkDefaultVisibility.visiblePersonIds.length > 0
          ? { id: { in: allWorkDefaultVisibility.visiblePersonIds } }
          : { id: "__entryops_no_visible_people__" }),
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
    take: 200,
  });

  const activeFilterCount = [filter.type, filter.status, filter.priority, filter.assigneePersonId, filter.dueWindow !== "all" ? filter.dueWindow : undefined].filter(Boolean).length;

  return (
    <section className="space-y-4">
      <PageHeader
        title="All Entries"
        description="Browse and organize your authorized active and archived Entries."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/entries/inbox" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Inbox
            </Link>
            <Link href="/entries/schedule" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Calendar-ready
            </Link>
            <Link href="/assigned" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              My work
            </Link>
            <Link href="/upcoming" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Upcoming
            </Link>
            <Link href="/entries?quickCapture=1" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
              Quick capture
            </Link>
          </div>
        }
      />

      {/* Filter panel */}
      <form className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Type */}
          <div className="space-y-1">
            <label htmlFor="type" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Type
            </label>
            <select id="type" name="type" defaultValue={filter.type ?? ""} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="">All types</option>
              {ALL_ENTRY_TYPES.map((v) => (
                <option key={v} value={v}>{labelForEntryType(v)}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label htmlFor="status" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Status
            </label>
            <select id="status" name="status" defaultValue={filter.status ?? ""} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="">Active</option>
              {Object.values(EntryStatus).map((v) => (
                <option key={v} value={v}>{labelForEntryStatus(v)}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <label htmlFor="priority" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Priority
            </label>
            <select id="priority" name="priority" defaultValue={filter.priority ?? ""} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="">Any priority</option>
              {Object.values(EntryPriority).map((v) => (
                <option key={v} value={v}>{labelForEntryPriority(v)}</option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div className="space-y-1">
            <label htmlFor="assigneePersonId" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Assignee
            </label>
            <select id="assigneePersonId" name="assigneePersonId" defaultValue={rawAssignee === "me" ? "me" : (filter.assigneePersonId ?? "")} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="">Anyone</option>
              {scope.auth.personId && <option value="me">Assigned to me</option>}
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.firstName} ${p.lastName}`.trim()}
                </option>
              ))}
            </select>
          </div>

          {/* Due window */}
          <div className="space-y-1">
            <label htmlFor="dueWindow" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Due
            </label>
            <select id="dueWindow" name="dueWindow" defaultValue={filter.dueWindow} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="all">Any date</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="upcoming">Upcoming (7 days)</option>
              <option value="no_date">No due date</option>
            </select>
          </div>

          {/* Sort */}
          <div className="space-y-1">
            <label htmlFor="sort" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Sort
            </label>
            <select id="sort" name="sort" defaultValue={filter.sort} className="w-full rounded-md border px-2 py-1.5 text-sm">
              <option value="updated_desc">Last updated</option>
              <option value="due_asc">Due date ↑</option>
              <option value="created_desc">Newest first</option>
              <option value="priority_desc">Priority ↓</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Apply
          </button>
          {activeFilterCount > 0 && (
            <Link href="/entries" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Clear filters
              <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-zinc-200 px-1 py-0.5 text-[10px] font-semibold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
                {activeFilterCount}
              </span>
            </Link>
          )}
        </div>
      </form>

      {entries.length === 0 && visibleActiveHabits.length === 0 ? (
        <EmptyState message="No Entries match the current filters." actionHref="/dashboard" actionLabel="Back to dashboard" />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">List</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const overdue = isOverdueFeedEntry(entry.dueDate, now);
                const formattedDue = formatDueDate(entry.dueDate, entry.dueTime);
                return (
                  <tr key={entry.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/entries/${entry.id}`} className="underline">
                        {entry.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{labelForEntryType(entry.type)}</td>
                    <td className="px-4 py-3">{labelForEntryStatus(entry.status)}</td>
                    <td className="px-4 py-3">{labelForEntryPriority(entry.priority)}</td>
                    <td className={`px-4 py-3 ${overdue ? "text-red-700 dark:text-red-300" : ""}`}>
                      {formattedDue ?? "—"}
                      {overdue && <span className="ml-1.5 text-xs font-medium">overdue</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{formatAssigneeName(entry.assignedTo)}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {entry.listId
                        ? visibleListsById.has(entry.listId)
                          ? labelForEntryListContext(visibleListsById.get(entry.listId)!, scope.auth.personId)
                          : "Restricted list"
                        : "Unlisted"}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{entry.updatedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                  </tr>
                );
              })}
              {visibleActiveHabits.map((habit) => (
                <tr key={`habit-${habit.id}`} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/habits/${habit.id}`} className="underline">
                      {habit.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">Habit</td>
                  <td className="px-4 py-3">Active</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3 text-zinc-500">{formatAssigneeName(habit.athlete)}</td>
                  <td className="px-4 py-3 text-zinc-500">Unlisted</td>
                  <td className="px-4 py-3 text-zinc-500">{habit.updatedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
