import { EntryType } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import { canReadJournalEntry, canReadJournalVersionHistory, resolveJournalAccessContext } from "@/lib/journals/access";
import { labelForJournalVisibility, labelForJournalWorkflowStatus, mapEntryStatusToJournalWorkflowStatus } from "@/lib/journals/policy";
import { labelForJournalVersionChangeType } from "@/lib/journals/versioning";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function formatDateTimeUTC(value: Date): string {
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatPersonName(person: { firstName: string; lastName: string } | null | undefined): string {
  if (!person) return "—";
  const fullName = `${person.firstName} ${person.lastName}`.trim();
  return fullName || "—";
}

export default async function JournalVersionDetailPage({
  params,
}: {
  params: Promise<{ entryId: string; versionId: string }>;
}) {
  const { entryId, versionId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <BackLink href={`/journals/${entryId}`} label="Journal detail" />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load journal version detail right now."} />
      </section>
    );
  }

  const entry = await db.entry.findFirst({
    where: {
      id: entryId,
      organizationId: scope.organizationId,
      type: EntryType.JOURNAL,
      deletedAt: null,
    },
    select: {
      id: true,
      type: true,
      createdByPersonId: true,
      status: true,
      visibility: true,
      teamId: true,
      team: { select: { programId: true } },
    },
  });

  if (!entry) {
    return (
      <section className="space-y-4">
        <BackLink href="/journals" label="Journals" />
        <ErrorMessage message="Journal entry not found in this organization." />
      </section>
    );
  }

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (
    !canReadJournalEntry(accessContext, {
      id: entry.id,
      type: entry.type,
      createdByPersonId: entry.createdByPersonId,
      status: entry.status,
      visibility: entry.visibility,
      teamId: entry.teamId,
      teamProgramId: entry.team?.programId ?? null,
    })
  ) {
    return (
      <section className="space-y-4">
        <BackLink href="/journals" label="Journals" />
        <ErrorMessage message="You do not have permission to view this journal." />
      </section>
    );
  }

  if (!canReadJournalVersionHistory(accessContext, entry)) {
    return (
      <section className="space-y-4">
        <BackLink href={`/journals/${entry.id}`} label="Journal detail" />
        <ErrorMessage message="You do not have permission to view journal version history." />
      </section>
    );
  }

  const version = await db.journalVersion.findFirst({
    where: {
      id: versionId,
      organizationId: scope.organizationId,
      entryId: entry.id,
    },
    select: {
      id: true,
      versionNumber: true,
      changeType: true,
      titleSnapshot: true,
      contentSnapshot: true,
      visibilityAtVersion: true,
      statusAtVersion: true,
      fromStatus: true,
      toStatus: true,
      capturedAt: true,
      changeReason: true,
      capturedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!version) {
    return (
      <section className="space-y-4">
        <BackLink href={`/journals/${entry.id}`} label="Journal detail" />
        <ErrorMessage message="Journal version not found." />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <BackLink href={`/journals/${entry.id}`} label="Journal detail" />
        <h2 className="text-2xl font-semibold tracking-tight">Journal snapshot v{version.versionNumber}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {labelForJournalVersionChangeType(version.changeType)} · {formatDateTimeUTC(version.capturedAt)}
        </p>
      </div>

      <section className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
        <h3 className="font-semibold">Snapshot metadata</h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Captured by</dt>
            <dd>{formatPersonName(version.capturedBy)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Status at version</dt>
            <dd>{labelForJournalWorkflowStatus(mapEntryStatusToJournalWorkflowStatus(version.statusAtVersion))}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Status transition</dt>
            <dd>
              {version.fromStatus ?? "—"} → {version.toStatus}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Visibility at version</dt>
            <dd>{labelForJournalVisibility(version.visibilityAtVersion)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Change reason</dt>
            <dd>{version.changeReason?.trim() || "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
        <h3 className="font-semibold">Title snapshot</h3>
        <p className="mt-2 whitespace-pre-wrap">{version.titleSnapshot}</p>
      </section>

      <section className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
        <h3 className="font-semibold">Body snapshot</h3>
        <p className="mt-2 whitespace-pre-wrap">{version.contentSnapshot?.trim() ? version.contentSnapshot : "No body content captured."}</p>
      </section>
    </section>
  );
}
