import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { queryAssignedEntries } from "@/lib/operational-feed";
import { formatDueDate, isOverdueFeedEntry, labelForEntryPriority, labelForEntryStatus, labelForEntryType } from "@/lib/operational-feed/render";
import { resolveEntryAccess } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function formatAssigneeName(assignedTo: { firstName: string; lastName: string } | null): string {
  if (!assignedTo) return "—";
  return `${assignedTo.firstName} ${assignedTo.lastName}`.trim() || "—";
}

export default async function AssignedPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="My Work" description="Actionable work assigned to you." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load assigned items right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="My Work" description="Actionable work assigned to you." />
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
        <PageHeader title="My Work" description="Actionable work assigned to you." />
        <ErrorMessage message="You do not have permission to view assigned work in this organization." />
      </section>
    );
  }

  if (!scope.auth.personId) {
    return (
      <section className="space-y-4">
        <PageHeader title="My Work" description="Actionable work assigned to you." />
        <EmptyState
          message="Your account is not linked to a person yet — assigned work cannot be shown."
          actionHref="/account/link-person"
          actionLabel="Link account"
        />
      </section>
    );
  }

  const now = new Date();
  const entries = await queryAssignedEntries({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    now,
  });

  return (
    <section className="space-y-4">
      <PageHeader
        title="My Work"
        description="Actionable items assigned to you, excluding completed and archived work."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/today" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Today
            </Link>
            <Link href="/upcoming" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Upcoming
            </Link>
            <Link href="/tasks/new?returnTo=%2Fassigned" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
              New task
            </Link>
          </div>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          message="No actionable work is assigned to you right now. Completed and archived items are excluded."
          actionHref="/tasks/new?returnTo=%2Fassigned"
          actionLabel="Create task"
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
                <th className="px-4 py-3 font-medium">Assigned to</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const overdue = isOverdueFeedEntry(entry.dueDate, now);
                const formattedDue = formatDueDate(entry.dueDate, entry.dueTime);
                return (
                  <tr key={entry.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/entries/${entry.id}`} className="underline">
                        {entry.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{labelForEntryType(entry.type)}</td>
                    <td className={`px-4 py-3 ${overdue ? "text-red-700 dark:text-red-300" : ""}`}>
                      {formattedDue ?? "—"}
                      {overdue && <span className="ml-1.5 text-xs font-medium">overdue</span>}
                    </td>
                    <td className="px-4 py-3">{labelForEntryPriority(entry.priority)}</td>
                    <td className="px-4 py-3">{labelForEntryStatus(entry.status)}</td>
                    <td className="px-4 py-3 text-zinc-500">{formatAssigneeName(entry.assignedTo)}</td>
                    <td className="px-4 py-3">
                      <form action={`/entries/${entry.id}/complete`} method="post">
                        <input type="hidden" name="returnTo" value="/assigned" />
                        <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                          Complete
                        </button>
                      </form>
                    </td>
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
