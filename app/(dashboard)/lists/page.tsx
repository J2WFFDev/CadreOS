import Link from "next/link";
import { EntryListScope } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { fetchListsForActor, labelForEntryListScope } from "@/lib/entries/lists";
import { formatEntryListSetupIncompleteMessage, getEntryListSchemaIssue, logEntryListSchemaIssue } from "@/lib/entries/schema-guard";
import { resolveEntryAccess } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

const SCOPE_ORDER: EntryListScope[] = [
  EntryListScope.PERSONAL,
  EntryListScope.ORGANIZATION,
  EntryListScope.PROGRAM,
  EntryListScope.TEAM,
];

export default async function ListsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Work Lists" description="Manage your personal and organizational work lists." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load lists right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Work Lists" description="Manage your personal and organizational work lists." />
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  const { organizationId } = scope;

  const entryAccess = await resolveEntryAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (entryAccess.level === "NONE") {
    return (
      <section className="space-y-4">
        <PageHeader title="Work Lists" description="Manage your personal and organizational work lists." />
        <ErrorMessage message="You do not have permission to view work lists in this organization." />
      </section>
    );
  }

  const canWrite = entryAccess.level === "WRITE" || entryAccess.level === "MANAGE";

  let setupIncompleteMessage = "";
  let allLists: Awaited<ReturnType<typeof fetchListsForActor>> = [];
  try {
    allLists = await fetchListsForActor({ organizationId, actorPersonId: scope.auth.personId });
  } catch (error) {
    const schemaIssue = getEntryListSchemaIssue(error);

    if (!schemaIssue) {
      throw error;
    }

    logEntryListSchemaIssue("lists.page.fetch-lists", error, { organizationId, actorPersonId: scope.auth.personId });
    setupIncompleteMessage = formatEntryListSetupIncompleteMessage();
  }

  let countMap = new Map<string, number>();
  if (!setupIncompleteMessage) {
    try {
      const entryCounts = await db.entry.groupBy({
        by: ["listId"],
        where: { organizationId, deletedAt: null, listId: { not: null } },
        _count: { id: true },
      });
      countMap = new Map<string, number>(
        entryCounts
          .filter((row) => row.listId !== null)
          .map((row) => [row.listId as string, row._count.id]),
      );
    } catch (error) {
      const schemaIssue = getEntryListSchemaIssue(error);

      if (!schemaIssue) {
        throw error;
      }

      logEntryListSchemaIssue("lists.page.count-entries", error, { organizationId });
      setupIncompleteMessage = formatEntryListSetupIncompleteMessage();
    }
  }

  // Group by scope
  const byScope = new Map<EntryListScope, typeof allLists>();
  for (const list of allLists) {
    const existing = byScope.get(list.scope) ?? [];
    existing.push(list);
    byScope.set(list.scope, existing);
  }

  return (
    <section className="space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader title="Work Lists" description="Organize work into personal, org, program, and team lists." />
        {canWrite && !setupIncompleteMessage ? (
          <Link href="/lists/create" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            New list
          </Link>
        ) : null}
      </div>

      {setupIncompleteMessage ? <ErrorMessage message={setupIncompleteMessage} /> : null}

      {allLists.length === 0 ? (
        <EmptyState
          message={setupIncompleteMessage || (canWrite ? "No lists yet. Create your first list to start organizing work." : "No lists are available yet.")}
          {...(canWrite && !setupIncompleteMessage ? { actionHref: "/lists/create", actionLabel: "New list" } : {})}
        />
      ) : (
        <div className="space-y-6">
          {SCOPE_ORDER.filter((s) => byScope.has(s)).map((scopeKey) => {
            const lists = byScope.get(scopeKey) ?? [];
            return (
              <div key={scopeKey}>
                <h2 className="mb-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  {labelForEntryListScope(scopeKey)}
                </h2>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      <tr>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Inbox</th>
                        <th className="px-4 py-2 text-right">Work Items</th>
                        {canWrite ? <th className="px-4 py-2 text-right">Actions</th> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white dark:bg-zinc-900">
                      {lists.map((list) => (
                        <tr key={list.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                          <td className="px-4 py-2">
                            <Link href={`/lists/${list.id}`} className="font-medium underline">
                              {list.name}
                            </Link>
                            {list.isArchived ? (
                              <span className="ml-2 text-xs text-zinc-400">(archived)</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 text-zinc-500">
                            {list.isInbox ? "✓" : "—"}
                          </td>
                          <td className="px-4 py-2 text-right text-zinc-500">
                            {countMap.get(list.id) ?? 0}
                          </td>
                          {canWrite ? (
                            <td className="px-4 py-2 text-right">
                              <Link href={`/lists/${list.id}/update`} className="text-xs underline">
                                Edit
                              </Link>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
