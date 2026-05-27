import Link from "next/link";
import { EntryType } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { resolveEntryAccess } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function EntriesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const scope = await getOrganizationScope();
  const params = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="All Entries" description="Unified notes, tasks, events, and decisions." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load entries right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="All Entries" description="Unified notes, tasks, events, and decisions." />
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
        <PageHeader title="All Entries" description="Unified notes, tasks, events, and decisions." />
        <ErrorMessage message="You do not have permission to view entries in this organization." />
      </section>
    );
  }

  const typeParam = readParam(params, "type").toUpperCase();
  const type = Object.values(EntryType).includes(typeParam as EntryType) ? (typeParam as EntryType) : undefined;

  const entries = await db.entry.findMany({
    where: {
      organizationId: scope.organizationId,
      deletedAt: null,
      ...(type ? { type } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, type: true, title: true, status: true, priority: true, dueDate: true, updatedAt: true },
    take: 300,
  });

  return (
    <section className="space-y-4">
      <PageHeader
        title="All Entries"
        description="Unified notes, tasks, events, and decisions."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/entries/inbox" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Inbox
            </Link>
            <Link href="/entries?quickCapture=1" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
              Quick capture
            </Link>
          </div>
        }
      />

      <form className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <label htmlFor="type" className="text-sm font-medium">
          Filter by type
        </label>
        <div className="mt-2 flex gap-2">
          <select id="type" name="type" defaultValue={type ?? ""} className="rounded-md border px-3 py-2 text-sm">
            <option value="">All types</option>
            {Object.values(EntryType).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Apply
          </button>
          <Link href="/entries" className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Clear
          </Link>
        </div>
      </form>

      {entries.length === 0 ? (
        <EmptyState message="No entries match the current filters." actionHref="/dashboard" actionLabel="Back to dashboard" />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Due</th>
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
                  <td className="px-4 py-3">{entry.type}</td>
                  <td className="px-4 py-3">{entry.status}</td>
                  <td className="px-4 py-3">{entry.priority}</td>
                  <td className="px-4 py-3">{entry.dueDate?.toISOString().slice(0, 10) ?? "—"}</td>
                  <td className="px-4 py-3">{entry.updatedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
