import Link from "next/link";
import { EntryRuntimeSourceModelType, EntryRuntimeVisibilityClass } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { db } from "@/lib/db";
import { formatDateTime, formatEnumLabel, getTaskStatusBadgeClassName } from "@/lib/follow-up-tasks";
import {
  evaluateStaffOnlyContentAccess,
  evaluateTeamScopedContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
} from "@/lib/authorization";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function EntryRuntimeDetailPage({
  params,
}: {
  params: Promise<{ entryRuntimeRefId: string }>;
}) {
  const { entryRuntimeRefId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Entry relationship</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query entry relationship details right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Entry relationship</h2>
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
    workflow: "entry-runtime.detail.access",
    entityType: "entryRuntimeRef",
    entityId: entryRuntimeRefId,
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Entry relationship</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view entry relationship metadata.
          </p>
        </div>
      </section>
    );
  }

  let entryRuntimeRef:
    | {
        id: string;
        organizationId: string;
        sourceModelType: EntryRuntimeSourceModelType;
        sourceModelId: string;
        entryKind: string;
        authorPersonId: string;
        visibilityClass: EntryRuntimeVisibilityClass;
        athletePersonId: string | null;
        teamId: string | null;
        eventId: string | null;
        createdAt: Date;
        updatedAt: Date;
        author: { id: string; firstName: string; lastName: string };
      }
    | null = null;

  let queryErrorMessage = "Unable to load entry relationship details right now. Please try again later.";

  try {
    entryRuntimeRef = await db.entryRuntimeRef.findFirst({
      where: {
        id: entryRuntimeRefId,
        organizationId: scope.organizationId,
      },
      select: {
        id: true,
        organizationId: true,
        sourceModelType: true,
        sourceModelId: true,
        entryKind: true,
        authorPersonId: true,
        visibilityClass: true,
        athletePersonId: true,
        teamId: true,
        eventId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading entry relationships.";
    }

    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Entry relationship</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{queryErrorMessage}</p>
        </div>
      </section>
    );
  }

  if (!entryRuntimeRef) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Entry relationship</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Entry relationship record not found in the selected organization.
          </p>
        </div>
      </section>
    );
  }

  if (entryRuntimeRef.visibilityClass === EntryRuntimeVisibilityClass.TEAM_STAFF && !entryRuntimeRef.teamId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Entry relationship</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Entry visibility context is unresolved for team-scoped access and cannot be safely displayed.
          </p>
        </div>
      </section>
    );
  }

  const linkedTeam = entryRuntimeRef.teamId
    ? await db.team.findFirst({
        where: {
          id: entryRuntimeRef.teamId,
          organizationId: scope.organizationId,
        },
        select: { id: true, name: true, programId: true },
      })
    : null;
  const linkedEvent = entryRuntimeRef.eventId
    ? await db.event.findFirst({
        where: {
          id: entryRuntimeRef.eventId,
          organizationId: scope.organizationId,
        },
        select: { id: true, title: true, teamId: true, programId: true },
      })
    : null;

  if (entryRuntimeRef.visibilityClass !== EntryRuntimeVisibilityClass.STAFF_ONLY) {
    const teamScopeAccessDecision = evaluateTeamScopedContentAccess(
      actorRoleContext,
      entryRuntimeRef.teamId,
      linkedTeam?.programId ?? linkedEvent?.programId ?? null,
    );
    logAuthorizationDecision(teamScopeAccessDecision, {
      workflow: "entry-runtime.detail.visibility-scope",
      entityType: "entryRuntimeRef",
      entityId: entryRuntimeRef.id,
      metadata: {
        visibilityClass: entryRuntimeRef.visibilityClass,
        entryTeamId: entryRuntimeRef.teamId,
        entryEventId: entryRuntimeRef.eventId,
      },
    });

    if (!teamScopeAccessDecision.allowed) {
      return (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Entry relationship</h2>
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {entryRuntimeRef.visibilityClass === EntryRuntimeVisibilityClass.TEAM_STAFF
                ? "You do not have access to this team-scoped entry relationship."
                : "You do not have access to this organization-scoped entry relationship."}
            </p>
          </div>
        </section>
      );
    }
  }

  const linkedObservationNote =
    entryRuntimeRef.sourceModelType === EntryRuntimeSourceModelType.OBSERVATION_NOTE
      ? await db.observationNote.findFirst({
          where: {
            id: entryRuntimeRef.sourceModelId,
            organizationId: scope.organizationId,
          },
          select: {
            id: true,
            body: true,
            visibility: true,
            createdAt: true,
            updatedAt: true,
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        })
      : null;

  const linkedFollowUpTask =
    entryRuntimeRef.sourceModelType === EntryRuntimeSourceModelType.FOLLOW_UP_TASK
      ? await db.followUpTask.findFirst({
          where: {
            id: entryRuntimeRef.sourceModelId,
            organizationId: scope.organizationId,
          },
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
                visibility: true,
              },
            },
          },
        })
      : null;
  const linkedObservationNoteFromTask = linkedFollowUpTask?.sourceNote ?? null;
  const linkedObservationNoteRecord = linkedObservationNote ?? linkedObservationNoteFromTask;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/dashboard" label="Dashboard" />
        <h2 className="text-2xl font-semibold tracking-tight">Entry relationship (read-only)</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This surface is metadata-only and intentionally read-only. Existing note/task workflows remain authoritative.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Entry wrapper record</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Entry wrapper ID</dt>
            <dd className="break-all text-zinc-600 dark:text-zinc-400">{entryRuntimeRef.id}</dd>
          </div>
          <div>
            <dt className="font-medium">Entry kind</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatEnumLabel(entryRuntimeRef.entryKind)}</dd>
          </div>
          <div>
            <dt className="font-medium">Source linkage</dt>
            <dd className="break-all text-zinc-600 dark:text-zinc-400">
              {formatEnumLabel(entryRuntimeRef.sourceModelType)} · {entryRuntimeRef.sourceModelId}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Organization scope</dt>
            <dd className="break-all text-zinc-600 dark:text-zinc-400">{entryRuntimeRef.organizationId}</dd>
          </div>
          <div>
            <dt className="font-medium">Wrapper created</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatDateTime(entryRuntimeRef.createdAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">Wrapper updated</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatDateTime(entryRuntimeRef.updatedAt)}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Ownership and visibility metadata</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Wrapper author pointer</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              <Link href={`/people/${entryRuntimeRef.author.id}`} className="underline">
                {entryRuntimeRef.author.firstName} {entryRuntimeRef.author.lastName}
              </Link>
              <span className="ml-2 text-xs">({entryRuntimeRef.authorPersonId})</span>
            </dd>
          </div>
          <div>
            <dt className="font-medium">Visibility class</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">{formatEnumLabel(entryRuntimeRef.visibilityClass)}</dd>
          </div>
          <div>
            <dt className="font-medium">Linked athlete pointer</dt>
            <dd className="break-all text-zinc-600 dark:text-zinc-400">{entryRuntimeRef.athletePersonId ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium">Linked team pointer</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {linkedTeam ? (
                <Link href={`/teams/${linkedTeam.id}`} className="underline">
                  {linkedTeam.name}
                </Link>
              ) : (
                "—"
              )}
              {entryRuntimeRef.teamId ? <span className="ml-2 text-xs">({entryRuntimeRef.teamId})</span> : null}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Linked event pointer</dt>
            <dd className="text-zinc-600 dark:text-zinc-400">
              {linkedEvent ? (
                <Link href={`/events/${linkedEvent.id}`} className="underline">
                  {linkedEvent.title}
                </Link>
              ) : (
                "—"
              )}
              {entryRuntimeRef.eventId ? <span className="ml-2 text-xs">({entryRuntimeRef.eventId})</span> : null}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Linked ObservationNote</h3>
        {linkedObservationNoteRecord ? (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium">Record</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                <Link href={`/notes/${linkedObservationNoteRecord.id}`} className="underline">
                  Open note detail
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-medium">Visibility</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{formatEnumLabel(linkedObservationNoteRecord.visibility)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium">Body preview</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {linkedObservationNoteRecord.body.length > 180
                  ? `${linkedObservationNoteRecord.body.slice(0, 180)}…`
                  : linkedObservationNoteRecord.body}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {entryRuntimeRef.sourceModelType === EntryRuntimeSourceModelType.OBSERVATION_NOTE
              ? "No linked ObservationNote record was found in this organization."
              : "No ObservationNote linkage applies to this entry record."}
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-semibold">Linked FollowUpTask</h3>
        {linkedFollowUpTask ? (
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium">Record</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                <Link href={`/tasks/${linkedFollowUpTask.id}`} className="underline">
                  Open task detail
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-medium">Status</dt>
              <dd>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getTaskStatusBadgeClassName(linkedFollowUpTask.status)}`}
                >
                  {formatEnumLabel(linkedFollowUpTask.status)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="font-medium">Assignee</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                <Link href={`/people/${linkedFollowUpTask.assignee.id}`} className="underline">
                  {linkedFollowUpTask.assignee.firstName} {linkedFollowUpTask.assignee.lastName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-medium">Creator</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                <Link href={`/people/${linkedFollowUpTask.createdBy.id}`} className="underline">
                  {linkedFollowUpTask.createdBy.firstName} {linkedFollowUpTask.createdBy.lastName}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="font-medium">Due</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{formatDateTime(linkedFollowUpTask.dueAt)}</dd>
            </div>
            <div>
              <dt className="font-medium">Task updated</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{formatDateTime(linkedFollowUpTask.updatedAt)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium">Title</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">{linkedFollowUpTask.title}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium">Source note context</dt>
              <dd className="text-zinc-600 dark:text-zinc-400">
                {linkedFollowUpTask.sourceNote ? (
                  <span>
                    <Link href={`/notes/${linkedFollowUpTask.sourceNote.id}`} className="underline">
                      Linked note
                    </Link>
                    <span className="ml-2 text-xs">{formatEnumLabel(linkedFollowUpTask.sourceNote.visibility)}</span>
                  </span>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {entryRuntimeRef.sourceModelType === EntryRuntimeSourceModelType.FOLLOW_UP_TASK
              ? "No linked FollowUpTask record was found in this organization."
              : "No FollowUpTask linkage applies to this entry record."}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-400">
        <strong className="font-medium">Intentionally deferred:</strong> Feed, Inbox, Journal, messaging, notifications,
        guardian-facing runtime behavior, and workflow automation are not implemented in this view.
      </div>
    </section>
  );
}
