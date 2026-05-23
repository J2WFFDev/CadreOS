import Link from "next/link";
import { Prisma, RoleType, TaskStatus } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReviewFocusPanel } from "@/components/dashboard/review-focus-panel";
import { db } from "@/lib/db";
import {
  compareFollowUpTasks,
  formatDateTime,
  formatEnumLabel,
  getTaskStatusBadgeClassName,
  isTaskOverdue,
} from "@/lib/follow-up-tasks";
import {
  deriveGuardianOperationalContext,
  formatGuardianFollowUpDependency,
  formatGuardianOperationalIndicator,
} from "@/lib/guardian-operational-context";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";
const STALE_UNRESOLVED_TASK_WINDOW_DAYS = 14;

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function buildHref(pathname: string, filters: Record<string, string>) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function deriveTaskTeams(task: {
  sourceEvent: { team: { id: string; name: string } | null } | null;
  sourceNote: {
    team: { id: string; name: string } | null;
    event: { team: { id: string; name: string } | null } | null;
  } | null;
}) {
  const candidates = [
    task.sourceEvent?.team ?? null,
    task.sourceNote?.team ?? null,
    task.sourceNote?.event?.team ?? null,
  ].filter((value): value is { id: string; name: string } => Boolean(value));

  return candidates.filter((value, index, array) => array.findIndex((item) => item.id === value.id) === index);
}

function hasTaskResponsibleContext(task: {
  sourceNote: {
    athlete: { id: string } | null;
    team: { id: string; name: string } | null;
    event: { id: string; title: string; team: { id: string; name: string } | null } | null;
  } | null;
  sourceEvent: { id: string; title: string; team: { id: string; name: string } | null } | null;
  sourceInboxItem: { id: string; category: string; status: string } | null;
}) {
  return Boolean(task.sourceEvent || task.sourceNote || task.sourceInboxItem);
}

function isUnresolvedTaskStatus(status: string) {
  return status === TaskStatus.OPEN || status === TaskStatus.IN_PROGRESS || status === TaskStatus.BLOCKED;
}

function formatSource(task: {
  sourceNote: { id: string; body: string } | null;
  sourceEvent: { id: string; title: string } | null;
  sourceInboxItem: { id: string; category: string; status: string } | null;
}) {
  if (!task.sourceNote && !task.sourceEvent && !task.sourceInboxItem) {
    return "—";
  }

  return (
    <div className="space-y-1">
      {task.sourceNote ? (
        <Link href={`/notes/${task.sourceNote.id}`} className="block underline">
          Note: {task.sourceNote.body.length > 60 ? `${task.sourceNote.body.slice(0, 60)}…` : task.sourceNote.body}
        </Link>
      ) : null}
      {task.sourceEvent ? (
        <Link href={`/events/${task.sourceEvent.id}`} className="block underline">
          Event: {task.sourceEvent.title}
        </Link>
      ) : null}
      {task.sourceInboxItem ? (
        <span className="block">
          Inbox item: {task.sourceInboxItem.category} · {formatEnumLabel(task.sourceInboxItem.status)} (
          <code>{task.sourceInboxItem.id}</code>)
        </span>
      ) : null}
    </div>
  );
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();
  const statusParam = readSearchParam(resolvedSearchParams, "status");
  const assigneePersonIdParam = readSearchParam(resolvedSearchParams, "assigneePersonId");
  const teamIdParam = readSearchParam(resolvedSearchParams, "teamId");
  const eventIdParam = readSearchParam(resolvedSearchParams, "eventId");
  const resolutionParam = readSearchParam(resolvedSearchParams, "resolution");
  const dueWindowParam = readSearchParam(resolvedSearchParams, "dueWindow");
  const changedWindowParam = readSearchParam(resolvedSearchParams, "changedWindow");
  const guardianFollowUpParam = readSearchParam(resolvedSearchParams, "guardianFollowUp");
  const ownershipIndicatorParam = readSearchParam(resolvedSearchParams, "ownershipIndicator");
  const statusFilter = Object.values(TaskStatus).includes(statusParam as TaskStatus)
    ? (statusParam as TaskStatus)
    : "";
  const resolutionFilter =
    resolutionParam === "unresolved" || resolutionParam === "resolved" || resolutionParam === "all"
      ? resolutionParam
      : "all";
  const dueWindowFilter =
    dueWindowParam === "overdue" || dueWindowParam === "upcoming" || dueWindowParam === "all"
      ? dueWindowParam
      : "all";
  const changedWindowFilter =
    changedWindowParam === "last_24h" || changedWindowParam === "last_7d" || changedWindowParam === "all"
      ? changedWindowParam
      : "all";
  const guardianFollowUpFilter =
    guardianFollowUpParam === "involving_guardian" || guardianFollowUpParam === "missing_guardian_linkage"
      ? guardianFollowUpParam
      : "";
  const ownershipIndicatorFilter =
    ownershipIndicatorParam === "unresolved_owner_linked" ||
    ownershipIndicatorParam === "overdue_owner_linked" ||
    ownershipIndicatorParam === "missing_responsible_context" ||
    ownershipIndicatorParam === "stale_unresolved" ||
    ownershipIndicatorParam === "urgent"
      ? ownershipIndicatorParam
      : "";

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query tasks right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canViewGuardianRelationshipDetails = guardianAccess.canViewGuardianRelationshipDetails;

  let tasks:
    | Array<{
        id: string;
        title: string;
        status: string;
        dueAt: Date | null;
        updatedAt: Date;
        assignee: { id: string; firstName: string; lastName: string };
        createdBy: { id: string; firstName: string; lastName: string };
        sourceNote: {
          id: string;
          body: string;
          team: { id: string; name: string } | null;
          athlete:
            | {
                id: string;
                firstName: string;
                lastName: string;
                athleteLinks?: Array<{
                  id: string;
                  guardian: {
                    _count: { userAccounts: number };
                    roles: Array<{ id: string }>;
                  };
                }>;
              }
            | null;
          event: { id: string; title: string; team: { id: string; name: string } | null } | null;
        } | null;
        sourceEvent: { id: string; title: string; team: { id: string; name: string } | null } | null;
        sourceInboxItem: { id: string; category: string; status: string } | null;
      }>
    | null = null;
  let people: Array<{ id: string; firstName: string; lastName: string }> = [];
  let teams: Array<{ id: string; name: string }> = [];
  let events: Array<{ id: string; title: string }> = [];
  let queryErrorMessage = "Unable to load tasks right now. Please try again later.";

  try {
    const where: Prisma.FollowUpTaskWhereInput = {
      organizationId: scope.organizationId,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(assigneePersonIdParam ? { assigneePersonId: assigneePersonIdParam } : {}),
      ...(!statusFilter && resolutionFilter === "unresolved"
        ? { status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] } }
        : {}),
      ...(!statusFilter && resolutionFilter === "resolved"
        ? { status: { in: [TaskStatus.DONE, TaskStatus.CANCELLED] } }
        : {}),
      ...(eventIdParam
        ? {
            OR: [
              { sourceEventId: eventIdParam },
              { sourceNote: { is: { eventId: eventIdParam } } },
            ],
          }
        : {}),
      ...(changedWindowFilter === "last_24h"
        ? { updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        : {}),
      ...(changedWindowFilter === "last_7d"
        ? { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
        : {}),
      ...(canViewGuardianRelationshipDetails && guardianFollowUpFilter === "involving_guardian"
        ? {
            sourceNote: {
              is: {
                athletePersonId: { not: null },
                athlete: {
                  athleteLinks: {
                    some: {
                      organizationId: scope.organizationId,
                    },
                  },
                },
              },
            },
          }
        : {}),
      ...(canViewGuardianRelationshipDetails && guardianFollowUpFilter === "missing_guardian_linkage"
        ? {
            sourceNote: {
              is: {
                athletePersonId: { not: null },
                athlete: {
                  athleteLinks: {
                    none: {
                      organizationId: scope.organizationId,
                    },
                  },
                },
              },
            },
          }
        : {}),
    };

    [tasks, people, teams, events] = await Promise.all([
      db.followUpTask.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
          updatedAt: true,
          assignee: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          sourceNote: {
            select: {
              id: true,
              body: true,
              team: { select: { id: true, name: true } },
              athlete: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  athleteLinks: {
                    where: { organizationId: scope.organizationId },
                    select: {
                      id: true,
                      guardian: {
                        select: {
                          _count: { select: { userAccounts: true } },
                          roles: {
                            where: {
                              organizationId: scope.organizationId,
                              roleType: RoleType.PARENT_GUARDIAN,
                            },
                            select: { id: true },
                            take: 1,
                          },
                        },
                      },
                    },
                  },
                },
              },
              event: { select: { id: true, title: true, team: { select: { id: true, name: true } } } },
            },
          },
          sourceEvent: { select: { id: true, title: true, team: { select: { id: true, name: true } } } },
          sourceInboxItem: { select: { id: true, category: true, status: true } },
        },
      }),
      db.person.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      db.team.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      db.event.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, title: true },
        orderBy: [{ startsAt: "desc" }],
        take: 150,
      }),
    ]);
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading tasks.";
    }
  }

  if (!tasks) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const now = new Date();
  const upcomingCutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const staleUnresolvedCutoff = new Date(now.getTime() - STALE_UNRESOLVED_TASK_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const filteredTasks = tasks
    .filter((task) => {
      const unresolved = task.status === TaskStatus.OPEN || task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.BLOCKED;
      const staleUnresolved = unresolved && task.updatedAt.getTime() < staleUnresolvedCutoff.getTime();
      const missingResponsibleContext = !hasTaskResponsibleContext(task);
      const taskTeams = deriveTaskTeams({
        sourceEvent: task.sourceEvent,
        sourceNote: task.sourceNote,
      });
      if (teamIdParam && !taskTeams.some((team) => team.id === teamIdParam)) {
        return false;
      }

      if (eventIdParam && !task.sourceEvent && !task.sourceNote?.event) {
        return false;
      }

      if (eventIdParam && task.sourceEvent?.id !== eventIdParam && task.sourceNote?.event?.id !== eventIdParam) {
        return false;
      }

      if (dueWindowFilter === "overdue") {
        return isTaskOverdue(task, now);
      }

      if (dueWindowFilter === "upcoming") {
        if (!task.dueAt) {
          return false;
        }

        if (task.status === TaskStatus.DONE || task.status === TaskStatus.CANCELLED) {
          return false;
        }

        return task.dueAt.getTime() >= now.getTime() && task.dueAt.getTime() <= upcomingCutoff.getTime();
      }

      if (ownershipIndicatorFilter === "unresolved_owner_linked" && !unresolved) {
        return false;
      }

      if (ownershipIndicatorFilter === "overdue_owner_linked" && (!unresolved || !isTaskOverdue(task, now))) {
        return false;
      }

      if (ownershipIndicatorFilter === "missing_responsible_context" && (!unresolved || !missingResponsibleContext)) {
        return false;
      }

      if (ownershipIndicatorFilter === "stale_unresolved" && !staleUnresolved) {
        return false;
      }

      // "urgent" = unresolved AND (overdue OR blocked) — highest operational priority
      if (ownershipIndicatorFilter === "urgent" && !(unresolved && (isTaskOverdue(task, now) || task.status === TaskStatus.BLOCKED))) {
        return false;
      }

      return true;
    })
    .sort(compareFollowUpTasks);
  const unresolvedTaskCount = filteredTasks.filter((task) => isUnresolvedTaskStatus(task.status)).length;
  const urgentTaskCount = filteredTasks.filter(
    (task) => isUnresolvedTaskStatus(task.status) && (isTaskOverdue(task, now) || task.status === TaskStatus.BLOCKED),
  ).length;
  const staleTaskCount = filteredTasks.filter(
    (task) => isUnresolvedTaskStatus(task.status) && task.updatedAt.getTime() < staleUnresolvedCutoff.getTime(),
  ).length;
  const overdueTaskCount = filteredTasks.filter((task) => isTaskOverdue(task, now)).length;
  const recentlyChangedTaskCount = filteredTasks.filter(
    (task) => task.updatedAt.getTime() >= now.getTime() - 24 * 60 * 60 * 1000,
  ).length;
  const activeFilterLabels: string[] = [];

  if (statusFilter) {
    activeFilterLabels.push(`Status: ${formatEnumLabel(statusFilter)}`);
  }
  if (assigneePersonIdParam) {
    const assignee = people.find((person) => person.id === assigneePersonIdParam);
    if (assignee) {
      activeFilterLabels.push(`Assignee: ${assignee.firstName} ${assignee.lastName}`);
    }
  }
  if (teamIdParam) {
    const team = teams.find((value) => value.id === teamIdParam);
    if (team) {
      activeFilterLabels.push(`Team: ${team.name}`);
    }
  }
  if (eventIdParam) {
    const event = events.find((value) => value.id === eventIdParam);
    if (event) {
      activeFilterLabels.push(`Event: ${event.title}`);
    }
  }
  if (resolutionFilter !== "all") {
    activeFilterLabels.push(`Resolution: ${resolutionFilter === "unresolved" ? "Unresolved only" : "Resolved only"}`);
  }
  if (dueWindowFilter !== "all") {
    activeFilterLabels.push(`Due window: ${dueWindowFilter === "overdue" ? "Overdue" : "Upcoming"}`);
  }
  if (changedWindowFilter !== "all") {
    activeFilterLabels.push(
      `Recently changed: ${changedWindowFilter === "last_24h" ? "Last 24 hours" : "Last 7 days"}`,
    );
  }
  if (ownershipIndicatorFilter) {
    const labelByFilter: Record<string, string> = {
      urgent: "Priority: urgent",
      unresolved_owner_linked: "Priority: unresolved owner-linked",
      overdue_owner_linked: "Priority: overdue owner-linked",
      missing_responsible_context: "Priority: missing responsible context",
      stale_unresolved: "Priority: stale unresolved",
    };
    activeFilterLabels.push(labelByFilter[ownershipIndicatorFilter] ?? ownershipIndicatorFilter);
  }
  if (canViewGuardianRelationshipDetails && guardianFollowUpFilter) {
    const labelByFilter: Record<string, string> = {
      involving_guardian: "Guardian follow-up: may involve guardian",
      missing_guardian_linkage: "Guardian follow-up: missing linkage",
    };
    activeFilterLabels.push(labelByFilter[guardianFollowUpFilter] ?? guardianFollowUpFilter);
  }

  const hasActiveFilters =
    Boolean(statusFilter) ||
    Boolean(assigneePersonIdParam) ||
    Boolean(teamIdParam) ||
    Boolean(eventIdParam) ||
    resolutionFilter !== "all" ||
    dueWindowFilter !== "all" ||
    changedWindowFilter !== "all" ||
    Boolean(ownershipIndicatorFilter) ||
    (canViewGuardianRelationshipDetails && Boolean(guardianFollowUpFilter));
  const buildTaskHref = (overrides: Record<string, string>) =>
    buildHref("/tasks", {
      status: statusFilter,
      assigneePersonId: assigneePersonIdParam,
      teamId: teamIdParam,
      eventId: eventIdParam,
      resolution: resolutionFilter === "all" ? "" : resolutionFilter,
      dueWindow: dueWindowFilter === "all" ? "" : dueWindowFilter,
      changedWindow: changedWindowFilter === "all" ? "" : changedWindowFilter,
      ownershipIndicator: ownershipIndicatorFilter,
      guardianFollowUp: canViewGuardianRelationshipDetails ? guardianFollowUpFilter : "",
      ...overrides,
    });

  return (
    <section className="space-y-4">
      <PageHeader
        title="Tasks"
        description="Track follow-up actions and accountability items across your organization."
        actions={
          <Link href="/tasks/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            New task
          </Link>
        }
      />

      <ReviewFocusPanel
        title="Operational review focus"
        description="Keep unresolved, stale, urgent, and recently changed follow-up in one review lane. Current scope is preserved when these quick links are used."
        activeFilters={activeFilterLabels}
        defaultScope="No filters are active. Review spans all follow-up tasks in the current organization."
        stats={[
          {
            label: "Tasks in current scope",
            value: filteredTasks.length,
            href: hasActiveFilters ? buildTaskHref({}) : "/tasks",
          },
          {
            label: "Unresolved",
            value: unresolvedTaskCount,
            href: buildTaskHref({ status: "", resolution: "unresolved" }),
            tone: unresolvedTaskCount > 0 ? "warning" : "success",
          },
          {
            label: "Urgent",
            value: urgentTaskCount,
            href: buildTaskHref({ status: "", resolution: "", ownershipIndicator: "urgent" }),
            tone: urgentTaskCount > 0 ? "danger" : "success",
          },
          {
            label: "Stale unresolved",
            value: staleTaskCount,
            href: buildTaskHref({ status: "", resolution: "unresolved", ownershipIndicator: "stale_unresolved" }),
            tone: staleTaskCount > 0 ? "warning" : "success",
          },
          {
            label: "Overdue",
            value: overdueTaskCount,
            href: buildTaskHref({ status: "", resolution: "", dueWindow: "overdue", ownershipIndicator: "" }),
            tone: overdueTaskCount > 0 ? "danger" : "neutral",
          },
          {
            label: "Updated in last 24h",
            value: recentlyChangedTaskCount,
            href: buildTaskHref({ changedWindow: "last_24h" }),
            tone: recentlyChangedTaskCount > 0 ? "info" : "neutral",
          },
        ]}
        links={[
          { label: "Unresolved in current scope", href: buildTaskHref({ status: "", resolution: "unresolved" }) },
          { label: "Urgent follow-up", href: buildTaskHref({ status: "", resolution: "", ownershipIndicator: "urgent" }) },
          {
            label: "Stale unresolved review",
            href: buildTaskHref({ status: "", resolution: "unresolved", ownershipIndicator: "stale_unresolved" }),
          },
          { label: "Recent task changes", href: buildTaskHref({ changedWindow: "last_24h" }) },
        ]}
        guidance="Priority and stale indicators are derived from existing status, due date, and updated-at data only. No reminders or automation are introduced."
      />

      <form method="get" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="grid gap-3 md:grid-cols-8">
          <div className="space-y-1">
            <label htmlFor="status" className="text-sm font-medium">
              Status
            </label>
            <select id="status" name="status" defaultValue={statusFilter} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">All statuses</option>
              {Object.values(TaskStatus).map((value) => (
                <option key={value} value={value}>
                  {formatEnumLabel(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="assigneePersonId" className="text-sm font-medium">
              Assignee
            </label>
            <select
              id="assigneePersonId"
              name="assigneePersonId"
              defaultValue={assigneePersonIdParam}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">All assignees</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="resolution" className="text-sm font-medium">
              Resolution
            </label>
            <select id="resolution" name="resolution" defaultValue={resolutionFilter} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="all">All resolution states</option>
              <option value="unresolved">Unresolved only</option>
              <option value="resolved">Resolved only</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="teamId" className="text-sm font-medium">
              Team context
            </label>
            <select id="teamId" name="teamId" defaultValue={teamIdParam} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">All teams</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="eventId" className="text-sm font-medium">
              Event context
            </label>
            <select id="eventId" name="eventId" defaultValue={eventIdParam} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">All events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="dueWindow" className="text-sm font-medium">
              Due window
            </label>
            <select id="dueWindow" name="dueWindow" defaultValue={dueWindowFilter} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="all">All due windows</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Upcoming (next 7 days)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="changedWindow" className="text-sm font-medium">
              Recently changed
            </label>
            <select
              id="changedWindow"
              name="changedWindow"
              defaultValue={changedWindowFilter}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="all">All updates</option>
              <option value="last_24h">Updated in last 24 hours</option>
              <option value="last_7d">Updated in last 7 days</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="ownershipIndicator" className="text-sm font-medium">
              Priority / ownership indicator
            </label>
            <select
              id="ownershipIndicator"
              name="ownershipIndicator"
              defaultValue={ownershipIndicatorFilter}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">All priority states</option>
              <option value="urgent">Urgent (overdue or blocked, unresolved)</option>
              <option value="unresolved_owner_linked">Unresolved owner-linked items</option>
              <option value="overdue_owner_linked">Overdue owner-linked items</option>
              <option value="missing_responsible_context">Missing responsible context</option>
              <option value="stale_unresolved">Stale unresolved items</option>
            </select>
          </div>
          {canViewGuardianRelationshipDetails ? (
            <div className="space-y-1">
              <label htmlFor="guardianFollowUp" className="text-sm font-medium">
                Guardian follow-up
              </label>
              <select
                id="guardianFollowUp"
                name="guardianFollowUp"
                defaultValue={guardianFollowUpFilter}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">All guardian contexts</option>
                <option value="involving_guardian">Follow-up may require guardian involvement</option>
                <option value="missing_guardian_linkage">Athlete missing guardian linkage</option>
              </select>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            Apply filters
          </button>
          {hasActiveFilters ? (
            <Link href="/tasks" className="rounded-md border px-3 py-1.5 text-sm">
              Clear filters
            </Link>
          ) : null}
        </div>
      </form>

      {filteredTasks.length === 0 ? (
        hasActiveFilters ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            No follow-up tasks match the selected filters.
          </div>
        ) : (
          <EmptyState
            message="No follow-up tasks have been created yet."
            actionHref="/tasks/new"
            actionLabel="Create the first task"
          />
        )
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">Creator</th>
                <th className="px-4 py-3 font-medium">Due date</th>
                <th className="px-4 py-3 font-medium">Team context</th>
                <th className="px-4 py-3 font-medium">Event context</th>
                <th className="px-4 py-3 font-medium">Ownership indicator</th>
                <th className="px-4 py-3 font-medium">Last updated</th>
                <th className="px-4 py-3 font-medium">Guardian context</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const taskTeams = deriveTaskTeams({
                  sourceEvent: task.sourceEvent,
                  sourceNote: task.sourceNote,
                });
                const overdue = isTaskOverdue(task, now);
                const unresolved =
                  task.status === TaskStatus.OPEN || task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.BLOCKED;
                const urgent = unresolved && (overdue || task.status === TaskStatus.BLOCKED);
                const staleUnresolved = unresolved && task.updatedAt.getTime() < staleUnresolvedCutoff.getTime();
                const missingResponsibleContext = !hasTaskResponsibleContext(task);
                const sourceAthleteGuardianContext =
                  canViewGuardianRelationshipDetails && task.sourceNote?.athlete
                    ? deriveGuardianOperationalContext(task.sourceNote.athlete.athleteLinks ?? [])
                    : null;

                return (
                  <tr key={task.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/tasks/${task.id}`} className="underline">
                        {task.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getTaskStatusBadgeClassName(task.status)}`}
                      >
                        {formatEnumLabel(task.status)}
                      </span>
                      {task.status === TaskStatus.BLOCKED ? (
                        <span className="ml-2 text-xs text-red-700 dark:text-red-300">Blocked</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/people/${task.assignee.id}`} className="underline">
                        {task.assignee.firstName} {task.assignee.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/people/${task.createdBy.id}`} className="underline">
                        {task.createdBy.firstName} {task.createdBy.lastName}
                      </Link>
                    </td>
                    <td className={`px-4 py-3 ${overdue ? "text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-400"}`}>
                      {formatDateTime(task.dueAt)}
                      {overdue ? (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                          Overdue
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {taskTeams.length === 0 ? "—" : taskTeams.map((team) => team.name).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {task.sourceEvent ? (
                        <Link href={`/events/${task.sourceEvent.id}`} className="underline">
                          {task.sourceEvent.title}
                        </Link>
                      ) : task.sourceNote?.event ? (
                        <Link href={`/events/${task.sourceNote.event.id}`} className="underline">
                          {task.sourceNote.event.title}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {urgent ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                            Urgent
                          </span>
                        ) : null}
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Assigned owner
                        </span>
                        {missingResponsibleContext ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Missing responsible context
                          </span>
                        ) : null}
                        {staleUnresolved ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Stale unresolved
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {formatDateTime(task.updatedAt)}
                      {task.updatedAt.getTime() >= now.getTime() - 24 * 60 * 60 * 1000 ? (
                        <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                          Recent
                        </span>
                      ) : null}
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Last updater: not stored (creator:{" "}
                        <Link href={`/people/${task.createdBy.id}`} className="underline">
                          {task.createdBy.firstName} {task.createdBy.lastName}
                        </Link>
                        )
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {!task.sourceNote?.athlete ? (
                        "—"
                      ) : sourceAthleteGuardianContext ? (
                        <span>
                          {formatGuardianOperationalIndicator(sourceAthleteGuardianContext)} ·{" "}
                          {formatGuardianFollowUpDependency(sourceAthleteGuardianContext)}
                        </span>
                      ) : (
                        "Staff-only"
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatSource(task)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
