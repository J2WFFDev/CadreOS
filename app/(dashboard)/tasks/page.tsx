import Link from "next/link";

import { db } from "@/lib/db";
import { compareFollowUpTasks, formatDateTime, formatEnumLabel } from "@/lib/follow-up-tasks";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/phase1c/workflows";

export const dynamic = "force-dynamic";

function formatSource(task: {
  sourceNote: { id: string; body: string } | null;
  sourceEvent: { id: string; title: string } | null;
}) {
  if (!task.sourceNote && !task.sourceEvent) {
    return "—";
  }

  return (
    <div className="space-y-1">
      {task.sourceNote ? (
        <Link href={`/notes/${task.sourceNote.id}`} className="block underline">
          Note: {task.sourceNote.body.length > 60 ? `${task.sourceNote.body.slice(0, 60)}…` : task.sourceNote.body}
        </Link>
      ) : null}
      {task.sourceEvent ? (
        <Link href={`/events/${task.sourceEvent.id}`} className="block underline">
          Event: {task.sourceEvent.title}
        </Link>
      ) : null}
    </div>
  );
}

export default async function TasksPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query tasks right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let tasks:
    | Array<{
        id: string;
        title: string;
        status: string;
        dueAt: Date | null;
        assignee: { id: string; firstName: string; lastName: string };
        sourceNote: { id: string; body: string } | null;
        sourceEvent: { id: string; title: string } | null;
      }>
    | null = null;
  let queryErrorMessage = "Unable to load tasks right now. Please try again later.";

  try {
    tasks = await db.followUpTask.findMany({
      where: { organizationId: scope.organizationId },
      select: {
        id: true,
        title: true,
        status: true,
        dueAt: true,
        assignee: { select: { id: true, firstName: true, lastName: true } },
        sourceNote: { select: { id: true, body: true } },
        sourceEvent: { select: { id: true, title: true } },
      },
    });
    tasks.sort(compareFollowUpTasks);
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading tasks.";
    }
  }

  if (!tasks) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{queryErrorMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Tasks</h2>
        <div className="flex items-center gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Organization: {scope.organizationName ?? scope.organizationId}
          </p>
          <Link href="/tasks/new" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            New task
          </Link>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No follow-up tasks found for this organization.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">Due date</th>
                <th className="px-4 py-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/tasks/${task.id}`} className="underline">
                      {task.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatEnumLabel(task.status)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/people/${task.assignee.id}`} className="underline">
                      {task.assignee.firstName} {task.assignee.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDateTime(task.dueAt)}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatSource(task)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
