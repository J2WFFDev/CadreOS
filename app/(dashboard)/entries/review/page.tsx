import Link from "next/link";
import { EntryType } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { queryReviewEntries } from "@/lib/operational-feed";
import { formatDueDate, labelForEntryStatus, labelForEntryType } from "@/lib/operational-feed/render";
import { resolveEntryAccess } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const REVIEW_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "All types" },
  { value: EntryType.TASK, label: "Tasks" },
  { value: EntryType.FOLLOW_UP, label: "Follow-ups" },
  { value: EntryType.DECISION, label: "Decisions" },
  { value: EntryType.JOURNAL, label: "Journals" },
  { value: EntryType.EVENT, label: "Events" },
];

function formatAssigneeName(assignedTo: { firstName: string; lastName: string } | null): string {
  if (!assignedTo) return "—";
  return `${assignedTo.firstName} ${assignedTo.lastName}`.trim() || "—";
}

export default async function EntryReviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const scope = await getOrganizationScope();
  const params = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Review" description="Completed, cancelled, and archived work." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load the review view right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Review" description="Completed, cancelled, and archived work." />
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  const entryAccess = await resolveEntryAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (entryAccess.level === "NONE") {
    return (
      <section className="space-y-4">
        <PageHeader title="Review" description="Completed, cancelled, and archived work." />
        <ErrorMessage message="You do not have permission to view the review list in this organization." />
      </section>
    );
  }

  const rawType = readParam(params, "type");
  const resolvedType = Object.values(EntryType).includes(rawType as EntryType)
    ? (rawType as EntryType)
    : undefined;

  const entries = await queryReviewEntries(
    { organizationId: scope.organizationId, actorPersonId: scope.auth.personId },
    { type: resolvedType },
  );

  return (
    <section className="space-y-4">
      <PageHeader
        title="Review"
        description="Completed, cancelled, and archived work ready for retrospective review."
      />

      {/* Type filter */}
      <form className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="type" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Type
            </label>
            <select
              id="type"
              name="type"
              defaultValue={rawType}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              {REVIEW_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Apply
          </button>
          {rawType && (
            <Link href="/entries/review" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Clear
            </Link>
          )}
        </div>
      </form>

      {entries.length === 0 ? (
        <EmptyState
          message={
            rawType
              ? `No completed or archived ${labelForEntryType(rawType as EntryType).toLowerCase()} entries.`
              : "No completed or archived entries yet. Completed and cancelled work will appear here."
          }
          actionHref="/today"
          actionLabel="Go to Today"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/entries/${entry.id}`} className="underline">
                      {entry.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{labelForEntryType(entry.type)}</td>
                  <td className="px-4 py-3">{labelForEntryStatus(entry.status)}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDueDate(entry.dueDate, entry.dueTime) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{formatAssigneeName(entry.assignedTo)}</td>
                  <td className="px-4 py-3 text-zinc-500">{entry.updatedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
