import { GearConditionStatus, GearInventoryType, GearItemLifecycleStatus } from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

function SummaryCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href?: string;
}) {
  const content = (
    <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </article>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block rounded-lg transition hover:opacity-90">
      {content}
    </Link>
  );
}

export default async function GearOpsDashboardPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load the GearOps dashboard right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.overview.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="GearOps" description="Read-only catalog visibility for categories and gear inventory." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let summary:
    | {
        totalCategories: number;
        totalItems: number;
        durableItems: number;
        consumableItems: number;
        activeAvailableItems: number;
        assignedOrCheckedOutItems: number;
        maintenanceItems: number;
        conditionConcernItems: number;
      }
    | null = null;
  let queryErrorMessage = "Unable to load GearOps dashboard metrics right now. Please try again later.";

  try {
    const [
      totalCategories,
      totalItems,
      durableItems,
      consumableItems,
      activeAvailableItems,
      assignedOrCheckedOutItems,
      maintenanceItems,
      conditionConcernItems,
    ] = await Promise.all([
      db.gearCategory.count({ where: access.categoryWhere }),
      db.gearItem.count({ where: access.where }),
      db.gearItem.count({ where: { ...access.where, inventoryType: GearInventoryType.DURABLE } }),
      db.gearItem.count({ where: { ...access.where, inventoryType: GearInventoryType.CONSUMABLE } }),
      db.gearItem.count({ where: { ...access.where, lifecycleStatus: GearItemLifecycleStatus.ACTIVE } }),
      db.gearItem.count({
        where: {
          ...access.where,
          lifecycleStatus: { in: [GearItemLifecycleStatus.ASSIGNED, GearItemLifecycleStatus.CHECKED_OUT] },
        },
      }),
      db.gearItem.count({ where: { ...access.where, lifecycleStatus: GearItemLifecycleStatus.MAINTENANCE } }),
      db.gearItem.count({
        where: {
          ...access.where,
          conditionStatus: {
            in: [GearConditionStatus.POOR, GearConditionStatus.DAMAGED],
          },
        },
      }),
    ]);

    summary = {
      totalCategories,
      totalItems,
      durableItems,
      consumableItems,
      activeAvailableItems,
      assignedOrCheckedOutItems,
      maintenanceItems,
      conditionConcernItems,
    };
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading GearOps dashboard.";
    }
  }

  if (!summary) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader title="GearOps" description="Read-only catalog visibility for categories and gear inventory." />
      <GearOpsSubnav current="overview" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total categories" value={summary.totalCategories} href="/gear-ops/categories" />
        <SummaryCard label="Total gear items" value={summary.totalItems} href="/gear-ops/items" />
        <SummaryCard label="Durable items" value={summary.durableItems} href="/gear-ops/items?inventoryType=DURABLE" />
        <SummaryCard label="Consumable items" value={summary.consumableItems} href="/gear-ops/items?inventoryType=CONSUMABLE" />
        <SummaryCard label="Active / available" value={summary.activeAvailableItems} href="/gear-ops/items?lifecycleStatus=ACTIVE" />
        <SummaryCard
          label="Assigned or checked out"
          value={summary.assignedOrCheckedOutItems}
          href="/gear-ops/items?lifecycleStatus=ASSIGNED&lifecycleStatus=CHECKED_OUT"
        />
        <SummaryCard label="In maintenance" value={summary.maintenanceItems} href="/gear-ops/items?lifecycleStatus=MAINTENANCE" />
        <SummaryCard label="Condition concerns" value={summary.conditionConcernItems} href="/gear-ops/items?conditionStatus=POOR&conditionStatus=DAMAGED" />
      </div>

      {summary.totalItems === 0 ? (
        <EmptyState
          message="No gear items are visible for this organization yet."
          actionHref="/gear-ops/categories"
          actionLabel="Review categories"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-sm font-medium">Catalog drill-down</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Browse category-level inventory summaries and linked item records.
            </p>
            <div className="mt-3">
              <Link href="/gear-ops/categories" className="text-sm underline">
                Open categories
              </Link>
            </div>
          </div>
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-sm font-medium">Item-level visibility</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Review lifecycle status, condition, assignment, checkout, and maintenance context.
            </p>
            <div className="mt-3">
              <Link href="/gear-ops/items" className="text-sm underline">
                Open gear items
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
