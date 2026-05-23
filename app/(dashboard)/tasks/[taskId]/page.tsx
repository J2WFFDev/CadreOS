import Link from "next/link";
import { RoleType } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { db } from "@/lib/db";
import { formatDateTime, formatEnumLabel, getTaskStatusBadgeClassName, isTaskOverdue } from "@/lib/follow-up-tasks";
import {
  deriveGuardianOperationalContext,
  formatGuardianFollowUpDependency,
  formatGuardianOperationalIndicator,
} from "@/lib/guardian-operational-context";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Task</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query task details right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Task</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let task:
    | {
        id: string;
        title: string;
        description: string | null;
        status: string;
        dueAt: Date | null;
        assignee: { id: string; firstName: string; lastName: string };
        createdBy: { id: string; firstName: string; lastName: string };
        sourceNote:
          | {
              id: string;
              body: string;
              athlete: {
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
              } | null;
            }
          | null;
        sourceEvent: { id: string; title: string } | null;
        sourceInboxItem: { id: string; category: string; status: string } | null;
      }
    | null = null;
  let queryErrorMessage = "Unable to load task details right now. Please try again later.";
  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canViewGuardianRelationshipDetails = guardianAccess.canViewGuardianRelationshipDetails;

  try {
    task = await db.followUpTask.findFirst({
      where: {
        id: taskId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        dueAt: true,
        assignee: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        sourceNote: {
          select: {
            id: true,
            body: true,
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
          },
        },
        sourceEvent: { select: { id: true, title: true } },
        sourceInboxItem: { select: { id: true, category: true, status: true } },
      },
    });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading tasks.";
    }

    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Task</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{queryErrorMessage}</p>
        </div>
      </section>
    );
  }

  if (!task) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Task</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Task not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  const isOverdue = isTaskOverdue(task);
  const sourceAthleteGuardianContext =
    canViewGuardianRelationshipDetails && task.sourceNote?.athlete
      ? deriveGuardianOperationalContext(task.sourceNote.athlete.athleteLinks ?? [])
      : null;
  const hasUnresolvedOperationalItem = task.status !== "DONE" && task.status !== "CANCELLED";
  const operationalReason =
    task.sourceNote && task.sourceEvent
      ? "Task exists to follow up on a note and event context."
      : task.sourceNote
        ? "Task exists to follow up on operational context captured in a note."
        : task.sourceEvent
          ? "Task exists to follow up on event/attendance operational context."
          : task.sourceInboxItem
            ? "Task exists from an inbox routing source item."
            : "Task was created as a standalone follow-up action.";

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/tasks" label="Tasks" />
        <h2 className="text-2xl font-semibold tracking-tight">{task.title}</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/tasks/${task.id}/edit`}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit task
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Status</dt>
            <dd className="space-x-2">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getTaskStatusBadgeClassName(task.status)}`}>
                {formatEnumLabel(task.status)}
              </span>
              {task.status === "BLOCKED" ? <span className="text-xs text-red-700 dark:text-red-300">Blocked</span> : null}
              {hasUnresolvedOperationalItem ? (
                <span className="text-xs text-amber-700 dark:text-amber-300">Unresolved operational item</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Due date</dt>
            <dd className={isOverdue ? "text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-400"}>
              {formatDateTime(task.dueAt)}
              {isOverdue ? (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                  Overdue
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Assignee</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              <Link href={`/people/${task.assignee.id}`} className="underline">
                {task.assignee.firstName} {task.assignee.lastName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="font-medium">Creator</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              <Link href={`/people/${task.createdBy.id}`} className="underline">
                {task.createdBy.firstName} {task.createdBy.lastName}
              </Link>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Source note</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {task.sourceNote ? (
                <Link href={`/notes/${task.sourceNote.id}`} className="underline">
                  {task.sourceNote.body.length > 100 ? `${task.sourceNote.body.slice(0, 100)}…` : task.sourceNote.body}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Source note athlete</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {task.sourceNote?.athlete ? (
                <Link href={`/people/${task.sourceNote.athlete.id}`} className="underline">
                  {task.sourceNote.athlete.firstName} {task.sourceNote.athlete.lastName}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Guardian context</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {!task.sourceNote?.athlete ? (
                "—"
              ) : sourceAthleteGuardianContext ? (
                <span>
                  {formatGuardianOperationalIndicator(sourceAthleteGuardianContext)} ·{" "}
                  {formatGuardianFollowUpDependency(sourceAthleteGuardianContext)}
                  {sourceAthleteGuardianContext.hasNoGuardianOnFile ? (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      Missing guardian linkage impacting follow-up
                    </span>
                  ) : null}
                </span>
              ) : (
                "Staff-only"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Source event</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {task.sourceEvent ? (
                <span>
                  <Link href={`/events/${task.sourceEvent.id}`} className="underline">
                    {task.sourceEvent.title}
                  </Link>
                  {" · "}
                  <Link href={`/events/${task.sourceEvent.id}#attendance-workflow`} className="underline">
                    Attendance workflow
                  </Link>
                </span>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Source inbox routing item</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {task.sourceInboxItem ? (
                <span>
                  {task.sourceInboxItem.category} · {formatEnumLabel(task.sourceInboxItem.status)} (<code>{task.sourceInboxItem.id}</code>)
                </span>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Why this task exists</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{operationalReason}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Related history views</dt>
            <dd className="flex flex-wrap gap-2 text-zinc-600 dark:text-zinc-400">
              <Link href={`/people/${task.assignee.id}#operational-history`} className="rounded-full border px-2 py-1 text-sm">
                Assignee history
              </Link>
              {task.sourceNote?.athlete ? (
                <Link
                  href={`/people/${task.sourceNote.athlete.id}#operational-history`}
                  className="rounded-full border px-2 py-1 text-sm"
                >
                  Related person history
                </Link>
              ) : null}
              {task.sourceEvent ? (
                <Link href={`/events/${task.sourceEvent.id}#operational-history`} className="rounded-full border px-2 py-1 text-sm">
                  Event history
                </Link>
              ) : null}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Description</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
          {task.description ?? "No description provided."}
        </p>
      </div>
    </section>
  );
}
