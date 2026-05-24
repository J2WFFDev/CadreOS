import { GearInventoryType } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
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

export default async function EditGearCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { categoryId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear category</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load gear category edit right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.categories.edit.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let category: { id: string; name: string; inventoryType: GearInventoryType; description: string | null } | null = null;

  try {
    category = await db.gearCategory.findFirst({
      where: {
        id: categoryId,
        AND: [access.categoryWhere],
      },
      select: {
        id: true,
        name: true,
        inventoryType: true,
        description: true,
      },
    });
  } catch {
    category = null;
  }

  if (!category) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Gear category not found in the selected organization scope.
          </p>
        </div>
        <BackLink href="/gear-ops/categories" label="Categories" />
      </section>
    );
  }

  const name = readSearchParam(resolvedSearchParams, "name") || category.name;
  const inventoryType = readSearchParam(resolvedSearchParams, "inventoryType") || category.inventoryType;
  const description = readSearchParam(resolvedSearchParams, "description") ?? category.description ?? "";
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <BackLink href={`/gear-ops/categories/${category.id}`} label={category.name} />
        <GearOpsSubnav current="categories" />
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Edit gear category</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organization: {scope.organizationName ?? scope.organizationId}
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <form
        action={`/gear-ops/categories/${category.id}/edit/update`}
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
            defaultValue={inventoryType}
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

        <FormActions submitLabel="Save category" cancelHref={`/gear-ops/categories/${category.id}`} />
      </form>
    </section>
  );
}
