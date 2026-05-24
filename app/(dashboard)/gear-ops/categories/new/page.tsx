import { GearInventoryType } from "@prisma/client";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { formatGearOpsEnum } from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function NewGearCategoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New gear category</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load gear category creation right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.categories.new.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  const name = readSearchParam(resolvedSearchParams, "name");
  const inventoryType = readSearchParam(resolvedSearchParams, "inventoryType");
  const description = readSearchParam(resolvedSearchParams, "description");
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <PageHeader title="New gear category" description={`Organization: ${scope.organizationName ?? scope.organizationId}`} />
      <GearOpsSubnav current="categories" />

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <form
        action="/gear-ops/categories/create"
        method="post"
        className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900"
      >
        <div className="space-y-1">
          <label htmlFor="name" className="text-sm font-medium">
            Category name
          </label>
          <input
            id="name"
            name="name"
            defaultValue={name}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {readSearchParam(resolvedSearchParams, "nameError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "nameError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="inventoryType" className="text-sm font-medium">
            Inventory type
          </label>
          <select
            id="inventoryType"
            name="inventoryType"
            defaultValue={inventoryType || GearInventoryType.DURABLE}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {Object.values(GearInventoryType).map((type) => (
              <option key={type} value={type}>
                {formatGearOpsEnum(type)}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "inventoryTypeError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "inventoryTypeError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="description" className="text-sm font-medium">
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            defaultValue={description}
            rows={4}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          {readSearchParam(resolvedSearchParams, "descriptionError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "descriptionError")}</p>
          ) : null}
        </div>

        <FormActions submitLabel="Create category" cancelHref="/gear-ops/categories" />
      </form>
    </section>
  );
}
