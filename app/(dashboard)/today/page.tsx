import Link from "next/link";
import { EntryStatus, EntryType } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function isOverdue(dueDate: Date | null, now: Date) {
  if (!dueDate) return false;
  return dueDate.getTime() < Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export default async function TodayPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Today" description="Focus on due and overdue work." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load today view right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Today" description="Focus on due and overdue work." />
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

  const entries = await db.entry.findMany({
    where: {
      organizationId: scope.organizationId,
      type: EntryType.TASK,
      deletedAt: null,
      status: { in: [EntryStatus.OPEN, EntryStatus.IN_PROGRESS] },
      OR: [{ dueDate: { lt: tomorrowStart } }, { dueDate: null }],
    },
    orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, dueDate: true, dueTime: true, status: true, priority: true, taskCompleted: true },
    take: 200,
  });

  return (
    <section className="space-y-4">
      <PageHeader
        title="Today"
        description="Overdue and due-today tasks in one lane."
        actions={
          <Link href="/tasks/new?returnTo=%2Ftoday" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            New task
          </Link>
        }
      />

      {entries.length === 0 ? (
        <EmptyState message="No tasks are due today." actionHref="/tasks/new?returnTo=%2Ftoday" actionLabel="Create task" />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Action</th>
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
                  <td className={`px-4 py-3 ${isOverdue(entry.dueDate, now) ? "text-red-700 dark:text-red-300" : ""}`}>
                    {entry.dueDate ? entry.dueDate.toISOString().slice(0, 10) : "No due date"} {entry.dueTime ?? ""}
                  </td>
                  <td className="px-4 py-3">{entry.priority}</td>
                  <td className="px-4 py-3">{entry.status}</td>
                  <td className="px-4 py-3">
                    {entry.taskCompleted ? (
                      <span className="text-xs text-zinc-500">Completed</span>
                    ) : (
                      <form action={`/entries/${entry.id}/complete`} method="post">
                        <input type="hidden" name="returnTo" value="/today" />
                        <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                          Quick complete
                        </button>
                      </form>
                    )}
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
