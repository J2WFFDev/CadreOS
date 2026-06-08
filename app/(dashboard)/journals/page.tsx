import { EntryStatus, EntryType } from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { canCreateJournal, resolveJournalAccessContext } from "@/lib/journals/access";
import {
  buildEntryOpsTypeAwareVisibilityWhere,
  resolveEntryOpsAllWorkDefaultVisibility,
} from "@/lib/entryops/visibility";
import { parseJournalEntryPayload } from "@/lib/entries/journal-payload";
import {
  hintForJournalVisibility,
  labelForJournalVisibility,
  labelForJournalWorkflowStatus,
  resolveJournalWorkflowStatus,
} from "@/lib/journals/policy";
import { getOrganizationScope } from "@/lib/organization-context";
import { db } from "@/lib/db";
import { labelForEntryStatus } from "@/lib/operational-feed/render";
import { describeSchemaUnavailableError, isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const JOURNAL_LIST_LIMIT = 300;

function normalizeStatusFilter(rawStatus: string | string[] | undefined): "active" | "archived" | "all" {
  const value = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  if (value === "archived") return "archived";
  if (value === "all") return "all";
  return "active";
}

export default async function JournalsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const scope = await getOrganizationScope();
  const params = await searchParams;

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Journals" description="Draft, submit, and archive sensitive journal entries." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load journals right now."} />
      </section>
    );
  }

  const statusFilter = normalizeStatusFilter(params.status);
  let accessContext:
    | Awaited<ReturnType<typeof resolveJournalAccessContext>>
    | null = null;
  let journals:
    | Array<{
        id: string;
        type: EntryType;
        title: string;
        status: EntryStatus;
        visibility: "STAFF_ONLY" | "TEAM_STAFF" | "ORGANIZATION_SCOPED";
        createdAt: Date;
        updatedAt: Date;
        createdByPersonId: string;
        teamId: string | null;
        team: { name: string; programId: string } | null;
        createdBy: { firstName: string; lastName: string };
        typePayloads: Array<{ payloadJson: string | null }>;
      }>
    | null = null;
  let loadErrorMessage: string | null = null;

  try {
    accessContext = await resolveJournalAccessContext({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
    });
    const entryVisibility = resolveEntryOpsAllWorkDefaultVisibility(accessContext);

    journals = await db.entry.findMany({
      where: {
        organizationId: scope.organizationId,
        type: EntryType.JOURNAL,
        deletedAt: null,
        ...(statusFilter === "active"
          ? { status: { not: EntryStatus.ARCHIVED } }
          : statusFilter === "archived"
            ? { status: EntryStatus.ARCHIVED }
            : {}),
        AND: [buildEntryOpsTypeAwareVisibilityWhere(accessContext, entryVisibility)],
      },
      orderBy: [{ updatedAt: "desc" }],
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        visibility: true,
        createdAt: true,
        updatedAt: true,
        createdByPersonId: true,
        teamId: true,
        team: { select: { name: true, programId: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        typePayloads: {
          where: { entryType: EntryType.JOURNAL },
          select: { payloadJson: true },
          take: 1,
        },
      },
      take: JOURNAL_LIST_LIMIT,
    });
  } catch (error) {
    const detail = describeSchemaUnavailableError(error);
    loadErrorMessage = isSchemaUnavailableError(error)
      ? `Journals are currently unavailable because ${detail ?? "required journal tables/columns are missing"}.`
      : "Unable to load journals right now.";
    console.error("[journals.page] Failed to load journals", {
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      schemaDetail: detail,
      error,
    });
  }

  if (!accessContext || !journals) {
    return (
      <section className="space-y-4">
        <PageHeader title="Journals" description="Draft, submit, and archive sensitive journal entries." />
        <ErrorMessage message={loadErrorMessage ?? "Unable to load journals right now."} />
      </section>
    );
  }

  const visibleJournals = journals;

  const canCreate = canCreateJournal(accessContext);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Journals"
        description="Draft, submit, and archive sensitive journal entries with role-aware access."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/journals?status=active"
              aria-current={statusFilter === "active" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                statusFilter === "active" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              Active
            </Link>
            <Link
              href="/journals?status=archived"
              aria-current={statusFilter === "archived" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                statusFilter === "archived" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              Archived
            </Link>
            <Link
              href="/journals?status=all"
              aria-current={statusFilter === "all" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                statusFilter === "all" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              All
            </Link>
            {canCreate ? (
              <Link href="/journals/create" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
                Create journal
              </Link>
            ) : null}
          </div>
        }
      />

      {visibleJournals.length === 0 ? (
        <EmptyState
          message="No journals are visible for the selected filter and role scope."
          actionHref={canCreate ? "/journals/create" : "/dashboard"}
          actionLabel={canCreate ? "Create first journal" : "Back to dashboard"}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Journal</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Operational Status</th>
                <th className="px-4 py-3 font-medium">Visibility</th>
                <th className="px-4 py-3 font-medium">Author</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {visibleJournals.map((journal) => {
                const payload = parseJournalEntryPayload(journal.typePayloads[0]?.payloadJson ?? null);
                const journalStatus = resolveJournalWorkflowStatus(payload.journalStatus, journal.status);
                const authorName = `${journal.createdBy.firstName} ${journal.createdBy.lastName}`.trim() || "Unknown";
                return (
                  <tr key={journal.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/journals/${journal.id}`} className="underline">
                        {journal.title}
                      </Link>
                      {journal.team?.name ? <p className="text-xs text-zinc-500">Team: {journal.team.name}</p> : null}
                    </td>
                    <td className="px-4 py-3">{labelForJournalWorkflowStatus(journalStatus)}</td>
                    <td className="px-4 py-3">{labelForEntryStatus(journal.status)}</td>
                    <td className="px-4 py-3">
                      <p>{labelForJournalVisibility(journal.visibility)}</p>
                      <p className="text-xs text-zinc-500">{hintForJournalVisibility(journal.visibility)}</p>
                    </td>
                    <td className="px-4 py-3">{authorName}</td>
                    <td className="px-4 py-3 text-zinc-500">{journal.updatedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
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
