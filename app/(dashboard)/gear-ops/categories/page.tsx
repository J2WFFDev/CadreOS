import { GearItemLifecycleStatus, type GearInventoryType } from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsEnum } from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function GearOpsCategoriesPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps categories</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query GearOps categories right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps categories</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.categories.list.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="GearOps categories" description="Read-only category and linked item visibility." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let categories:
    | Array<{
        id: string;
        name: string;
        description: string | null;
        inventoryType: GearInventoryType;
      }>
    | null = null;
  let visibleItemsByCategory = new Map<
    string,
    Array<{
      id: string;
      name: string;
      lifecycleStatus: GearItemLifecycleStatus;
    }>
  >();
  let queryErrorMessage = "Unable to load GearOps categories right now. Please try again later.";

  try {
    const [fetchedCategories, fetchedItems] = await Promise.all([
      db.gearCategory.findMany({
        where: access.categoryWhere,
        select: {
          id: true,
          name: true,
          description: true,
          inventoryType: true,
        },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      }),
      db.gearItem.findMany({
        where: access.where,
        select: {
          id: true,
          name: true,
          lifecycleStatus: true,
          gearCategoryId: true,
        },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    categories = fetchedCategories;
    visibleItemsByCategory = fetchedItems.reduce((map, item) => {
      const current = map.get(item.gearCategoryId) ?? [];
      current.push({
        id: item.id,
        name: item.name,
        lifecycleStatus: item.lifecycleStatus,
      });
      map.set(item.gearCategoryId, current);
      return map;
    }, new Map<string, Array<{ id: string; name: string; lifecycleStatus: GearItemLifecycleStatus }>>());
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading GearOps categories.";
    }
  }

  if (!categories) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps categories</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader title="GearOps categories" description="Read-only category and linked item visibility." />
      <GearOpsSubnav current="categories" />

      {categories.length === 0 ? (
        <EmptyState
          message="No GearOps categories are visible yet."
          actionHref="/gear-ops/items"
          actionLabel="Review items"
        />
      ) : (
        <div className="space-y-3">
          {categories.map((category) => {
            const linkedItems = visibleItemsByCategory.get(category.id) ?? [];
            const activeItemCount = linkedItems.filter((item) => item.lifecycleStatus === GearItemLifecycleStatus.ACTIVE).length;

            return (
              <article key={category.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium">
                      <Link href={`/gear-ops/categories/${category.id}`} className="underline">
                        {category.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {category.description ?? "No category description has been recorded yet."}
                    </p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {formatGearOpsEnum(category.inventoryType)}
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-zinc-900 dark:text-zinc-50">Active items</dt>
                    <dd className="text-zinc-600 dark:text-zinc-400">{activeItemCount}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-900 dark:text-zinc-50">Linked items</dt>
                    <dd className="text-zinc-600 dark:text-zinc-400">{linkedItems.length}</dd>
                  </div>
                </dl>

                {linkedItems.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No linked items are currently visible for this category.</p>
                ) : (
                  <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {linkedItems.slice(0, 5).map((item, index) => (
                      <span key={item.id}>
                        {index > 0 ? ", " : ""}
                        <Link href={`/gear-ops/items/${item.id}`} className="underline">
                          {item.name}
                        </Link>
                      </span>
                    ))}
                    {linkedItems.length > 5 ? `, +${linkedItems.length - 5} more` : ""}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
