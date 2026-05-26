import Link from "next/link";
import { EntryPriority, EntryStatus, EntryType, OperationalGraphNodeType, OperationalRelationshipType } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import { labelForOperationalNodeType, labelForOperationalRelationshipType, listRelatedOperationalRecords } from "@/lib/operational-graph";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function EntryDetailPage({ params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Entry</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load entry details right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Entry</h2>
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  const entry = await db.entry.findFirst({
    where: { id: entryId, organizationId: scope.organizationId, deletedAt: null },
    select: {
      id: true,
      type: true,
      title: true,
      content: true,
      tags: true,
      status: true,
      priority: true,
      dueDate: true,
      dueTime: true,
      taskCompleted: true,
      createdAt: true,
      updatedAt: true,
      sourceTaskId: true,
      sourceNoteId: true,
      linkedFrom: { select: { toEntry: { select: { id: true, title: true, type: true } } }, take: 20 },
      linkedTo: { select: { fromEntry: { select: { id: true, title: true, type: true } } }, take: 20 },
      activity: {
        orderBy: { createdAt: "desc" },
        select: { id: true, action: true, metadataJson: true, createdAt: true, actor: { select: { firstName: true, lastName: true } } },
        take: 40,
      },
    },
  });

  if (!entry) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Entry</h2>
        <ErrorMessage message="Entry not found in the active organization." />
      </section>
    );
  }

  const relatedItems = await listRelatedOperationalRecords({
    organizationId: scope.organizationId,
    node: { nodeType: "ENTRY", nodeId: entry.id },
    limit: 30,
  });

  const linkedEntries = [
    ...entry.linkedFrom.map((item) => item.toEntry),
    ...entry.linkedTo.map((item) => item.fromEntry),
  ].filter((value, index, array) => array.findIndex((candidate) => candidate.id === value.id) === index);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/entries" label="All entries" />
        <h2 className="text-2xl font-semibold tracking-tight">{entry.title}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Type: {entry.type} · Status: {entry.status} · Priority: {entry.priority}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <form action={`/entries/${entry.id}/update`} method="post" className="space-y-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
          <div className="space-y-1">
            <label htmlFor="title" className="text-sm font-medium">
              Title
            </label>
            <input id="title" name="title" defaultValue={entry.title} className="w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label htmlFor="content" className="text-sm font-medium">
              Content
            </label>
            <textarea id="content" name="content" defaultValue={entry.content ?? ""} rows={10} className="w-full rounded-md border px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label htmlFor="type" className="text-sm font-medium">
                Type
              </label>
              <select id="type" name="type" defaultValue={entry.type} className="w-full rounded-md border px-3 py-2 text-sm">
                {Object.values(EntryType).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <select id="status" name="status" defaultValue={entry.status} className="w-full rounded-md border px-3 py-2 text-sm">
                {Object.values(EntryStatus).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="priority" className="text-sm font-medium">
                Priority
              </label>
              <select id="priority" name="priority" defaultValue={entry.priority} className="w-full rounded-md border px-3 py-2 text-sm">
                {Object.values(EntryPriority).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            Save entry
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {entry.type === EntryType.TASK && !entry.taskCompleted ? (
            <form action={`/entries/${entry.id}/complete`} method="post">
              <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
              <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Complete task
              </button>
            </form>
          ) : null}
          {entry.type === EntryType.NOTE ? (
            <form action={`/entries/${entry.id}/convert-note-to-task`} method="post">
              <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
              <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Convert note to task
              </button>
            </form>
          ) : null}
          <form action={`/entries/${entry.id}/delete`} method="post">
            <input type="hidden" name="returnTo" value="/entries" />
            <button type="submit" className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300">
              Soft delete
            </button>
          </form>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
            <h3 className="font-semibold">Source links</h3>
            <ul className="mt-2 space-y-1 text-zinc-600 dark:text-zinc-400">
              {entry.sourceTaskId ? (
                <li>
                  <Link href={`/tasks/${entry.sourceTaskId}`} className="underline">
                    Open linked task
                  </Link>
                </li>
              ) : null}
              {entry.sourceNoteId ? (
                <li>
                  <Link href={`/notes/${entry.sourceNoteId}`} className="underline">
                    Open linked note
                  </Link>
                </li>
              ) : null}
              {!entry.sourceTaskId && !entry.sourceNoteId ? <li>No linked source object.</li> : null}
            </ul>
          </div>

          <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
            <h3 className="font-semibold">Link entries</h3>
            <form action="/entries/link" method="post" className="mt-2 space-y-2">
              <input type="hidden" name="fromEntryId" value={entry.id} />
              <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
              <input
                name="toEntryId"
                placeholder="Target entry ID"
                className="w-full rounded-md border px-3 py-2 text-sm"
                aria-label="Target entry ID"
              />
              <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Link entry
              </button>
            </form>
          </div>

          <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
            <h3 className="font-semibold">Operational graph link</h3>
            <form action="/entries/relationships/link" method="post" className="mt-2 space-y-2">
              <input type="hidden" name="fromNodeType" value="ENTRY" />
              <input type="hidden" name="fromNodeId" value={entry.id} />
              <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
              <div className="space-y-1">
                <label htmlFor="toNodeType" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Target type
                </label>
                <select id="toNodeType" name="toNodeType" defaultValue={OperationalGraphNodeType.ENTRY} className="w-full rounded-md border px-3 py-2 text-sm">
                  {Object.values(OperationalGraphNodeType).map((value) => (
                    <option key={value} value={value}>
                      {labelForOperationalNodeType(value)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="toNodeId" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Target ID
                </label>
                <input id="toNodeId" name="toNodeId" placeholder="Target record ID" className="w-full rounded-md border px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label htmlFor="relationshipType" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Relationship type
                </label>
                <select id="relationshipType" name="relationshipType" defaultValue={OperationalRelationshipType.RELATED_TO} className="w-full rounded-md border px-3 py-2 text-sm">
                  {Object.values(OperationalRelationshipType).map((value) => (
                    <option key={value} value={value}>
                      {labelForOperationalRelationshipType(value)}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Link operational record
              </button>
            </form>
          </div>
        </aside>
      </div>

      <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Linked entries</h3>
        {linkedEntries.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No linked entries yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {linkedEntries.map((linked) => (
              <li key={linked.id}>
                <Link href={`/entries/${linked.id}`} className="underline">
                  {linked.type}: {linked.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Related operational items</h3>
        {relatedItems.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No related operational items yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {relatedItems.map((item) => (
              <li key={item.id} className="rounded-md border px-3 py-2">
                <div className="font-medium">
                  {item.direction === "OUTBOUND" ? "→" : "←"} {labelForOperationalRelationshipType(item.relationshipType)}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  {labelForOperationalNodeType(item.node.nodeType)} · {item.node.subtitle ?? "Operational record"}
                </div>
                <div className="mt-1">
                  {item.node.href ? (
                    <Link href={item.node.href} className="underline">
                      {item.node.title}
                    </Link>
                  ) : (
                    <span>{item.node.title}</span>
                  )}
                </div>
                <form action="/entries/relationships/unlink" method="post" className="mt-2">
                  <input type="hidden" name="fromNodeType" value={item.direction === "OUTBOUND" ? "ENTRY" : item.node.nodeType} />
                  <input type="hidden" name="fromNodeId" value={item.direction === "OUTBOUND" ? entry.id : item.node.nodeId} />
                  <input type="hidden" name="toNodeType" value={item.direction === "OUTBOUND" ? item.node.nodeType : "ENTRY"} />
                  <input type="hidden" name="toNodeId" value={item.direction === "OUTBOUND" ? item.node.nodeId : entry.id} />
                  <input type="hidden" name="relationshipType" value={item.relationshipType} />
                  <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                  <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Unlink
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Activity / history</h3>
        {entry.activity.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No activity recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {entry.activity.map((activity) => (
              <li key={activity.id} className="rounded-md border px-3 py-2">
                <div className="font-medium">{activity.action}</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  {activity.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                  {activity.actor ? ` · ${activity.actor.firstName} ${activity.actor.lastName}` : ""}
                </div>
                {activity.metadataJson ? (
                  <pre className="mt-2 overflow-x-auto text-xs text-zinc-600 dark:text-zinc-400">{activity.metadataJson}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
