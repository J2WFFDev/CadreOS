import Link from "next/link";
import { Prisma, RoleType, TaskStatus } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
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

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
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
  const dueWindowParam = readSearchParam(resolvedSearchParams, "dueWindow");
  const guardianFollowUpParam = readSearchParam(resolvedSearchParams, "guardianFollowUp");
  const statusFilter = Object.values(TaskStatus).includes(statusParam as TaskStatus)
    ? (statusParam as TaskStatus)
    : "";
  const dueWindowFilter =
    dueWindowParam === "overdue" || dueWindowParam === "upcoming" || dueWindowParam === "all"
      ? dueWindowParam
      : "all";
  const guardianFollowUpFilter =
    guardianFollowUpParam === "involving_guardian" || guardianFollowUpParam === "missing_guardian_linkage"
      ? guardianFollowUpParam
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
          event: { team: { id: string; name: string } | null } | null;
        } | null;
        sourceEvent: { id: string; title: string; team: { id: string; name: string } | null } | null;
        sourceInboxItem: { id: string; category: string; status: string } | null;
      }>
    | null = null;
  let people: Array<{ id: string; firstName: string; lastName: string }> = [];
  let teams: Array<{ id: string; name: string }> = [];
  let queryErrorMessage = "Unable to load tasks right now. Please try again later.";

  try {
    const where: Prisma.FollowUpTaskWhereInput = {
      organizationId: scope.organizationId,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(assigneePersonIdParam ? { assigneePersonId: assigneePersonIdParam } : {}),
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

    [tasks, people, teams] = await Promise.all([
      db.followUpTask.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
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
              event: { select: { team: { select: { id: true, name: true } } } },
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
  const filteredTasks = tasks
    .filter((task) => {
      const taskTeams = deriveTaskTeams({
        sourceEvent: task.sourceEvent,
        sourceNote: task.sourceNote,
      });

      if (teamIdParam && !taskTeams.some((team) => team.id === teamIdParam)) {
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

      return true;
    })
    .sort(compareFollowUpTasks);
  const hasActiveFilters =
    Boolean(statusFilter) ||
    Boolean(assigneePersonIdParam) ||
    Boolean(teamIdParam) ||
    dueWindowFilter !== "all" ||
    (canViewGuardianRelationshipDetails && Boolean(guardianFollowUpFilter));

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

      <form method="get" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="grid gap-3 md:grid-cols-5">
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
            <label htmlFor="dueWindow" className="text-sm font-medium">
              Due window
            </label>
            <select id="dueWindow" name="dueWindow" defaultValue={dueWindowFilter} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="all">All due windows</option>
              <option value="overdue">Overdue</option>
              <option value="upcoming">Upcoming (next 7 days)</option>
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
