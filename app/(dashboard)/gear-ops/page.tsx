import {
  ConsumableTransactionType,
  GearAssignmentStatus,
  GearCheckoutStatus,
  GearConditionStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
} from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsDateTime, formatGearOpsEnum } from "@/lib/gear-ops";
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

  const now = new Date();
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
        activeAssignmentRecords: number;
        openCheckoutRecords: number;
        lowAvailabilityConsumables: number;
        consumableUsageUnits30d: number;
        consumableReplenishmentUnits30d: number;
        consumableNetDelta30d: number;
        readinessConcerns: number;
      }
    | null = null;
  let lowAvailabilityConsumables: Array<{ id: string; name: string; quantityOnHand: number; quantityMin: number | null }> = [];
  let openCheckouts: Array<{
    id: string;
    checkedOutAt: Date;
    status: GearCheckoutStatus;
    gearItem: { id: string; name: string };
    checkedOutBy: { id: string; firstName: string; lastName: string };
  }> = [];
  let recentConsumableTransactions: Array<{
    id: string;
    recordedAt: Date;
    transactionType: ConsumableTransactionType;
    quantityDelta: number;
    gearItem: { id: string; name: string };
  }> = [];
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
      activeAssignmentRecords,
      openCheckoutRecords,
      lowAvailabilityConsumablesCount,
      lowAvailabilityItems,
      openCheckoutItems,
      recentTransactions,
      usageAggregate30d,
      replenishmentAggregate30d,
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
      db.gearAssignment.count({
        where: {
          organizationId: scope.organizationId,
          status: {
            in: [GearAssignmentStatus.PENDING, GearAssignmentStatus.ACTIVE, GearAssignmentStatus.OVERDUE],
          },
          gearItem: { AND: [access.where] },
        },
      }),
      db.gearCheckout.count({
        where: {
          organizationId: scope.organizationId,
          status: {
            in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE],
          },
          gearItem: { AND: [access.where] },
        },
      }),
      db.gearItem.count({
        where: {
          ...access.where,
          inventoryType: GearInventoryType.CONSUMABLE,
          quantityMin: { not: null },
          quantityOnHand: { lte: db.gearItem.fields.quantityMin },
        },
      }),
      db.gearItem.findMany({
        where: {
          ...access.where,
          inventoryType: GearInventoryType.CONSUMABLE,
          quantityMin: { not: null },
          quantityOnHand: { lte: db.gearItem.fields.quantityMin },
        },
        select: {
          id: true,
          name: true,
          quantityOnHand: true,
          quantityMin: true,
        },
        orderBy: [{ quantityOnHand: "asc" }, { updatedAt: "asc" }],
        take: 5,
      }),
      db.gearCheckout.findMany({
        where: {
          organizationId: scope.organizationId,
          status: {
            in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE],
          },
          gearItem: { AND: [access.where] },
        },
        select: {
          id: true,
          checkedOutAt: true,
          status: true,
          gearItem: { select: { id: true, name: true } },
          checkedOutBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
      db.consumableTransaction.findMany({
        where: {
          organizationId: scope.organizationId,
          gearItem: { AND: [access.where] },
          recordedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: {
          id: true,
          recordedAt: true,
          transactionType: true,
          quantityDelta: true,
          gearItem: { select: { id: true, name: true } },
        },
        orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
      db.consumableTransaction.aggregate({
        where: {
          organizationId: scope.organizationId,
          gearItem: { AND: [access.where] },
          recordedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
          transactionType: {
            in: [
              ConsumableTransactionType.USED,
              ConsumableTransactionType.DISTRIBUTED,
              ConsumableTransactionType.DISPOSED,
            ],
          },
        },
        _sum: {
          quantityDelta: true,
        },
      }),
      db.consumableTransaction.aggregate({
        where: {
          organizationId: scope.organizationId,
          gearItem: { AND: [access.where] },
          recordedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
          transactionType: {
            in: [ConsumableTransactionType.RECEIVED],
          },
        },
        _sum: {
          quantityDelta: true,
        },
      }),
    ]);

    const consumableUsageUnits30d = Math.abs(usageAggregate30d._sum.quantityDelta ?? 0);
    const consumableReplenishmentUnits30d = Math.max(replenishmentAggregate30d._sum.quantityDelta ?? 0, 0);
    const consumableNetDelta30d = consumableReplenishmentUnits30d - consumableUsageUnits30d;

    summary = {
      totalCategories,
      totalItems,
      durableItems,
      consumableItems,
      activeAvailableItems,
      assignedOrCheckedOutItems,
      maintenanceItems,
      conditionConcernItems,
      activeAssignmentRecords,
      openCheckoutRecords,
      lowAvailabilityConsumables: lowAvailabilityConsumablesCount,
      consumableUsageUnits30d,
      consumableReplenishmentUnits30d,
      consumableNetDelta30d,
      readinessConcerns:
        maintenanceItems + conditionConcernItems + lowAvailabilityConsumablesCount + openCheckoutRecords,
    };
    lowAvailabilityConsumables = lowAvailabilityItems;
    openCheckouts = openCheckoutItems;
    recentConsumableTransactions = recentTransactions;
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

      <div className="flex flex-wrap justify-end gap-2">
        <Link href="/gear-ops/labels" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Labels
        </Link>
        <Link href="/gear-ops/scan?scanContext=INVENTORY_LOOKUP" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Scan lookup
        </Link>
      </div>

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
        <SummaryCard label="Active assignments" value={summary.activeAssignmentRecords} href="/gear-ops/items" />
        <SummaryCard label="Open checkouts" value={summary.openCheckoutRecords} href="/gear-ops/items" />
        <SummaryCard label="Low-availability consumables" value={summary.lowAvailabilityConsumables} href="/gear-ops/items?inventoryType=CONSUMABLE" />
        <SummaryCard label="Readiness concerns" value={summary.readinessConcerns} href="/gear-ops/items" />
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
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-sm font-medium">Consumable trend (30 days)</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Usage: {summary.consumableUsageUnits30d} units · Replenishment: {summary.consumableReplenishmentUnits30d} units · Net:{" "}
              {summary.consumableNetDelta30d > 0 ? "+" : ""}
              {summary.consumableNetDelta30d}
            </p>
            <div className="mt-3">
              <Link href="/gear-ops/items?inventoryType=CONSUMABLE" className="text-sm underline">
                Review consumables
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium">Low-availability consumables</h3>
          {lowAvailabilityConsumables.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              No low-availability consumables are currently visible.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {lowAvailabilityConsumables.slice(0, 3).map((item) => (
                <li key={item.id} className="rounded-md border p-2">
                  <Link href={`/gear-ops/items/${item.id}`} className="font-medium underline">
                    {item.name}
                  </Link>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    On hand {item.quantityOnHand} · Min {item.quantityMin ?? "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium">Open custody checkouts</h3>
          {openCheckouts.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              No open checkout records are currently visible.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {openCheckouts.slice(0, 3).map((checkout) => (
                <li key={checkout.id} className="rounded-md border p-2">
                  <Link href={`/gear-ops/items/${checkout.gearItem.id}`} className="font-medium underline">
                    {checkout.gearItem.name}
                  </Link>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {formatGearOpsDateTime(checkout.checkedOutAt)} · {formatGearOpsEnum(checkout.status)}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Checked out by{" "}
                    <Link href={`/people/${checkout.checkedOutBy.id}`} className="underline">
                      {checkout.checkedOutBy.firstName} {checkout.checkedOutBy.lastName}
                    </Link>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium">Recent consumable activity (30 days)</h3>
          {recentConsumableTransactions.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              No recent consumable transactions are currently visible.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {recentConsumableTransactions.slice(0, 3).map((entry) => (
                <li key={entry.id} className="rounded-md border p-2">
                  <Link href={`/gear-ops/items/${entry.gearItem.id}`} className="font-medium underline">
                    {entry.gearItem.name}
                  </Link>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {formatGearOpsDateTime(entry.recordedAt)} · {formatGearOpsEnum(entry.transactionType)}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Quantity delta: {entry.quantityDelta > 0 ? "+" : ""}
                    {entry.quantityDelta}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
