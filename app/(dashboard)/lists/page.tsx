import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import {
  buildEntryListHierarchy,
  type EntryListSummary,
  fetchListsForActor,
  resolveEntryListVisibility,
} from "@/lib/entries/lists";
import { formatEntryListSetupIncompleteMessage, getEntryListSchemaIssue, logEntryListSchemaIssue } from "@/lib/entries/schema-guard";
import {
  buildEntryOpsTypeAwareVisibilityWhere,
  resolveEntryOpsAllWorkDefaultVisibility,
  resolveEntryOpsVisibilityContext,
} from "@/lib/entryops/visibility";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function ListTable({
  lists,
  countMap,
  actorPersonId,
  canManageSharedLists,
}: {
  lists: EntryListSummary[];
  countMap: Map<string, number>;
  actorPersonId: string | null;
  canManageSharedLists: boolean;
}) {
  if (lists.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No lists in this container.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2 text-left">Name</th>
            <th className="px-4 py-2 text-left">Type</th>
            <th className="px-4 py-2 text-right">Visible Work Items</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y bg-white dark:bg-zinc-900">
          {lists.map((list) => (
            <tr key={list.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <td className="px-4 py-2">
                <Link href={`/lists/${list.id}`} className="font-medium underline">
                  {list.name}
                </Link>
                {list.isArchived ? <span className="ml-2 text-xs text-zinc-400">[Archived]</span> : null}
              </td>
              <td className="px-4 py-2 text-zinc-500">
                {list.isInbox ? "Inbox" : list.scope === "ORGANIZATION" ? "Shared" : list.scope === "PERSONAL" ? "Personal" : "Context"}
              </td>
              <td className="px-4 py-2 text-right text-zinc-500">{countMap.get(list.id) ?? 0}</td>
              <td className="px-4 py-2 text-right">
                {canManageSharedLists || list.ownerPersonId === actorPersonId ? (
                  <Link href={`/lists/${list.id}/update`} className="text-xs underline">
                    Edit
                  </Link>
                ) : (
                  <span className="text-xs text-zinc-400">View only</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

  const listVisibility = await resolveEntryListVisibility({
    organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!listVisibility.canRead) {
    return (
      <section className="space-y-4">
        <PageHeader title="Work Lists" description="Manage your personal and organizational work lists." />
        <ErrorMessage message="You do not have permission to view work lists in this organization." />
      </section>
    );
  }

  const canWrite = listVisibility.canCreatePersonalList;

  let setupIncompleteMessage = "";
  let allLists: Awaited<ReturnType<typeof fetchListsForActor>> = [];
  try {
    allLists = await fetchListsForActor({
      organizationId,
      actorPersonId: scope.auth.personId,
      includeArchived: true,
    });
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
      const entryVisibilityContext = await resolveEntryOpsVisibilityContext({
        organizationId,
        actorPersonId: scope.auth.personId,
      });
      const entryVisibility = resolveEntryOpsAllWorkDefaultVisibility(entryVisibilityContext);
      const entryCounts = await db.entry.groupBy({
        by: ["listId"],
        where: {
          organizationId,
          deletedAt: null,
          listId: { not: null },
          entryList: listVisibility.where,
          AND: [buildEntryOpsTypeAwareVisibilityWhere(entryVisibilityContext, entryVisibility)],
        },
        _count: { listId: true },
      });
      countMap = new Map<string, number>(
        entryCounts
          .filter((row) => row.listId !== null)
          .map((row) => [row.listId as string, row._count.listId]),
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

  const teams = await db.team.findMany({
    where: {
      organizationId,
      ...(listVisibility.organizationWide
        ? {}
        : {
            OR: [
              { id: { in: listVisibility.teamIds } },
              { programId: { in: listVisibility.programIds } },
            ],
          }),
    },
    select: { id: true, name: true, programId: true },
  });
  const visibleProgramIds = Array.from(new Set([...listVisibility.programIds, ...teams.map((team) => team.programId)]));
  const programs = await db.program.findMany({
    where: {
      organizationId,
      ...(listVisibility.organizationWide ? {} : { id: { in: visibleProgramIds } }),
    },
    select: { id: true, name: true },
  });
  const hierarchy = buildEntryListHierarchy({ visibility: listVisibility, lists: allLists, programs, teams });
  const hasHierarchyContent =
    hierarchy.personalLists.length > 0 ||
    hierarchy.adminSharedLists.length > 0 ||
    hierarchy.programs.length > 0;

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

      {!hasHierarchyContent ? (
        <EmptyState
          message={setupIncompleteMessage || (canWrite ? "No lists yet. Create your first list to start organizing work." : "No lists are available yet.")}
          {...(canWrite && !setupIncompleteMessage ? { actionHref: "/lists/create", actionLabel: "New list" } : {})}
        />
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-base font-semibold">Org</h2>
            <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Personal</p>
            <ListTable
              lists={hierarchy.personalLists}
              countMap={countMap}
              actorPersonId={scope.auth.personId}
              canManageSharedLists={listVisibility.canManageSharedLists}
            />
          </div>

          {hierarchy.adminSharedLists.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-base font-semibold">Admin</h2>
              <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Shared</p>
              <ListTable
                lists={hierarchy.adminSharedLists}
                countMap={countMap}
                actorPersonId={scope.auth.personId}
                canManageSharedLists={listVisibility.canManageSharedLists}
              />
            </div>
          ) : null}

          {hierarchy.programs.map((program) => (
            <div key={program.id} className="space-y-4 border-t pt-5">
              <div className="space-y-2">
                <h2 className="text-base font-semibold">{program.name}</h2>
                <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Program</p>
                <ListTable
                  lists={program.lists}
                  countMap={countMap}
                  actorPersonId={scope.auth.personId}
                  canManageSharedLists={listVisibility.canManageSharedLists}
                />
              </div>
              {program.teams.map((team) => (
                <div key={team.id} className="ml-4 space-y-2 border-l pl-4">
                  <h3 className="text-sm font-semibold">{team.name}</h3>
                  <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">Team</p>
                  <ListTable
                    lists={team.lists}
                    countMap={countMap}
                    actorPersonId={scope.auth.personId}
                    canManageSharedLists={listVisibility.canManageSharedLists}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
