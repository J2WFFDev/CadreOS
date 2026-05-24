import Link from "next/link";
import { NoteVisibility, RoleType } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { getInternalCommunicationEventClassification } from "@/lib/communication-classification";
import { db } from "@/lib/db";
import { getObservationNoteEntryRuntimeSummary } from "@/lib/entry-runtime";
import {
  compareFollowUpTasks,
  formatEnumLabel,
  formatDateTime,
  getTaskStatusBadgeClassName,
  isTaskOverdue,
} from "@/lib/follow-up-tasks";
import {
  deriveGuardianOperationalContext,
  formatGuardianFollowUpDependency,
  formatGuardianOperationalIndicator,
} from "@/lib/guardian-operational-context";
import {
  canReadObservationNoteByVisibility,
  evaluateStaffOnlyContentAccess,
  evaluateTeamScopedContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
} from "@/lib/authorization";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { classifyObservationNoteOperationalVisibility } from "@/lib/operational-visibility";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Note</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query note details right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Note</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let note:
    | {
        id: string;
        body: string;
        visibility: NoteVisibility;
        createdAt: Date;
        updatedAt: Date;
        author: { id: string; firstName: string; lastName: string };
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
        team: { id: string; name: string; programId: string } | null;
        event: { id: string; title: string; teamId: string | null; programId: string } | null;
        tasks: Array<{
          id: string;
          title: string;
          status: string;
          dueAt: Date | null;
          assignee: { id: string; firstName: string; lastName: string };
          sourceEvent: { id: string; title: string } | null;
        }>;
      }
    | null = null;
  const actorRoleContext = await resolveActorRoleContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  const staffAccessDecision = evaluateStaffOnlyContentAccess(actorRoleContext);
  logAuthorizationDecision(staffAccessDecision, {
    workflow: "notes.detail.access",
    entityType: "observationNote",
    entityId: noteId,
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Note</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view notes.
          </p>
        </div>
      </section>
    );
  }
  let queryErrorMessage = "Unable to load note details right now. Please try again later.";

  try {
    note = await db.observationNote.findFirst({
      where: {
        id: noteId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        body: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, firstName: true, lastName: true } },
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
        team: { select: { id: true, name: true, programId: true } },
        event: { select: { id: true, title: true, teamId: true, programId: true } },
        tasks: {
          select: {
            id: true,
            title: true,
            status: true,
            dueAt: true,
            assignee: { select: { id: true, firstName: true, lastName: true } },
            sourceEvent: { select: { id: true, title: true } },
          },
        },
      },
    });
    note?.tasks.sort(compareFollowUpTasks);
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading notes.";
    }

    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Note</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{queryErrorMessage}</p>
        </div>
      </section>
    );
  }

  if (!note) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Note</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Note not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  const visibilityClassification = classifyObservationNoteOperationalVisibility({
    visibility: note.visibility,
    teamId: note.team?.id ?? null,
    eventTeamId: note.event?.teamId ?? null,
    teamProgramId: note.team?.programId ?? null,
    eventProgramId: note.event?.programId ?? null,
  });

  if (visibilityClassification.visibilityClass === "UNRESOLVED") {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Note</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Note visibility is unresolved for the current workflow and cannot be safely displayed.
          </p>
        </div>
      </section>
    );
  }

  if (!canReadObservationNoteByVisibility(actorRoleContext, note.visibility)) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Note</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have access to this note visibility category.
          </p>
        </div>
      </section>
    );
  }

  const teamAccessDecision = evaluateTeamScopedContentAccess(
    actorRoleContext,
    visibilityClassification.teamId,
    visibilityClassification.programId,
  );
  logAuthorizationDecision(teamAccessDecision, {
    workflow: "notes.detail.visibility-scope",
    entityType: "observationNote",
    entityId: note.id,
    metadata: {
      visibilityClass: visibilityClassification.visibilityClass,
      visibilityReason: visibilityClassification.reason,
      noteTeamId: visibilityClassification.teamId,
      noteProgramId: visibilityClassification.programId,
    },
  });

  if (!teamAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Note</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {visibilityClassification.visibilityClass === "TEAM_STAFF"
              ? "You do not have access to this team-scoped note."
              : "You do not have access to this organization-scoped note."}
          </p>
        </div>
      </section>
    );
  }

  let entryRuntimeSummary: Awaited<ReturnType<typeof getObservationNoteEntryRuntimeSummary>> | null = null;
  let entryRuntimeSummaryUnavailable = false;

  try {
    entryRuntimeSummary = await getObservationNoteEntryRuntimeSummary({
      organizationId: scope.organizationId,
      noteId: note.id,
    });
  } catch {
    entryRuntimeSummaryUnavailable = true;
  }

  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canViewGuardianRelationshipDetails = guardianAccess.canViewGuardianRelationshipDetails;

  const noteGuardianContext =
    canViewGuardianRelationshipDetails && note.athlete
      ? deriveGuardianOperationalContext(note.athlete.athleteLinks ?? [])
      : null;
  const unresolvedTaskCount = note.tasks.filter((task) => task.status !== "DONE" && task.status !== "CANCELLED").length;
  const isContextFree = !note.athlete && !note.team && !note.event;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/notes" label="Notes" />
        <h2 className="text-2xl font-semibold tracking-tight">Observation note</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/notes/${note.id}/edit`}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit note
          </Link>
          <Link
            href={`/tasks/new?sourceNoteId=${note.id}`}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Create follow-up task
          </Link>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Author</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              <Link href={`/people/${note.author.id}`} className="underline">
                {note.author.firstName} {note.author.lastName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="font-medium">Visibility</dt>
            <dd className="mt-0.5">
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                {formatEnumLabel(note.visibility)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-medium">Created</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatDateTime(note.createdAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">Updated</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatDateTime(note.updatedAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">Athlete / Person</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {note.athlete ? (
                <Link href={`/people/${note.athlete.id}`} className="underline">
                  {note.athlete.firstName} {note.athlete.lastName}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Guardian context</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {!note.athlete ? (
                "—"
              ) : canViewGuardianRelationshipDetails && noteGuardianContext ? (
                formatGuardianOperationalIndicator(noteGuardianContext)
              ) : (
                "Staff-only"
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Team</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {note.team ? (
                <Link href={`/teams/${note.team.id}`} className="underline">
                  {note.team.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Event</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {note.event ? (
                <span>
                  <Link href={`/events/${note.event.id}`} className="underline">
                    {note.event.title}
                  </Link>
                  {" · "}
                  <Link href={`/events/${note.event.id}#attendance-workflow`} className="underline">
                    Attendance workflow
                  </Link>
                </span>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Operational status</dt>
            <dd className="space-y-1.5 text-zinc-600 dark:text-zinc-400">
              {isContextFree ? (
                <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                  Context-free note — no athlete, team, or event linked
                </span>
              ) : null}
              {unresolvedTaskCount > 0 ? (
                <span className="block">
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    Follow-up pending
                  </span>
                  <span className="ml-2">{unresolvedTaskCount} unresolved linked task{unresolvedTaskCount === 1 ? "" : "s"}</span>
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  No unresolved linked tasks
                </span>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Related history views</dt>
            <dd className="flex flex-wrap gap-2 text-zinc-600 dark:text-zinc-400">
              {note.athlete ? (
                <Link href={`/people/${note.athlete.id}#operational-history`} className="rounded-full border px-2 py-1 text-sm">
                  Person history
                </Link>
              ) : null}
              {note.team ? (
                <Link href={`/teams/${note.team.id}#operational-history`} className="rounded-full border px-2 py-1 text-sm">
                  Team history
                </Link>
              ) : null}
              {note.event ? (
                <Link href={`/events/${note.event.id}#operational-history`} className="rounded-full border px-2 py-1 text-sm">
                  Event history
                </Link>
              ) : null}
              {!note.athlete && !note.team && !note.event ? "—" : null}
            </dd>
          </div>
        </dl>
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
            Entry wrapper metadata is temporarily unavailable. The current <code>ObservationNote</code> workflow remains
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
              <dt className="font-medium">Wrapper author pointer</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{entryRuntimeSummary.entryRuntimeRef.authorPersonId}</dd>
            </div>
            <div>
              <dt className="font-medium">Source linkage</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {formatEnumLabel(entryRuntimeSummary.entryRuntimeRef.sourceModelType)} · {entryRuntimeSummary.entryRuntimeRef.sourceModelId}
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
            No Entry wrapper metadata is linked to this note right now. <code>ObservationNote</code> remains the primary
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
            delivery, messaging, and guardian communication remain deferred.
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Note body</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{note.body}</p>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Related follow-up tasks</h3>
          <Link href={`/tasks/new?sourceNoteId=${note.id}`} className="text-sm underline">
            Create follow-up task
          </Link>
        </div>
        {note.athlete && canViewGuardianRelationshipDetails && noteGuardianContext ? (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Operational guardian dependency: {formatGuardianFollowUpDependency(noteGuardianContext)}.
          </p>
        ) : null}
        {note.tasks.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            No follow-up tasks are linked to this note yet. Create one to track unresolved operational items captured in
            this note.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {note.tasks.map((task) => (
              <li key={task.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/tasks/${task.id}`} className="font-medium underline">
                    {task.title}
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${getTaskStatusBadgeClassName(task.status)}`}
                  >
                    {formatEnumLabel(task.status)}
                  </span>
                  {task.status !== "DONE" && task.status !== "CANCELLED" ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      Follow-up pending
                    </span>
                  ) : null}
                </div>
                <p
                  className={`mt-1 text-sm ${
                    isTaskOverdue(task) ? "text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Assignee:{" "}
                  <Link href={`/people/${task.assignee.id}`} className="underline">
                    {task.assignee.firstName} {task.assignee.lastName}
                  </Link>
                  {" · "}Due: {formatDateTime(task.dueAt)}
                  {isTaskOverdue(task) ? (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                      Overdue
                    </span>
                  ) : null}
                </p>
                {task.sourceEvent ? (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Event:{" "}
                    <Link href={`/events/${task.sourceEvent.id}`} className="underline">
                      {task.sourceEvent.title}
                    </Link>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
        <strong className="font-medium">Future scope (deferred):</strong> Inbox routing, feed behavior, journal entries, and messaging are intentionally not implemented yet. Current notes use the <code>ObservationNote</code> model. A unified Entry/Inbox migration is planned but deferred.
      </div>
    </section>
  );
}
