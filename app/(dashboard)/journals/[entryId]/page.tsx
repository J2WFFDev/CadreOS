import { EntryType, OperationalGraphNodeType } from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { RelationshipPanel } from "@/components/dashboard/relationship-panel";
import { db } from "@/lib/db";
import {
  canWriteRelationshipSource,
  FOUNDATION_RELATIONSHIP_TYPES,
  type FoundationRelationshipNodeType,
  isFoundationRelationshipNodeType,
  labelForRelationshipDirection,
  listFoundationRelationships,
  searchRelationshipTargets,
} from "@/lib/entry-relationships";
import { parseJournalEntryPayload } from "@/lib/entries/journal-payload";
import {
  canArchiveJournal,
  canEditJournalDraft,
  canRestoreJournal,
  canReadJournalEntry,
  canSubmitJournal,
  hasJournalAdminAccess,
  resolveJournalAccessContext,
} from "@/lib/journals/access";
import {
  labelForJournalPayloadVisibility,
  labelForJournalWorkflowStatus,
  resolveJournalWorkflowStatus,
} from "@/lib/journals/policy";
import { getOrganizationScope } from "@/lib/organization-context";
import { labelForEntryStatus } from "@/lib/operational-feed/render";
import { readFirstSearchParam } from "@/lib/entries/entry-detail-query-state";

export const dynamic = "force-dynamic";

function formatPersonName(person: { firstName: string; lastName: string } | null | undefined) {
  if (!person) return "—";
  const fullName = `${person.firstName} ${person.lastName}`.trim();
  return fullName || "—";
}

function formatDateTimeUTC(value: Date): string {
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export default async function JournalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { entryId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <BackLink href="/journals" label="Journals" />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load journal detail right now."} />
      </section>
    );
  }

  const journal = await db.entry.findFirst({
    where: {
      id: entryId,
      organizationId: scope.organizationId,
      type: EntryType.JOURNAL,
      deletedAt: null,
    },
    select: {
      id: true,
      type: true,
      title: true,
      content: true,
      status: true,
      visibility: true,
      createdByPersonId: true,
      updatedByPersonId: true,
      createdAt: true,
      updatedAt: true,
      teamId: true,
      team: { select: { name: true, programId: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      updatedBy: { select: { firstName: true, lastName: true } },
      journalPromptId: true,
      journalAssignmentId: true,
      journalPrompt: { select: { id: true, title: true, category: true, promptText: true } },
      typePayloads: {
        where: { entryType: EntryType.JOURNAL },
        select: { entryType: true, payloadJson: true },
        take: 1,
      },
    },
  });

  if (!journal) {
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

  const canRead = canReadJournalEntry(accessContext, {
    id: journal.id,
    type: journal.type,
    createdByPersonId: journal.createdByPersonId,
    status: journal.status,
    visibility: journal.visibility,
    teamId: journal.teamId,
    teamProgramId: journal.team?.programId ?? null,
  });

  if (!canRead) {
    return (
      <section className="space-y-4">
        <BackLink href="/journals" label="Journals" />
        <ErrorMessage message="You do not have permission to view this journal." />
      </section>
    );
  }

  const isAuthor = scope.auth.personId === journal.createdByPersonId;
  const isAdmin = hasJournalAdminAccess(accessContext);
  const journalPayload = parseJournalEntryPayload(journal.typePayloads[0]?.payloadJson ?? null);
  const journalStatus = resolveJournalWorkflowStatus(journalPayload.journalStatus, journal.status);

  const canViewBody = isAuthor || isAdmin || journalStatus === "FINAL";
  const canEditDraft = canEditJournalDraft(accessContext, journal);
  const canSubmitDraft = canSubmitJournal(accessContext, journal);
  const canArchive = canArchiveJournal(accessContext, journal);
  const isFinal = journalStatus === "FINAL";
  const isArchived = journalStatus === "ARCHIVED";
  const canReopen = isFinal && (isAuthor || isAdmin);
  const canRestore = isArchived && canRestoreJournal(accessContext, journal);
  const lifecycleHintText =
    isFinal
      ? " · Final journals are read-only until reopened"
      : isArchived
        ? " · Archived journals are preserved and must be restored before editing"
        : "";
  const relationshipTargetTypeParam = readFirstSearchParam(resolvedSearchParams.relationshipTargetType);
  const relationshipTargetType: FoundationRelationshipNodeType = isFoundationRelationshipNodeType(
    relationshipTargetTypeParam?.toUpperCase() ?? "",
  )
    ? relationshipTargetTypeParam!.toUpperCase() as FoundationRelationshipNodeType
    : OperationalGraphNodeType.ENTRY;
  const relationshipQuery = readFirstSearchParam(resolvedSearchParams.relationshipQuery)?.trim() ?? "";
  const relationshipSource = { nodeType: OperationalGraphNodeType.ENTRY, nodeId: journal.id } as const;
  const canCreateRelationships = await canWriteRelationshipSource({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    source: relationshipSource,
  });
  const [relationshipItems, relationshipCandidates] = await Promise.all([
    listFoundationRelationships({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      source: relationshipSource,
      limit: 20,
    }),
    searchRelationshipTargets({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      source: relationshipSource,
      targetNodeType: relationshipTargetType,
      query: relationshipQuery,
      limit: 8,
    }),
  ]);

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <BackLink href="/journals" label="Journals" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{journal.title}</h2>
          <span className="rounded-full border px-2.5 py-1 text-xs font-medium">{labelForJournalWorkflowStatus(journalStatus)}</span>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {labelForJournalPayloadVisibility(journalPayload.journalVisibility)}
          {lifecycleHintText}
        </p>
      </div>

      {journal.journalPrompt ? (
        <article className="rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Prompt response</h3>
            <Link href={`/prompts/${journal.journalPrompt.id}`} className="text-xs underline text-zinc-500">
              View prompt
            </Link>
          </div>
          {journal.journalPrompt.category ? (
            <p className="mt-0.5 text-xs text-zinc-500">{journal.journalPrompt.category}</p>
          ) : null}
          <p className="mt-2 text-sm font-medium">{journal.journalPrompt.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
            {journal.journalPrompt.promptText}
          </p>
        </article>
      ) : null}

      <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Journal body</h3>
        {canViewBody ? (
          <p className="mt-2 whitespace-pre-wrap text-sm">{journal.content?.trim() ? journal.content : "No journal body captured."}</p>
        ) : (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">This journal body is hidden for your role in the current policy scope.</p>
        )}
      </article>

      {/* Arc 24D.7: journal metadata section */}
      <section className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
        <h3 className="font-semibold">Journal metadata</h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Journal date</dt>
            <dd>{journalPayload.journalDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Author</dt>
            <dd>{journalPayload.journalAuthor || formatPersonName(journal.createdBy)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Visibility</dt>
            <dd>{labelForJournalPayloadVisibility(journalPayload.journalVisibility)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Journal status</dt>
            <dd>{labelForJournalWorkflowStatus(journalStatus)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
        <h3 className="font-semibold">Entry metadata</h3>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Team scope</dt>
            <dd>{journal.team?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Created</dt>
            <dd>{formatDateTimeUTC(journal.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Updated</dt>
            <dd>{formatDateTimeUTC(journal.updatedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Last updated by</dt>
            <dd>{formatPersonName(journal.updatedBy)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Operational status</dt>
            <dd>{labelForEntryStatus(journal.status)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">Source</dt>
            <dd>{journal.journalPromptId ? "Prompted" : "Freeform"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Operational status supports internal record handling, while journal status controls the draft, final, and
          archive actions shown for this journal.
        </p>
      </section>

      <RelationshipPanel
        sourceNodeType={OperationalGraphNodeType.ENTRY}
        sourceNodeId={journal.id}
        returnTo={`/journals/${journal.id}`}
        searchPath={`/journals/${journal.id}`}
        canCreate={canCreateRelationships}
        searchTargetType={relationshipTargetType}
        searchQuery={relationshipQuery}
        relationshipItems={relationshipItems}
        candidates={relationshipCandidates}
        relationshipOptions={FOUNDATION_RELATIONSHIP_TYPES.map((value) => ({
          value,
          label: labelForRelationshipDirection(value, "OUTBOUND"),
        }))}
        searchTargetOptions={[OperationalGraphNodeType.ENTRY, OperationalGraphNodeType.HABIT]}
        limitation="List relationships are hidden for now because list visibility is still broader than the conservative permission checks used for relationship linking."
      />

      <div className="flex flex-wrap gap-2">
        {canEditDraft ? (
          <Link href={`/journals/${journal.id}/edit`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Edit draft
          </Link>
        ) : null}

        {canSubmitDraft ? (
          <form action={`/journals/${journal.id}/submit`} method="post">
            <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Submit Final
            </button>
          </form>
        ) : null}

        {canReopen ? (
          <form action={`/journals/${journal.id}/reopen`} method="post">
            <button type="submit" className="rounded-md border border-amber-400 px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300">
              Reopen Journal
            </button>
          </form>
        ) : null}

        {canArchive && !isArchived ? (
          <form action={`/journals/${journal.id}/archive`} method="post">
            <button type="submit" className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300">
              Archive Journal
            </button>
          </form>
        ) : null}

        {canRestore ? (
          <form action={`/journals/${journal.id}/restore`} method="post">
            <button type="submit" className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300">
              Restore Journal
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
