import { GearItemLifecycleStatus, type GearInventoryType } from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsEnum, getGearLifecycleBadgeClass } from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function GearOpsCategoryDetailsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear category</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query gear category details right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.categories.detail.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let category:
    | {
        id: string;
        name: string;
        description: string | null;
        inventoryType: GearInventoryType;
      }
    | null = null;
  let items:
    | Array<{
        id: string;
        name: string;
        inventoryType: GearInventoryType;
        lifecycleStatus: GearItemLifecycleStatus;
      }>
    | null = null;
  let queryFailed = false;
  let queryErrorMessage = "Unable to load GearOps category details right now. Please try again later.";

  try {
    [category, items] = await Promise.all([
      db.gearCategory.findFirst({
        where: {
          id: categoryId,
          AND: [access.categoryWhere],
        },
        select: {
          id: true,
          name: true,
          description: true,
          inventoryType: true,
        },
      }),
      db.gearItem.findMany({
        where: {
          gearCategoryId: categoryId,
          AND: [access.where],
        },
        select: {
          id: true,
          name: true,
          inventoryType: true,
          lifecycleStatus: true,
        },
        orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      }),
    ]);
  } catch (error) {
    queryFailed = true;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading GearOps category details.";
    }
  }

  if (queryFailed || !items) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear category</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (!category) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear category</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Category not found in the selected organization scope.</p>
        </div>
      </section>
    );
  }

  const activeItemCount = items.filter((item) => item.lifecycleStatus === GearItemLifecycleStatus.ACTIVE).length;

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <BackLink href="/gear-ops/categories" label="Categories" />
        <GearOpsSubnav current="categories" />
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{category.name}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {category.description ?? "No category description has been recorded yet."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {formatGearOpsEnum(category.inventoryType)}
            </span>
            <Link
              href={`/gear-ops/categories/${category.id}/edit`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Edit
            </Link>
          </div>
        </div>
      </div>

      <dl className="grid gap-3 rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Active items</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{activeItemCount}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Linked items</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{items.length}</dd>
        </div>
      </dl>

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Linked items</h3>
        {items.length === 0 ? (
          <EmptyState message="No linked items are currently visible for this category." />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-medium">
                      <Link href={`/gear-ops/items/${item.id}`} className="underline">
                        {item.name}
                      </Link>
                    </h4>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">{formatGearOpsEnum(item.inventoryType)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getGearLifecycleBadgeClass(item.lifecycleStatus)}`}>
                    {formatGearOpsEnum(item.lifecycleStatus)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
