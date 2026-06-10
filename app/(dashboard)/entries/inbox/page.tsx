import Link from "next/link";
import { EntryStatus, InboxItemStatus } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import {
  buildEntryOpsTypeAwareVisibilityWhere,
  resolveEntryOpsAllWorkDefaultVisibility,
  resolveEntryOpsVisibilityContext,
} from "@/lib/entryops/visibility";
import { labelForEntryPriority, labelForEntryStatus, labelForEntryType } from "@/lib/operational-feed/render";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function EntryInboxPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Inbox" description="Captured items waiting to be clarified and organized." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load the work inbox right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Inbox" description="Captured items waiting to be clarified and organized." />
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }
  const visibilityContext = await resolveEntryOpsVisibilityContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const entryVisibility = resolveEntryOpsAllWorkDefaultVisibility(visibilityContext);

  if (!entryVisibility.canRead) {
    return (
      <section className="space-y-4">
        <PageHeader title="Inbox" description="Captured items waiting to be clarified and organized." />
        <ErrorMessage message="You do not have permission to view the work inbox in this organization." />
      </section>
    );
  }

  const inboxItems = await db.inboxRoutingItem.findMany({
    where: {
      organizationId: scope.organizationId,
      status: InboxItemStatus.OPEN,
      subjectRefType: "ENTRY",
      ownerPersonId: scope.auth.personId ?? "__entry_inbox_no_actor__",
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      subjectRefId: true,
      priority: true,
      createdAt: true,
      owner: { select: { firstName: true, lastName: true } },
    },
    take: 250,
  });

  const entryIds = Array.from(new Set(inboxItems.map((item) => item.subjectRefId)));
  const entries = entryIds.length
    ? await db.entry.findMany({
        where: {
          organizationId: scope.organizationId,
          id: { in: entryIds },
          deletedAt: null,
          status: { not: EntryStatus.ARCHIVED },
          AND: [buildEntryOpsTypeAwareVisibilityWhere(visibilityContext, entryVisibility)],
        },
        select: { id: true, title: true, type: true, status: true, priority: true, updatedAt: true },
      })
    : [];
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  const rows = inboxItems
    .map((item) => ({ item, entry: entriesById.get(item.subjectRefId) ?? null }))
    .filter((row) => row.entry);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Inbox"
        description="Quick captures land here so you can organize and enrich them later."
        actions={
          <Link href="/entries?quickCapture=1" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            Quick capture
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState message="Inbox is clear — nothing waiting to be processed. Use Quick Capture to add new items." actionHref="/entries?quickCapture=1" actionLabel="Quick capture" />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Assigned to</th>
                <th className="px-4 py-3 font-medium">Queued</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ item, entry }) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    {entry ? (
                      <Link href={`/entries/${entry.id}`} className="underline">
                        {entry.title}
                      </Link>
                    ) : (
                      <span className="text-zinc-500">Work item unavailable</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{entry ? labelForEntryType(entry.type) : "—"}</td>
                  <td className="px-4 py-3">{entry ? labelForEntryStatus(entry.status) : "—"}</td>
                  <td className="px-4 py-3">{entry ? labelForEntryPriority(entry.priority) : item.priority}</td>
                  <td className="px-4 py-3">{item.owner ? `${item.owner.firstName} ${item.owner.lastName}`.trim() : "Unassigned"}</td>
                  <td className="px-4 py-3">{item.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
