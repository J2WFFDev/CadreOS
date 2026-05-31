import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { computeUpcomingWindow, queryAssignedEntries, queryUpcomingEntries } from "@/lib/operational-feed";
import { formatDueDate, labelForEntryPriority, labelForEntryStatus, labelForEntryType } from "@/lib/operational-feed/render";
import { hasSelfServiceEntryRole, resolveEntryAccess } from "@/lib/operational-entry";
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
        <PageHeader title="Upcoming" description="Look ahead at scheduled work." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load upcoming items right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Upcoming" description="Look ahead at scheduled work." />
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }
  const entryAccess = await resolveEntryAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const selfServiceAccess =
    entryAccess.level === "NONE"
      ? await hasSelfServiceEntryRole({
          organizationId: scope.organizationId,
          actorPersonId: scope.auth.personId,
        })
      : false;
  const canCreateTasks = entryAccess.level !== "NONE";
  if (entryAccess.level === "NONE" && !selfServiceAccess) {
    return (
      <section className="space-y-4">
        <PageHeader title="Upcoming" description="Look ahead at scheduled work." />
        <ErrorMessage message="You do not have permission to view upcoming work items in this organization." />
      </section>
    );
  }

  const now = new Date();
  const ctx = { organizationId: scope.organizationId, actorPersonId: scope.auth.personId, now };
  const entries = await (entryAccess.level !== "NONE"
    ? queryUpcomingEntries(ctx)
    : queryAssignedEntries(ctx).then((assigned) => {
        const { from, to } = computeUpcomingWindow(now);
        return assigned.filter((entry) => entry.dueDate && entry.dueDate >= from && entry.dueDate < to);
      }));

  return (
    <section className="space-y-4">
      <PageHeader
        title="Upcoming"
        description="Tasks, events, decisions, and journals scheduled in the next 7 days."
        actions={
          canCreateTasks ? (
            <Link href="/tasks/new?returnTo=%2Fupcoming" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
              New task
            </Link>
          ) : null
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          message={
            canCreateTasks
              ? "Nothing is scheduled in the next 7 days. Add due dates to tasks, events, or decisions to see them here."
              : "No assigned items are scheduled in the next 7 days."
          }
          actionHref={canCreateTasks ? "/tasks/new?returnTo=%2Fupcoming" : "/today"}
          actionLabel={canCreateTasks ? "Create task" : "View today"}
        />
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
