import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { labelForHabitCadence } from "@/lib/habits/policy";
import { computeTodayWindow, queryActionableHabitsToday, queryAssignedEntries, queryTodayEntries } from "@/lib/operational-feed";
import type { ActionableHabitItem } from "@/lib/operational-feed";
import { formatDueDate, isOverdueFeedEntry, labelForEntryPriority, labelForEntryStatus, labelForEntryType } from "@/lib/operational-feed/render";
import { hasSelfServiceEntryRole, resolveEntryAccess } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function formatAssigneeName(assignedTo: { firstName: string; lastName: string } | null): string {
  if (!assignedTo) return "—";
  return `${assignedTo.firstName} ${assignedTo.lastName}`.trim() || "—";
}

function HabitsTodayList({ habits }: { habits: ActionableHabitItem[] }) {
  if (habits.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No active habits scheduled for today.</p>;
  }

  return (
    <ul className="space-y-1 rounded-lg border bg-white dark:bg-zinc-900">
      {habits.map((habit) => (
        <li key={habit.id} className="flex items-center justify-between gap-3 border-b px-4 py-2.5 last:border-b-0 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            {habit.completedToday ? (
              <span className="inline-block h-4 w-4 shrink-0 rounded-full bg-green-500 text-white text-[10px] flex items-center justify-center" aria-label="Completed today" aria-hidden="true">✓</span>
            ) : (
              <span className="inline-block h-4 w-4 shrink-0 rounded border border-zinc-300 dark:border-zinc-600" aria-hidden="true" />
            )}
            <Link href={`/habits/${habit.id}`} className="underline truncate font-medium text-zinc-700 dark:text-zinc-300">
              {habit.title}
            </Link>
            <span className="text-xs text-zinc-400">{labelForHabitCadence({ frequency: habit.frequency })}</span>
          </div>
          {!habit.completedToday && habit.canCheckIn ? (
            <form method="POST" action={`/habits/${habit.id}/check-in`} className="shrink-0">
              <input type="hidden" name="completedOn" value={new Date().toISOString().slice(0, 10)} />
              <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Check in
              </button>
            </form>
          ) : habit.completedToday ? (
            <span className="text-xs text-green-600 dark:text-green-400 shrink-0">Done</span>
          ) : (
            <span className="text-xs text-zinc-400 shrink-0">View</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function TodayPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Today" description="Focus on work that needs attention today." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load today view right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Today" description="Focus on work that needs attention today." />
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
        <PageHeader title="Today" description="Focus on work that needs attention today." />
        <ErrorMessage message="You do not have permission to view today work items in this organization." />
      </section>
    );
  }

  const now = new Date();
  const ctx = { organizationId: scope.organizationId, actorPersonId: scope.auth.personId, now };
  const { tomorrowStart } = computeTodayWindow(now);
  const habitsToday = await queryActionableHabitsToday(ctx);
  const entries =
    entryAccess.level !== "NONE"
      ? await queryTodayEntries(ctx)
      : (await queryAssignedEntries(ctx)).filter((entry) => entry.dueDate && entry.dueDate < tomorrowStart);

  const hasAnything = entries.length > 0 || habitsToday.length > 0;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Today"
        description="Tasks, events, decisions, journals, and habits due or active today."
        actions={
          canCreateTasks ? (
            <Link href="/tasks/new?returnTo=%2Ftoday" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
              New task
            </Link>
          ) : null
        }
      />

      {!hasAnything ? (
        <EmptyState
          message={
            canCreateTasks
              ? "Nothing is overdue, due today, or scheduled for today — you're all caught up."
              : "No assigned items are overdue or due today. Habit check-ins for your role still appear here."
          }
          actionHref="/upcoming"
          actionLabel="Check upcoming"
        />
      ) : (
        <>
          {entries.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Work Items
              </h2>
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
                            {formattedDue ?? "No due date"}
                            {overdue && <span className="ml-1.5 text-xs font-medium">overdue</span>}
                          </td>
                          <td className="px-4 py-3">{labelForEntryPriority(entry.priority)}</td>
                          <td className="px-4 py-3">{labelForEntryStatus(entry.status)}</td>
                          <td className="px-4 py-3 text-zinc-500">{formatAssigneeName(entry.assignedTo)}</td>
                          <td className="px-4 py-3">
                            <form action={`/entries/${entry.id}/complete`} method="post">
                              <input type="hidden" name="returnTo" value="/today" />
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
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Habits
            </h2>
            <HabitsTodayList habits={habitsToday} />
          </div>
        </>
      )}
    </section>
  );
}
