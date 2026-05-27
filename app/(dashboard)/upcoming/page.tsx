import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { queryUpcomingEntries } from "@/lib/operational-feed";
import { formatDueDate, labelForEntryPriority, labelForEntryStatus, labelForEntryType } from "@/lib/operational-feed/render";
import { resolveEntryAccess } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function formatAssigneeName(assignedTo: { firstName: string; lastName: string } | null): string {
  if (!assignedTo) return "—";
  return `${assignedTo.firstName} ${assignedTo.lastName}`.trim() || "—";
}

export default async function UpcomingPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Upcoming" description="Look ahead at scheduled operational items." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load upcoming items right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Upcoming" description="Look ahead at scheduled operational items." />
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
        <PageHeader title="Upcoming" description="Look ahead at scheduled operational items." />
        <ErrorMessage message="You do not have permission to view upcoming work items in this organization." />
      </section>
    );
  }

  const now = new Date();
  const entries = await queryUpcomingEntries({ organizationId: scope.organizationId, actorPersonId: scope.auth.personId, now });

  return (
    <section className="space-y-4">
      <PageHeader title="Upcoming" description="Future operational items due in the next 14 days." />

      {entries.length === 0 ? (
        <EmptyState message="No upcoming items in the next 14 days." actionHref="/tasks/new?returnTo=%2Fupcoming" actionLabel="Create task" />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
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
                  <td className="px-4 py-3">
                    {formatDueDate(entry.dueDate, entry.dueTime) ?? "No due date"}
                  </td>
                  <td className="px-4 py-3">{labelForEntryPriority(entry.priority)}</td>
                  <td className="px-4 py-3">{labelForEntryStatus(entry.status)}</td>
                  <td className="px-4 py-3 text-zinc-500">{formatAssigneeName(entry.assignedTo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

