import Link from "next/link";
import { EntryStatus } from "@prisma/client";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { aggregateOperationalFeed } from "@/lib/operational-feed";
import { describeActivityAction, formatDueDate, isOverdueFeedEntry, labelForEntryPriority, labelForEntryStatus, labelForEntryType } from "@/lib/operational-feed/render";
import type { ActionableHabitItem, FeedActivityItem, FeedEntryItem } from "@/lib/operational-feed/types";
import { resolveEntryAccess } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function FeedEntryRow({ entry, now, showType = false }: { entry: FeedEntryItem; now: Date; showType?: boolean }) {
  const overdue = isOverdueFeedEntry(entry.dueDate, now);
  const formattedDue = formatDueDate(entry.dueDate, entry.dueTime);
  const isActionable = entry.status !== EntryStatus.DONE && entry.status !== EntryStatus.CANCELLED;

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3">
        <Link href={`/entries/${entry.id}`} className="underline">
          {entry.title}
        </Link>
      </td>
      {showType && <td className="px-4 py-3 text-zinc-500">{labelForEntryType(entry.type)}</td>}
      <td className={`px-4 py-3 ${overdue ? "text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-400"}`}>
        {formattedDue ?? "—"}
        {overdue && <span className="ml-1.5 text-xs font-medium">overdue</span>}
      </td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{labelForEntryPriority(entry.priority)}</td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{labelForEntryStatus(entry.status)}</td>
      <td className="px-4 py-3">
        {isActionable && (
          <form action={`/entries/${entry.id}/complete`} method="post">
            <input type="hidden" name="returnTo" value="/feed" />
            <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Complete
            </button>
          </form>
        )}
      </td>
    </tr>
  );
}

function FeedTable({
  entries,
  now,
  showType = false,
  emptyMessage,
}: {
  entries: FeedEntryItem[];
  now: Date;
  showType?: boolean;
  emptyMessage: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
          <tr>
            <th className="px-4 py-3 font-medium">Title</th>
            {showType && <th className="px-4 py-3 font-medium">Type</th>}
            <th className="px-4 py-3 font-medium">Due</th>
            <th className="px-4 py-3 font-medium">Priority</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <FeedEntryRow key={entry.id} entry={entry} now={now} showType={showType} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Arc 24D.8: Renders actionable habits for today's My Work section. */
function HabitsTodayList({ habits }: { habits: ActionableHabitItem[] }) {
  if (habits.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No actionable habits today.</p>;
  }

  return (
    <ul className="space-y-1 rounded-lg border bg-white dark:bg-zinc-900">
      {habits.map((habit) => (
        <li key={habit.id} className="flex items-center justify-between gap-3 border-b px-4 py-2.5 last:border-b-0 text-sm">
          <div className="flex items-center gap-2 min-w-0">
            {habit.completedToday ? (
              <span className="inline-block h-4 w-4 shrink-0 rounded-full bg-green-500 text-white text-[10px] flex items-center justify-center" aria-label="Completed today">✓</span>
            ) : (
              <span className="inline-block h-4 w-4 shrink-0 rounded border border-zinc-300 dark:border-zinc-600" aria-hidden="true" />
            )}
            <Link href={`/habits/${habit.id}`} className="underline truncate font-medium text-zinc-700 dark:text-zinc-300">
              {habit.title}
            </Link>
            {habit.frequency ? (
              <span className="text-xs text-zinc-400">{habit.frequency.charAt(0) + habit.frequency.slice(1).toLowerCase()}</span>
            ) : null}
          </div>
          {!habit.completedToday ? (
            <form method="POST" action={`/habits/${habit.id}/check-in`} className="shrink-0">
              <input type="hidden" name="completedOn" value={new Date().toISOString().slice(0, 10)} />
              <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Check in
              </button>
            </form>
          ) : (
            <span className="text-xs text-green-600 dark:text-green-400 shrink-0">Done</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function ActivityFeed({ items }: { items: FeedActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No recent work activity.</p>;
  }

  return (
    <ul className="space-y-1 rounded-lg border bg-white dark:bg-zinc-900">
      {items.map((item) => (
        <li key={item.id} className="flex items-baseline gap-2 border-b px-4 py-2.5 last:border-b-0 text-sm">
          <span className="shrink-0 text-zinc-400 dark:text-zinc-500 text-xs tabular-nums">
            {item.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          </span>
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{describeActivityAction(item.action, item.entryType)}</span>
          <span className="text-zinc-500">—</span>
          <Link
            href={
              item.entryType === "HABIT"
                ? `/habits/${item.entryId}`
                : item.entryType === "JOURNAL"
                  ? `/journals/${item.entryId}`
                  : `/entries/${item.entryId}`
            }
            className="underline text-zinc-700 dark:text-zinc-300 truncate"
          >
            {item.entryTitle}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function FeedPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="My Work" description="Focus your inbox, current work, upcoming commitments, and recent activity." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load the feed right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="My Work" description="Focus your inbox, current work, upcoming commitments, and recent activity." />
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
        <PageHeader title="My Work" description="Focus your inbox, current work, upcoming commitments, and recent activity." />
        <ErrorMessage message="You do not have permission to view work activity in this organization." />
      </section>
    );
  }

  const now = new Date();
  const actorPersonId = scope.auth.personId;

  const feed = await aggregateOperationalFeed({
    organizationId: scope.organizationId,
    actorPersonId,
    now,
  });

  return (
    <section className="space-y-8">
      <PageHeader
        title="My Work"
        description="Reduce context switching between capture, planning, execution, and review."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/entries/inbox" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Inbox
            </Link>
            <Link href="/feed?quickCapture=1" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
              Quick capture
            </Link>
          </div>
        }
      />

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Inbox
        </h2>
        <FeedTable
          entries={feed.inbox}
          now={now}
          showType
          emptyMessage="No unprocessed inbox captures."
        />
      </div>

      {actorPersonId && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Assigned
          </h2>
          <FeedTable
            entries={feed.assigned}
            now={now}
            showType
            emptyMessage="No items assigned to you."
          />
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Today
        </h2>
        <FeedTable
          entries={feed.today}
          now={now}
          showType
          emptyMessage="Nothing overdue or due today."
        />
      </div>

      {/* Arc 24D.8: Habits My Work section */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Habits Today
        </h2>
        <HabitsTodayList habits={feed.habitsToday} />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Upcoming <span className="font-normal text-zinc-400 dark:text-zinc-500">(next 7 days)</span>
        </h2>
        <FeedTable
          entries={feed.upcoming}
          now={now}
          showType
          emptyMessage="No upcoming items in the next 7 days."
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Recent Activity
        </h2>
        <ActivityFeed items={feed.recentActivity} />
      </div>
    </section>
  );
}
