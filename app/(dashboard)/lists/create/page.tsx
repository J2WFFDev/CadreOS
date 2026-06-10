import Link from "next/link";
import { EntryListScope } from "@prisma/client";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { fetchListsForActor, labelForEntryListScope, resolveEntryListVisibility } from "@/lib/entries/lists";
import { formatEntryListSetupIncompleteMessage, getEntryListSchemaIssue, logEntryListSchemaIssue } from "@/lib/entries/schema-guard";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function CreateListPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const scope = await getOrganizationScope();
  const params = await searchParams;
  const errorMsg = readParam(params, "error");

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="New List" description="Create a new work list." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load list creation right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="New List" description="Create a new work list." />
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  const { organizationId } = scope;

  const listVisibility = await resolveEntryListVisibility({
    organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!listVisibility.canCreatePersonalList) {
    return (
      <section className="space-y-4">
        <PageHeader title="New List" description="Create a new work list." />
        <ErrorMessage message="You do not have permission to create lists." />
      </section>
    );
  }

  try {
    await fetchListsForActor({ organizationId, actorPersonId: scope.auth.personId });
  } catch (error) {
    const schemaIssue = getEntryListSchemaIssue(error);

    if (!schemaIssue) {
      throw error;
    }

    logEntryListSchemaIssue("lists.create.page.check-setup", error, {
      organizationId,
      actorPersonId: scope.auth.personId,
    });

    return (
      <section className="space-y-4">
        <PageHeader title="New List" description="Create a new work list." />
        <ErrorMessage message={formatEntryListSetupIncompleteMessage()} />
      </section>
    );
  }

  const [programs, teams] = listVisibility.canManageSharedLists
    ? await Promise.all([
        db.program.findMany({
          where: { organizationId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        db.team.findMany({
          where: { organizationId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];
  const scopeOptions = listVisibility.canManageSharedLists
    ? Object.values(EntryListScope)
    : [EntryListScope.PERSONAL];

  return (
    <section className="space-y-6">
      <PageHeader title="New List" description="Create a new work list." />

      {errorMsg ? <ErrorMessage message={errorMsg} /> : null}

      <form action="/lists/actions/create" method="post" className="max-w-lg space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">
            List name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            required
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="e.g. Sprint 12, Personal backlog"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="scope" className="text-sm font-medium">
            Context type <span className="text-red-500">*</span>
          </label>
          <select id="scope" name="scope" className="w-full rounded-md border px-3 py-2 text-sm">
            {scopeOptions.map((s) => (
              <option key={s} value={s}>
                {labelForEntryListScope(s)}
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Personal lists belong to you. Organization lists are shared. Program/Team lists are organized under their context.
          </p>
        </div>

        {programs.length > 0 ? (
          <div className="space-y-1">
            <label htmlFor="programId" className="text-sm font-medium">
              Program <span className="text-xs text-zinc-400">(required for Program context)</span>
            </label>
            <select id="programId" name="programId" className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">— None —</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {teams.length > 0 ? (
          <div className="space-y-1">
            <label htmlFor="teamId" className="text-sm font-medium">
              Team <span className="text-xs text-zinc-400">(required for Team context)</span>
            </label>
            <select id="teamId" name="teamId" className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">— None —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            Create list
          </button>
          <Link href="/lists" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
