import Link from "next/link";
import { EntryStatus, EntryType } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function UpcomingPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Upcoming" description="Look ahead at scheduled tasks." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load upcoming tasks right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Upcoming" description="Look ahead at scheduled tasks." />
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  const now = new Date();
  const tomorrowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

  const entries = await db.entry.findMany({
    where: {
      organizationId: scope.organizationId,
      type: EntryType.TASK,
      deletedAt: null,
      status: { in: [EntryStatus.OPEN, EntryStatus.IN_PROGRESS] },
      dueDate: { gte: tomorrowStart },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
    select: { id: true, title: true, dueDate: true, dueTime: true, priority: true, status: true },
    take: 200,
  });

  return (
    <section className="space-y-4">
      <PageHeader title="Upcoming" description="Future task commitments across your workspace." />

      {entries.length === 0 ? (
        <EmptyState message="No upcoming tasks were found." actionHref="/tasks/new?returnTo=%2Fupcoming" actionLabel="Create task" />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
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
                  <td className="px-4 py-3">
                    {entry.dueDate?.toISOString().slice(0, 10) ?? "No due date"} {entry.dueTime ?? ""}
                  </td>
                  <td className="px-4 py-3">{entry.priority}</td>
                  <td className="px-4 py-3">{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
