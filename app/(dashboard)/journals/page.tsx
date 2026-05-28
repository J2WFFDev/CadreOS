import { EntryStatus, EntryType } from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { canCreateJournal, canReadJournalEntry, resolveJournalAccessContext } from "@/lib/journals/access";
import {
  hintForJournalVisibility,
  labelForJournalVisibility,
  labelForJournalWorkflowStatus,
  mapEntryStatusToJournalWorkflowStatus,
} from "@/lib/journals/policy";
import { getOrganizationScope } from "@/lib/organization-context";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const JOURNAL_LIST_LIMIT = 300;

function normalizeStatusFilter(rawStatus: string | string[] | undefined): "active" | "archived" | "all" {
  const value = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  if (value === "archived") return "archived";
  if (value === "all") return "all";
  return "active";
}

function normalizeSingleValue(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function normalizeSourceFilter(
  raw: string | string[] | undefined,
): "all" | "prompted" | "freeform" {
  const value = normalizeSingleValue(raw);
  if (value === "prompted") return "prompted";
  if (value === "freeform") return "freeform";
  return "all";
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

  const accessContext = await resolveJournalAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  const statusFilter = normalizeStatusFilter(params.status);
  const sourceFilter = normalizeSourceFilter(params.source);
  const createdByFilter = normalizeSingleValue(params.createdBy);
  const teamIdFilter = normalizeSingleValue(params.teamId);
  const programIdFilter = normalizeSingleValue(params.programId);

  const journals = await db.entry.findMany({
    where: {
      organizationId: scope.organizationId,
      type: EntryType.JOURNAL,
      deletedAt: null,
      ...(statusFilter === "active"
        ? { status: { not: EntryStatus.ARCHIVED } }
        : statusFilter === "archived"
          ? { status: EntryStatus.ARCHIVED }
          : {}),
      ...(sourceFilter === "prompted"
        ? { journalPromptId: { not: null } }
        : sourceFilter === "freeform"
          ? { journalPromptId: null }
          : {}),
      ...(createdByFilter ? { createdByPersonId: createdByFilter } : {}),
      ...(teamIdFilter ? { teamId: teamIdFilter } : {}),
      ...(programIdFilter ? { team: { programId: programIdFilter } } : {}),
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
      team: { select: { name: true, programId: true, program: { select: { name: true } } } },
      createdBy: { select: { firstName: true, lastName: true } },
      journalPromptId: true,
    },
    take: JOURNAL_LIST_LIMIT,
  });

  const visibleJournals = journals.filter((journal) =>
    canReadJournalEntry(accessContext, {
      id: journal.id,
      type: journal.type,
      createdByPersonId: journal.createdByPersonId,
      status: journal.status,
      visibility: journal.visibility,
      teamId: journal.teamId,
      teamProgramId: journal.team?.programId ?? null,
    }),
  );

  const canCreate = canCreateJournal(accessContext);
  const visibleAuthorOptions = Array.from(
    new Map(
      visibleJournals.map((journal) => [
        journal.createdByPersonId,
        {
          id: journal.createdByPersonId,
          label: `${journal.createdBy.firstName} ${journal.createdBy.lastName}`.trim() || "Unknown",
        },
      ]),
    ).values(),
  ).sort((a, b) => a.label.localeCompare(b.label));
  const visibleTeamOptions = Array.from(
    new Map(
      visibleJournals
        .filter((journal) => Boolean(journal.teamId && journal.team?.name))
        .map((journal) => [journal.teamId!, { id: journal.teamId!, label: journal.team!.name }]),
    ).values(),
  ).sort((a, b) => a.label.localeCompare(b.label));
  const visibleProgramOptions = Array.from(
    new Map(
      visibleJournals
        .filter((journal) => Boolean(journal.team?.programId))
        .map((journal) => [
          journal.team!.programId!,
          { id: journal.team!.programId!, label: journal.team!.program?.name ?? journal.team!.programId! },
        ]),
    ).values(),
  );
  const summaryCounts = visibleJournals.reduce(
    (acc, journal) => {
      const status = mapEntryStatusToJournalWorkflowStatus(journal.status);
      if (status === "DRAFT") acc.draft += 1;
      if (status === "SUBMITTED") acc.submitted += 1;
      if (status === "ARCHIVED") acc.archived += 1;
      if (journal.journalPromptId) acc.prompted += 1;
      return acc;
    },
    { draft: 0, submitted: 0, archived: 0, prompted: 0 },
  );

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
            <Link
              href={`/journals?status=${statusFilter}&source=all`}
              aria-current={sourceFilter === "all" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                sourceFilter === "all" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              All sources
            </Link>
            <Link
              href={`/journals?status=${statusFilter}&source=prompted`}
              aria-current={sourceFilter === "prompted" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                sourceFilter === "prompted" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              Prompted
            </Link>
            <Link
              href={`/journals?status=${statusFilter}&source=freeform`}
              aria-current={sourceFilter === "freeform" ? "page" : undefined}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                sourceFilter === "freeform" ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              Freeform
            </Link>
            {canCreate ? (
              <Link href="/journals/create" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
                Create journal
              </Link>
            ) : null}
          </div>
        }
      />
      <form className="grid gap-2 rounded-lg border bg-white p-3 text-sm dark:bg-zinc-900 md:grid-cols-4" method="get">
        <input type="hidden" name="status" value={statusFilter} />
        <input type="hidden" name="source" value={sourceFilter} />
        <label className="space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Athlete</span>
          <select name="createdBy" defaultValue={createdByFilter ?? ""} className="w-full rounded-md border px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
            <option value="">All visible athletes</option>
            {visibleAuthorOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Team</span>
          <select name="teamId" defaultValue={teamIdFilter ?? ""} className="w-full rounded-md border px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
            <option value="">All visible teams</option>
            {visibleTeamOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Program scope</span>
          <select name="programId" defaultValue={programIdFilter ?? ""} className="w-full rounded-md border px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-800">
            <option value="">All visible programs</option>
            {visibleProgramOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-md border px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Apply
          </button>
          <Link href={`/journals?status=${statusFilter}&source=${sourceFilter}`} className="rounded-md border px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Reset
          </Link>
        </div>
      </form>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Draft</p>
          <p className="text-lg font-semibold">{summaryCounts.draft}</p>
        </div>
        <div className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Submitted</p>
          <p className="text-lg font-semibold">{summaryCounts.submitted}</p>
        </div>
        <div className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Archived</p>
          <p className="text-lg font-semibold">{summaryCounts.archived}</p>
        </div>
        <div className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Prompted responses</p>
          <p className="text-lg font-semibold">{summaryCounts.prompted}</p>
        </div>
      </div>

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
                <th className="px-4 py-3 font-medium">Visibility</th>
                <th className="px-4 py-3 font-medium">Author</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {visibleJournals.map((journal) => {
                const status = mapEntryStatusToJournalWorkflowStatus(journal.status);
                const authorName = `${journal.createdBy.firstName} ${journal.createdBy.lastName}`.trim() || "Unknown";
                return (
                  <tr key={journal.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="mb-1">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {journal.journalPromptId ? "Prompted" : "Freeform"}
                        </span>
                      </p>
                      <Link href={`/journals/${journal.id}`} className="underline">
                        {journal.title}
                      </Link>
                      {journal.team?.name ? <p className="text-xs text-zinc-500">Team: {journal.team.name}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {labelForJournalWorkflowStatus(status)}
                      </span>
                    </td>
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
