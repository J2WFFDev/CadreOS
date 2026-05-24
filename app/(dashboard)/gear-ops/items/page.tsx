import {
  GearAssignmentStatus,
  GearCheckoutStatus,
  GearConditionStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
  type Prisma,
} from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import {
  formatGearOpsDateTime,
  formatGearOpsEnum,
  getGearConditionBadgeClass,
  getGearLifecycleBadgeClass,
} from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParams(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function resolveEnumFilter<T extends string>(rawValues: string[], candidates: readonly T[]) {
  const candidateSet = new Set(candidates);
  return Array.from(new Set(rawValues.filter((value): value is T => candidateSet.has(value as T))));
}

function buildHref(pathname: string, filters: Record<string, string[]>) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, values]) => {
    values.forEach((value) => params.append(key, value));
  });
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default async function GearOpsItemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps items</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query GearOps items right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps items</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.items.list.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="GearOps items" description="Read-only inventory item catalog." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  const inventoryTypeFilter = resolveEnumFilter(
    readSearchParams(resolvedSearchParams, "inventoryType"),
    Object.values(GearInventoryType),
  );
  const lifecycleStatusFilter = resolveEnumFilter(
    readSearchParams(resolvedSearchParams, "lifecycleStatus"),
    Object.values(GearItemLifecycleStatus),
  );
  const conditionStatusFilter = resolveEnumFilter(
    readSearchParams(resolvedSearchParams, "conditionStatus"),
    Object.values(GearConditionStatus),
  );

  const hasFilters = inventoryTypeFilter.length > 0 || lifecycleStatusFilter.length > 0 || conditionStatusFilter.length > 0;

  const itemWhere: Prisma.GearItemWhereInput = {
    ...access.where,
    ...(inventoryTypeFilter.length > 0 ? { inventoryType: { in: inventoryTypeFilter } } : {}),
    ...(lifecycleStatusFilter.length > 0 ? { lifecycleStatus: { in: lifecycleStatusFilter } } : {}),
    ...(conditionStatusFilter.length > 0 ? { conditionStatus: { in: conditionStatusFilter } } : {}),
  };

  let items:
    | Array<{
        id: string;
        name: string;
        inventoryType: GearInventoryType;
        lifecycleStatus: GearItemLifecycleStatus;
        conditionStatus: GearConditionStatus | null;
        quantityOnHand: number;
        quantityMin: number | null;
        category: { id: string; name: string; inventoryType: GearInventoryType };
        program: { id: string; name: string } | null;
        assignments: Array<{
          status: GearAssignmentStatus;
          assignedAt: Date;
          assignedTo: { id: string; firstName: string; lastName: string } | null;
          assignedTeam: { id: string; name: string } | null;
          assignedEvent: { id: string; title: string } | null;
        }>;
        checkouts: Array<{
          status: GearCheckoutStatus;
          checkedOutAt: Date;
          checkedOutBy: { id: string; firstName: string; lastName: string };
          event: { id: string; title: string } | null;
        }>;
        maintenanceLogs: Array<{
          maintenanceType: string;
          performedAt: Date;
        }>;
        consumableTransactions: Array<{
          transactionType: string;
          recordedAt: Date;
          quantityDelta: number;
        }>;
      }>
    | null = null;
  let queryErrorMessage = "Unable to load GearOps items right now. Please try again later.";

  try {
    items = await db.gearItem.findMany({
      where: itemWhere,
      select: {
        id: true,
        name: true,
        inventoryType: true,
        lifecycleStatus: true,
        conditionStatus: true,
        quantityOnHand: true,
        quantityMin: true,
        category: { select: { id: true, name: true, inventoryType: true } },
        program: { select: { id: true, name: true } },
        assignments: {
          where: { status: { in: [GearAssignmentStatus.ACTIVE, GearAssignmentStatus.PENDING, GearAssignmentStatus.OVERDUE] } },
          select: {
            status: true,
            assignedAt: true,
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
            assignedTeam: { select: { id: true, name: true } },
            assignedEvent: { select: { id: true, title: true } },
          },
          orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
        checkouts: {
          where: { status: { in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE] } },
          select: {
            status: true,
            checkedOutAt: true,
            checkedOutBy: { select: { id: true, firstName: true, lastName: true } },
            event: { select: { id: true, title: true } },
          },
          orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
        maintenanceLogs: {
          select: { maintenanceType: true, performedAt: true },
          orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
        consumableTransactions: {
          select: { transactionType: true, recordedAt: true, quantityDelta: true },
          orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
        },
      },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading GearOps items.";
    }
  }

  if (!items) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps items</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader title="GearOps items" description="Read-only inventory item catalog with assignment, custody, and maintenance context." />
      <GearOpsSubnav current="items" />

      <div className="flex justify-end">
        <Link
          href="/gear-ops/items/new"
          className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
        >
          New item
        </Link>
      </div>

      {hasFilters ? (
        <div className="rounded-lg border bg-white p-3 text-sm dark:bg-zinc-900">
          <p className="text-zinc-600 dark:text-zinc-400">
            Filters active:
            {inventoryTypeFilter.map((value) => ` ${formatGearOpsEnum(value)}`).join(",")}
            {lifecycleStatusFilter.map((value) => ` ${formatGearOpsEnum(value)}`).join(",")}
            {conditionStatusFilter.map((value) => ` ${formatGearOpsEnum(value)}`).join(",")}
            {" · "}
            <Link href="/gear-ops/items" className="underline">
              Clear filters
            </Link>
          </p>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          message={hasFilters ? "No GearOps items match the current filters." : "No GearOps items are visible yet."}
          actionHref={hasFilters ? "/gear-ops/items" : "/gear-ops/categories"}
          actionLabel={hasFilters ? "Clear filters" : "Review categories"}
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const activeAssignment = item.assignments[0] ?? null;
            const activeCheckout = item.checkouts[0] ?? null;
            const latestMaintenance = item.maintenanceLogs[0] ?? null;
            const latestTransaction = item.consumableTransactions[0] ?? null;

            return (
              <article key={item.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium">
                      <Link href={`/gear-ops/items/${item.id}`} className="underline">
                        {item.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      Category:{" "}
                      <Link href={`/gear-ops/categories/${item.category.id}`} className="underline">
                        {item.category.name}
                      </Link>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {formatGearOpsEnum(item.inventoryType)}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getGearLifecycleBadgeClass(item.lifecycleStatus)}`}>
                      {formatGearOpsEnum(item.lifecycleStatus)}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getGearConditionBadgeClass(item.conditionStatus)}`}>
                      Condition: {item.conditionStatus ? formatGearOpsEnum(item.conditionStatus) : "—"}
                    </span>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="font-medium text-zinc-900 dark:text-zinc-50">Program</dt>
                    <dd className="text-zinc-600 dark:text-zinc-400">
                      {item.program ? <Link href={`/programs/${item.program.id}`} className="underline">{item.program.name}</Link> : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-900 dark:text-zinc-50">Current assignment</dt>
                    <dd className="text-zinc-600 dark:text-zinc-400">
                      {activeAssignment ? (
                        <>
                          {formatGearOpsEnum(activeAssignment.status)} ·{" "}
                          {activeAssignment.assignedTo ? (
                            <Link href={`/people/${activeAssignment.assignedTo.id}`} className="underline">
                              {activeAssignment.assignedTo.firstName} {activeAssignment.assignedTo.lastName}
                            </Link>
                          ) : activeAssignment.assignedTeam ? (
                            <Link href={`/teams/${activeAssignment.assignedTeam.id}`} className="underline">
                              {activeAssignment.assignedTeam.name}
                            </Link>
                          ) : activeAssignment.assignedEvent ? (
                            <Link href={`/events/${activeAssignment.assignedEvent.id}`} className="underline">
                              {activeAssignment.assignedEvent.title}
                            </Link>
                          ) : (
                            "Context pending"
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-900 dark:text-zinc-50">Current checkout</dt>
                    <dd className="text-zinc-600 dark:text-zinc-400">
                      {activeCheckout ? (
                        <>
                          {formatGearOpsEnum(activeCheckout.status)} ·{" "}
                          <Link href={`/people/${activeCheckout.checkedOutBy.id}`} className="underline">
                            {activeCheckout.checkedOutBy.firstName} {activeCheckout.checkedOutBy.lastName}
                          </Link>
                          {activeCheckout.event ? (
                            <>
                              {" "}
                              ·{" "}
                              <Link href={`/events/${activeCheckout.event.id}`} className="underline">
                                {activeCheckout.event.title}
                              </Link>
                            </>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-zinc-900 dark:text-zinc-50">Stock</dt>
                    <dd className="text-zinc-600 dark:text-zinc-400">
                      On hand: {item.quantityOnHand}
                      {item.inventoryType === GearInventoryType.CONSUMABLE
                        ? ` · Min: ${item.quantityMin ?? "—"}`
                        : ""}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 grid gap-3 text-xs text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
                  <p>
                    Recent maintenance:{" "}
                    {latestMaintenance
                      ? `${formatGearOpsEnum(latestMaintenance.maintenanceType)} · ${formatGearOpsDateTime(latestMaintenance.performedAt)}`
                      : "—"}
                  </p>
                  <p>
                    Recent consumable transaction:{" "}
                    {latestTransaction
                      ? `${formatGearOpsEnum(latestTransaction.transactionType)} (${latestTransaction.quantityDelta > 0 ? "+" : ""}${latestTransaction.quantityDelta}) · ${formatGearOpsDateTime(latestTransaction.recordedAt)}`
                      : "—"}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={buildHref("/gear-ops/items", { lifecycleStatus: [GearItemLifecycleStatus.ACTIVE] })}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Active
        </Link>
        <Link
          href={buildHref("/gear-ops/items", { lifecycleStatus: [GearItemLifecycleStatus.MAINTENANCE] })}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Maintenance
        </Link>
        <Link
          href={buildHref("/gear-ops/items", { inventoryType: [GearInventoryType.CONSUMABLE] })}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Consumables
        </Link>
      </div>
    </section>
  );
}
