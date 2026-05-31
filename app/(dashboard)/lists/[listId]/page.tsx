import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { fetchEntryList, labelForEntryListScope } from "@/lib/entries/lists";
import { labelForEntryStatus, labelForEntryType } from "@/lib/operational-feed/render";
import { resolveEntryAccess } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function ListDetailPage({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="List" description="Work list details." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load list right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="List" description="Work list details." />
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  const { organizationId } = scope;

  const entryAccess = await resolveEntryAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (entryAccess.level === "NONE") {
    return (
      <section className="space-y-4">
        <PageHeader title="List" description="Work list details." />
        <ErrorMessage message="You do not have permission to view work items." />
      </section>
    );
  }

  const list = await fetchEntryList({ organizationId, listId });

  if (!list) {
    return (
      <section className="space-y-4">
        <PageHeader title="List not found" description="" />
        <ErrorMessage message="This list does not exist or is not accessible." />
        <Link href="/lists" className="text-sm underline">
          Back to lists
        </Link>
      </section>
    );
  }

  const canWrite = entryAccess.level === "WRITE" || entryAccess.level === "MANAGE";

  const entries = await db.entry.findMany({
    where: { organizationId, listId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      dueDate: true,
      taskCompleted: true,
      createdAt: true,
      assignedTo: { select: { firstName: true, lastName: true } },
    },
  });

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <PageHeader
            title={list.name}
            description={`${labelForEntryListScope(list.scope)} list${list.isInbox ? " · Inbox" : ""}${list.isArchived ? " · Archived" : ""}`}
          />
        </div>
        <div className="flex gap-2">
          {canWrite ? (
            <Link href={`/lists/${list.id}/update`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Edit list
            </Link>
          ) : null}
          <Link href="/lists" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            All lists
          </Link>
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState message="No work items in this list. Assign work items to this list from Work Item detail." />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Assignee</th>
                <th className="px-4 py-2 text-left">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white dark:bg-zinc-900">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  <td className="px-4 py-2">
                    <Link href={`/entries/${entry.id}`} className="font-medium underline">
                      {entry.title}
                    </Link>
                    {entry.taskCompleted ? (
                      <span className="ml-2 text-xs text-zinc-400">✓ complete</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{labelForEntryType(entry.type)}</td>
                  <td className="px-4 py-2 text-zinc-500">{labelForEntryStatus(entry.status)}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {entry.assignedTo
                      ? `${entry.assignedTo.firstName} ${entry.assignedTo.lastName}`.trim()
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-zinc-500">
                    {entry.dueDate ? entry.dueDate.toISOString().slice(0, 10) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
