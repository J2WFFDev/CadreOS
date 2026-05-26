import Link from "next/link";
import { EntryStatus } from "@prisma/client";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { aggregateOperationalFeed } from "@/lib/operational-feed";
import { formatDueDate, isOverdueFeedEntry, labelForActivityAction, labelForEntryPriority, labelForEntryStatus, labelForEntryType } from "@/lib/operational-feed/render";
import type { FeedActivityItem, FeedEntryItem } from "@/lib/operational-feed/types";
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

function ActivityFeed({ items }: { items: FeedActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No recent activity.</p>;
  }

  return (
    <ul className="space-y-1 rounded-lg border bg-white dark:bg-zinc-900">
      {items.map((item) => (
        <li key={item.id} className="flex items-baseline gap-2 border-b px-4 py-2.5 last:border-b-0 text-sm">
          <span className="shrink-0 text-zinc-400 dark:text-zinc-500 text-xs tabular-nums">
            {item.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          </span>
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{labelForActivityAction(item.action)}</span>
          <span className="text-zinc-500">—</span>
          <Link href={`/entries/${item.entryId}`} className="underline text-zinc-700 dark:text-zinc-300 truncate">
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
        <PageHeader title="Feed" description="Operational feed — today, assigned, upcoming, and recent activity." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load the feed right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Feed" description="Operational feed — today, assigned, upcoming, and recent activity." />
        <ErrorMessage message="No organization context is available yet." />
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
        title="Feed"
        description="Operational feed — today, assigned, upcoming, and recent activity."
        actions={
          <Link href="/feed?quickCapture=1" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            Quick capture
          </Link>
        }
      />

      {actorPersonId && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Assigned to me
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
          Today &amp; Overdue
        </h2>
        <FeedTable
          entries={feed.today}
          now={now}
          showType
          emptyMessage="Nothing overdue or due today."
        />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Upcoming <span className="font-normal text-zinc-400 dark:text-zinc-500">(next 14 days)</span>
        </h2>
        <FeedTable
          entries={feed.upcoming}
          now={now}
          showType
          emptyMessage="No upcoming items in the next 14 days."
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
