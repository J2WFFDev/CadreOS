import Link from "next/link";
import {
  EntryObjectLinkTargetType,
  EntryPriority,
  EntryStatus,
  EntryType,
  OperationalGraphNodeType,
  OperationalRelationshipType,
} from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import {
  labelForEntryObjectLinkTargetType,
  resolveEntryObjectLinkViews,
} from "@/lib/entries/object-links";
import { formatEnumLabel, getTaskStatusBadgeClassName, isTaskOverdue } from "@/lib/follow-up-tasks";
import {
  labelForOperationalNodeType,
  labelForOperationalRelationshipType,
  listRelatedOperationalRecords,
} from "@/lib/operational-graph";
import { resolveEntryAccess } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

function formatPersonName(person: { firstName: string; lastName: string } | null | undefined) {
  if (!person) return "—";
  const fullName = `${person.firstName} ${person.lastName}`.trim();
  return fullName || "—";
}

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
  const organizationId = scope.organizationId;

  const entryAccess = await resolveEntryAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canReadEntry = entryAccess.level !== "NONE";
  const canEditEntry = entryAccess.level === "WRITE" || entryAccess.level === "MANAGE";

  if (!canReadEntry) {
    return (
      <section className="space-y-4">
        <BackLink href="/entries" label="All entries" />
        <h2 className="text-2xl font-semibold tracking-tight">Entry</h2>
        <ErrorMessage message="You do not have permission to view entry details in this organization." />
      </section>
    );
  }

  const entry = await db.entry.findFirst({
    where: { id: entryId, organizationId, deletedAt: null },
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
      assignedToPersonId: true,
      createdBy: { select: { firstName: true, lastName: true } },
      updatedBy: { select: { firstName: true, lastName: true } },
      assignedTo: { select: { firstName: true, lastName: true } },
      objectLinks: {
        orderBy: { createdAt: "desc" },
        select: { id: true, targetType: true, targetId: true, createdAt: true },
        take: 40,
      },
      linkedFrom: {
        select: {
          id: true,
          fromEntryId: true,
          toEntryId: true,
          toEntry: { select: { id: true, title: true, type: true, deletedAt: true } },
        },
        take: 40,
      },
      linkedTo: {
        select: {
          id: true,
          fromEntryId: true,
          toEntryId: true,
          fromEntry: { select: { id: true, title: true, type: true, deletedAt: true } },
        },
        take: 40,
      },
      activity: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          metadataJson: true,
          createdAt: true,
          actor: { select: { firstName: true, lastName: true } },
        },
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

  const [relatedItems, objectLinkViews] = await Promise.all([
    listRelatedOperationalRecords({
      organizationId,
      node: { nodeType: "ENTRY", nodeId: entry.id },
      limit: 30,
    }),
    resolveEntryObjectLinkViews({
      organizationId,
      links: entry.objectLinks,
      canViewTargetDetails: canReadEntry,
    }),
  ]);
  const [followUpEntries, people] = await Promise.all([
    db.entry.findMany({
      where: {
        organizationId,
        parentEntryId: entry.id,
        deletedAt: null,
        sourceTaskId: { not: null },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        dueTime: true,
        sourceTaskId: true,
        sourceTask: {
          select: {
            id: true,
            status: true,
            dueAt: true,
            assignee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    canEditEntry
      ? db.person.findMany({
          where: { organizationId },
          select: { id: true, firstName: true, lastName: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const linkedEntryRows = [
    ...entry.linkedFrom.map((item) => ({
      linkId: item.id,
      fromEntryId: item.fromEntryId,
      toEntryId: item.toEntryId,
      linked: item.toEntry,
    })),
    ...entry.linkedTo.map((item) => ({
      linkId: item.id,
      fromEntryId: item.fromEntryId,
      toEntryId: item.toEntryId,
      linked: item.fromEntry,
    })),
  ];
  const openFollowUps = followUpEntries.filter((item) => item.sourceTask?.status !== "DONE" && item.sourceTask?.status !== "CANCELLED");
  const completedFollowUps = followUpEntries.filter((item) => item.sourceTask?.status === "DONE" || item.sourceTask?.status === "CANCELLED");

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/entries" label="All entries" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{entry.title}</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/entries/inbox" className="rounded-md border px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Entry inbox
            </Link>
            <Link href="/feed" className="rounded-md border px-3 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Operational feed
            </Link>
          </div>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Type: {entry.type} · Status: {entry.status} · Priority: {entry.priority}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">Summary</h3>
            <p className="mt-2 text-sm whitespace-pre-wrap">{entry.content?.trim() ? entry.content : "No details captured yet."}</p>
            {entry.tags.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {entry.tags.map((tag) => (
                  <li key={tag} className="rounded-full border px-2 py-0.5 text-xs">
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>

          <section className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
            <h3 className="font-semibold">Metadata</h3>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Creator</dt>
                <dd>{formatPersonName(entry.createdBy)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Assignee</dt>
                <dd>{formatPersonName(entry.assignedTo)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Last updated by</dt>
                <dd>{formatPersonName(entry.updatedBy)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Due</dt>
                <dd>
                  {entry.dueDate ? entry.dueDate.toISOString().slice(0, 10) : "—"}
                  {entry.dueDate && entry.dueTime ? ` ${entry.dueTime}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Created</dt>
                <dd>{formatDateTime(entry.createdAt)} UTC</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Updated</dt>
                <dd>{formatDateTime(entry.updatedAt)} UTC</dd>
              </div>
            </dl>
          </section>

          {canEditEntry ? (
            <section className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
              <h3 className="font-semibold">Create follow-up</h3>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Create actionable follow-up work from this entry while keeping source context linked.
              </p>
              <form action={`/entries/${entry.id}/create-follow-up`} method="post" className="mt-3 space-y-3">
                <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                <div className="space-y-1">
                  <label htmlFor="followUpTitle" className="text-sm font-medium">
                    Follow-up title
                  </label>
                  <input
                    id="followUpTitle"
                    name="title"
                    defaultValue={`Follow up: ${entry.title}`.slice(0, 160)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="followUpDescription" className="text-sm font-medium">
                    Follow-up description
                  </label>
                  <textarea
                    id="followUpDescription"
                    name="description"
                    defaultValue={entry.content ?? ""}
                    rows={5}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label htmlFor="followUpAssigneePersonId" className="text-sm font-medium">
                      Assignee
                    </label>
                    <select
                      id="followUpAssigneePersonId"
                      name="assigneePersonId"
                      defaultValue={entry.assignedToPersonId ?? ""}
                      disabled={people.length === 0}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                    >
                      {people.length === 0 ? <option value="">No people available</option> : null}
                      {people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.firstName} {person.lastName}
                        </option>
                      ))}
                    </select>
                    {people.length === 0 ? (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Add a person before creating follow-up assignments.
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="followUpDueAt" className="text-sm font-medium">
                      Due date
                    </label>
                    <input id="followUpDueAt" name="dueAt" type="datetime-local" className="w-full rounded-md border px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="followUpPriority" className="text-sm font-medium">
                      Priority
                    </label>
                    <select id="followUpPriority" name="priority" defaultValue={entry.priority} className="w-full rounded-md border px-3 py-2 text-sm">
                      {Object.values(EntryPriority).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  Create follow-up task
                </button>
              </form>
            </section>
          ) : null}

          <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">Follow-ups</h3>
            {followUpEntries.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No follow-ups created from this entry yet.</p>
            ) : (
              <div className="space-y-3">
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {openFollowUps.length} active · {completedFollowUps.length} completed
                </p>
                <ul className="space-y-2 text-sm">
                  {followUpEntries.map((followUp) => {
                    const followUpTask = followUp.sourceTask;
                    const followUpStatus = followUpTask?.status ?? followUp.status;
                    const followUpOverdue = followUpTask ? isTaskOverdue(followUpTask) : false;

                    return (
                      <li key={followUp.id} className="rounded-md border px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">
                            <Link href={`/entries/${followUp.id}`} className="underline">
                              {followUp.title}
                            </Link>
                          </div>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getTaskStatusBadgeClassName(followUpStatus)}`}>
                            {formatEnumLabel(followUpStatus)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                          Priority: {formatEnumLabel(followUp.priority)}
                          {followUpTask?.assignee
                            ? ` · Assignee: ${followUpTask.assignee.firstName} ${followUpTask.assignee.lastName}`
                            : ""}
                          {followUpTask?.dueAt
                            ? ` · Due: ${followUpTask.dueAt.toISOString().slice(0, 16).replace("T", " ")} UTC`
                            : followUp.dueDate
                              ? ` · Due: ${followUp.dueDate.toISOString().slice(0, 10)}${followUp.dueTime ? ` ${followUp.dueTime}` : ""}`
                              : ""}
                          {followUpOverdue ? " · Overdue" : ""}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs">
                          {followUp.sourceTaskId ? (
                            <Link href={`/tasks/${followUp.sourceTaskId}`} className="underline">
                              Open task
                            </Link>
                          ) : null}
                          <Link href={`/entries/${followUp.id}`} className="underline">
                            Open follow-up entry
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          {canEditEntry ? (
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
          ) : (
            <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              Entry editing is unavailable for your role.
            </div>
          )}

          {canEditEntry ? (
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
          ) : null}
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

          {canEditEntry ? (
            <>
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
                <h3 className="font-semibold">Link operational object</h3>
                <form action="/entries/object-links/link" method="post" className="mt-2 space-y-2">
                  <input type="hidden" name="entryId" value={entry.id} />
                  <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                  <div className="space-y-1">
                    <label htmlFor="targetType" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Target type
                    </label>
                    <select id="targetType" name="targetType" defaultValue={EntryObjectLinkTargetType.PERSON} className="w-full rounded-md border px-3 py-2 text-sm">
                      {Object.values(EntryObjectLinkTargetType).map((value) => (
                        <option key={value} value={value}>
                          {labelForEntryObjectLinkTargetType(value)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="targetId" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Target ID
                    </label>
                    <input id="targetId" name="targetId" placeholder="Target record ID" className="w-full rounded-md border px-3 py-2 text-sm" />
                  </div>
                  <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Add linked object
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
            </>
          ) : (
            <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              Linking actions are unavailable for your role.
            </div>
          )}
        </aside>
      </div>

      <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Linked objects</h3>
        {objectLinkViews.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No linked objects yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {objectLinkViews.map((objectLink) => (
              <li key={objectLink.id} className="rounded-md border px-3 py-2">
                <div className="font-medium">
                  {objectLink.href ? (
                    <Link href={objectLink.href} className="underline">
                      {objectLink.title}
                    </Link>
                  ) : (
                    objectLink.title
                  )}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  {labelForEntryObjectLinkTargetType(objectLink.targetType)}
                  {objectLink.subtitle ? ` · ${objectLink.subtitle}` : ""}
                </div>
                {canEditEntry ? (
                  <form action="/entries/object-links/unlink" method="post" className="mt-2">
                    <input type="hidden" name="entryId" value={entry.id} />
                    <input type="hidden" name="targetType" value={objectLink.targetType} />
                    <input type="hidden" name="targetId" value={objectLink.targetId} />
                    <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                    <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      Remove link
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">Linked entries</h3>
        {linkedEntryRows.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No linked entries yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {linkedEntryRows.map((row) => (
              <li key={row.linkId} className="rounded-md border px-3 py-2">
                {row.linked.deletedAt ? (
                  <span>Linked entry unavailable</span>
                ) : (
                  <Link href={`/entries/${row.linked.id}`} className="underline">
                    {row.linked.type}: {row.linked.title}
                  </Link>
                )}
                {canEditEntry ? (
                  <form action="/entries/unlink" method="post" className="mt-2">
                    <input type="hidden" name="fromEntryId" value={row.fromEntryId} />
                    <input type="hidden" name="toEntryId" value={row.toEntryId} />
                    <input type="hidden" name="returnTo" value={`/entries/${entry.id}`} />
                    <button type="submit" className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      Unlink
                    </button>
                  </form>
                ) : null}
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
                {canEditEntry ? (
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
                ) : null}
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
