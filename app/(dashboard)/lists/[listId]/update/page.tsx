import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { fetchEntryList, labelForEntryListScope } from "@/lib/entries/lists";
import { resolveEntryAccess } from "@/lib/operational-entry";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function UpdateListPage({
  params,
  searchParams,
}: {
  params: Promise<{ listId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { listId } = await params;
  const resolvedParams = await searchParams;
  const errorMsg = readParam(resolvedParams, "error");
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Edit List" description="Rename or archive this list." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load list right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Edit List" description="Rename or archive this list." />
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  const { organizationId } = scope;

  const entryAccess = await resolveEntryAccess({
    organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (entryAccess.level === "NONE" || entryAccess.level === "READ") {
    return (
      <section className="space-y-4">
        <PageHeader title="Edit List" description="Rename or archive this list." />
        <ErrorMessage message="You do not have permission to edit lists." />
      </section>
    );
  }

  const list = await fetchEntryList({ organizationId, listId });

  if (!list) {
    return (
      <section className="space-y-4">
        <PageHeader title="Edit List" description="Rename or archive this list." />
        <ErrorMessage message="This list does not exist or is not accessible." />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Edit List"
        description={`${labelForEntryListScope(list.scope)} list${list.isInbox ? " · Inbox" : ""}`}
      />

      {errorMsg ? <ErrorMessage message={errorMsg} /> : null}

      <form
        action={`/lists/${list.id}/update`}
        method="post"
        className="max-w-lg space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
      >
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">
            List name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={list.name}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        {list.isInbox ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            This is a default inbox list. It cannot be archived.
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <input
              id="isArchived"
              name="isArchived"
              type="checkbox"
              value="true"
              defaultChecked={list.isArchived}
              className="rounded border"
            />
            <label htmlFor="isArchived" className="text-sm">
              Archive this list
            </label>
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
          >
            Save changes
          </button>
          <a
            href={`/lists/${list.id}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </a>
        </div>
      </form>
    </section>
  );
}
