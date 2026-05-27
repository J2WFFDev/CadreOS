import Link from "next/link";
import { NoteVisibility, RoleType } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { getInternalCommunicationEventClassification } from "@/lib/communication-classification";
import { db } from "@/lib/db";
import { getFollowUpTaskEntryRuntimeSummary } from "@/lib/entry-runtime";
import { formatDateTime, formatEnumLabel, getTaskStatusBadgeClassName, isTaskOverdue } from "@/lib/follow-up-tasks";
import {
  deriveGuardianOperationalContext,
  formatGuardianFollowUpDependency,
  formatGuardianOperationalIndicator,
} from "@/lib/guardian-operational-context";
import {
  evaluateFollowUpTaskAccess,
  evaluateStaffOnlyContentAccess,
  evaluateTeamScopedContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
} from "@/lib/authorization";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { appendReturnToParam, resolveSafeReturnPath } from "@/lib/navigation-context";
import { classifyFollowUpTaskOperationalVisibility } from "@/lib/operational-visibility";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { taskId } = await params;
  const resolvedSearchParams = await searchParams;
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

  const actorRoleContext = await resolveActorRoleContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  const staffAccessDecision = evaluateStaffOnlyContentAccess(actorRoleContext);
  logAuthorizationDecision(staffAccessDecision, {
    workflow: "tasks.detail.access",
    entityType: "followUpTask",
    entityId: taskId,
  });

  if (!staffAccessDecision.allowed && !actorRoleContext.actorPersonId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Task</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your account is not linked to a person record and cannot access task details.
          </p>
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
              visibility: NoteVisibility;
              eventId: string | null;
              teamId: string | null;
              team: { programId: string } | null;
              event: { id: string; teamId: string | null; programId: string } | null;
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
        sourceEvent: { id: string; title: string; teamId: string | null; programId: string } | null;
        sourceInboxItem: { id: string; category: string; status: string } | null;
        entry: {
          id: string;
          parentEntryId: string | null;
          parentEntry: { id: string; title: string; deletedAt: Date | null } | null;
        } | null;
      }
    | null = null;
  let queryErrorMessage = "Unable to load task details right now. Please try again later.";

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
            visibility: true,
            eventId: true,
            teamId: true,
            team: { select: { programId: true } },
            event: { select: { id: true, teamId: true, programId: true } },
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
        sourceEvent: { select: { id: true, title: true, teamId: true, programId: true } },
        sourceInboxItem: { select: { id: true, category: true, status: true } },
         entry: {
           select: {
             id: true,
             parentEntryId: true,
             parentEntry: { select: { id: true, title: true, deletedAt: true } },
           },
         },
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

  const taskAccessDecision = evaluateFollowUpTaskAccess(actorRoleContext, {
    assigneePersonId: task.assignee.id,
    createdByPersonId: task.createdBy.id,
  });
  logAuthorizationDecision(taskAccessDecision, {
    workflow: "tasks.detail.ownership",
    entityType: "followUpTask",
    entityId: task.id,
    metadata: {
      assigneePersonId: task.assignee.id,
      createdByPersonId: task.createdBy.id,
    },
  });

  if (!taskAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Task</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have access to this task.
          </p>
        </div>
      </section>
    );
  }

  const visibilityClassification = classifyFollowUpTaskOperationalVisibility({
    sourceNoteId: task.sourceNote?.id ?? null,
    sourceEventId: task.sourceEvent?.id ?? null,
    sourceNoteVisibility: task.sourceNote?.visibility,
    sourceNoteEventId: task.sourceNote?.eventId ?? null,
    sourceEventTeamId: task.sourceEvent?.teamId ?? null,
    sourceEventProgramId: task.sourceEvent?.programId ?? null,
    sourceNoteTeamId: task.sourceNote?.teamId ?? null,
    sourceNoteTeamProgramId: task.sourceNote?.team?.programId ?? null,
    sourceNoteEventTeamId: task.sourceNote?.event?.teamId ?? null,
    sourceNoteEventProgramId: task.sourceNote?.event?.programId ?? null,
  });

  if (visibilityClassification.visibilityClass === "UNRESOLVED") {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Task</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Task visibility context is unresolved for this workflow and cannot be safely displayed.
          </p>
        </div>
      </section>
    );
  }

  if (actorRoleContext.isStaffMember) {
    const teamAccessDecision = evaluateTeamScopedContentAccess(
      actorRoleContext,
      visibilityClassification.teamId,
      visibilityClassification.programId,
    );
    logAuthorizationDecision(teamAccessDecision, {
      workflow: "tasks.detail.visibility-scope",
      entityType: "followUpTask",
      entityId: task.id,
      metadata: {
        visibilityClass: visibilityClassification.visibilityClass,
        visibilityReason: visibilityClassification.reason,
        taskTeamId: visibilityClassification.teamId,
        taskProgramId: visibilityClassification.programId,
      },
    });

    if (!teamAccessDecision.allowed) {
      return (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Task</h2>
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {visibilityClassification.visibilityClass === "TEAM_STAFF"
                ? "You do not have access to this team-scoped task."
                : "You do not have access to this organization-scoped task."}
            </p>
          </div>
        </section>
      );
    }
  }

  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canViewGuardianRelationshipDetails = guardianAccess.canViewGuardianRelationshipDetails;

  const isOverdue = isTaskOverdue(task);
  const sourceAthleteGuardianContext =
    canViewGuardianRelationshipDetails && task.sourceNote?.athlete
      ? deriveGuardianOperationalContext(task.sourceNote.athlete.athleteLinks ?? [])
      : null;
  const hasUnresolvedOperationalItem = task.status !== "DONE" && task.status !== "CANCELLED";
  const hasNoSourceContext = !task.sourceNote && !task.sourceEvent && !task.sourceInboxItem;
  const isOrphanedWorkflowState = hasUnresolvedOperationalItem && task.status === "BLOCKED" && hasNoSourceContext;
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
  const returnToRaw = resolvedSearchParams.returnTo;
  const returnToValue = Array.isArray(returnToRaw) ? (returnToRaw[0] ?? "") : (returnToRaw ?? "");
  const returnTo = resolveSafeReturnPath(returnToValue, "/tasks");
  const editTaskHref = appendReturnToParam(`/tasks/${task.id}/edit`, `/tasks/${task.id}?returnTo=${encodeURIComponent(returnTo)}`);
  const entryDetailHref = task.entry ? `/entries/${task.entry.id}` : null;
  const sourceEntryHref =
    task.entry?.parentEntry && !task.entry.parentEntry.deletedAt ? `/entries/${task.entry.parentEntry.id}` : null;
  let entryRuntimeSummary: Awaited<ReturnType<typeof getFollowUpTaskEntryRuntimeSummary>> | null = null;
  let entryRuntimeSummaryUnavailable = false;

  try {
    entryRuntimeSummary = await getFollowUpTaskEntryRuntimeSummary({
      organizationId: scope.organizationId,
      taskId: task.id,
    });
  } catch {
    entryRuntimeSummaryUnavailable = true;
  }

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href={returnTo} label="Tasks" />
        <h2 className="text-2xl font-semibold tracking-tight">{task.title}</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={editTaskHref}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit task
          </Link>
          {entryDetailHref ? (
            <Link
              href={entryDetailHref}
              className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Open entry
            </Link>
          ) : null}
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
              {isOrphanedWorkflowState ? (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                  Orphaned workflow state — blocked with no source context
                </span>
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
            <dt className="font-medium">Source entry</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {sourceEntryHref ? (
                <Link href={sourceEntryHref} className="underline">
                  {task.entry?.parentEntry?.title ?? "Open source entry"}
                </Link>
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

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Entry wrapper</h3>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              entryRuntimeSummary?.status === "linked"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
            }`}
          >
            {entryRuntimeSummary?.status === "linked" ? "Linked metadata present" : "No linked metadata"}
          </span>
        </div>
        {entryRuntimeSummaryUnavailable ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Entry wrapper metadata is temporarily unavailable. The current <code>FollowUpTask</code> workflow remains
            authoritative.
          </p>
        ) : entryRuntimeSummary?.status === "linked" ? (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium">Entry wrapper ID</dt>
              <dd className="break-all text-zinc-600 dark:text-zinc-400">{entryRuntimeSummary.entryRuntimeRef.id}</dd>
            </div>
            <div>
              <dt className="font-medium">Entry kind</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {formatEnumLabel(entryRuntimeSummary.entryRuntimeRef.entryKind)}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Visibility mirror</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {formatEnumLabel(entryRuntimeSummary.entryRuntimeRef.visibilityClass)}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Communication classification (internal)</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {entryRuntimeSummary.communicationClassification.categoryLabel}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Notification candidate (internal)</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {entryRuntimeSummary.notificationCandidateEvaluation.candidateLabel ?? "No active candidate"}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Wrapper author pointer</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{entryRuntimeSummary.entryRuntimeRef.authorPersonId}</dd>
            </div>
            <div>
              <dt className="font-medium">Source linkage</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {formatEnumLabel(entryRuntimeSummary.entryRuntimeRef.sourceModelType)} ·{" "}
                {entryRuntimeSummary.entryRuntimeRef.sourceModelId}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Linked athlete pointer</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{entryRuntimeSummary.entryRuntimeRef.athletePersonId ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium">Linked team pointer</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{entryRuntimeSummary.entryRuntimeRef.teamId ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium">Linked event pointer</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{entryRuntimeSummary.entryRuntimeRef.eventId ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium">Wrapper updated</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {formatDateTime(entryRuntimeSummary.entryRuntimeRef.updatedAt)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium">Relationship detail view</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                <Link href={`/entry-runtime/${entryRuntimeSummary.entryRuntimeRef.id}`} className="underline">
                  Open read-only Entry relationship detail
                </Link>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No Entry wrapper metadata is linked to this task right now. <code>FollowUpTask</code> remains the primary
            operational record, and disabling sidecar writes remains a safe rollback path.
          </p>
        )}
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          This wrapper is metadata-only for ownership, visibility, relationship linkage, and traceability. Feed, Inbox,
          Journal, messaging, notifications, guardian-facing runtime, and workflow automation remain deferred.
        </p>
        {entryRuntimeSummary?.status === "linked" ? (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Classification is internal-only ({getInternalCommunicationEventClassification(entryRuntimeSummary.communicationClassification.category).categoryLabel});
            notification candidate evaluation is metadata-only ({entryRuntimeSummary.notificationCandidateEvaluation.candidateLabel ?? "no active candidate"});
            delivery, messaging, and guardian communication remain deferred.
          </p>
        ) : null}
      </div>
    </section>
  );
}
