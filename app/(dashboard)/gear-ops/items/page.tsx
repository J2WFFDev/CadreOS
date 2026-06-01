import {
  GearAssignmentStatus,
  GearCheckoutStatus,
  GearConditionStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
  type InventoryReadinessState,
  Prisma,
} from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  GearAvailabilityChip,
  GearConditionBadge,
  GearInventoryTypeBadge,
  GearLifecycleBadge,
} from "@/components/gear-ops/status-badge";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import {
  formatGearOpsDateTime,
  formatGearOpsEnum,
} from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { deriveAvailabilitySignal } from "@/lib/gear-ops-ui";
import { getOrganizationScope } from "@/lib/organization-context";
import { describeSchemaUnavailableError, isSchemaUnavailableError } from "@/lib/workflows";

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
  const queryText = readSearchParams(resolvedSearchParams, "q")[0]?.trim() ?? "";

  const hasFilters = inventoryTypeFilter.length > 0 || lifecycleStatusFilter.length > 0 || conditionStatusFilter.length > 0;
  const buildItemWhere = (includeAssetId: boolean): Prisma.GearItemWhereInput => {
    const searchFilters: Prisma.GearItemWhereInput[] = [];
    if (queryText.length > 0) {
      searchFilters.push({ name: { contains: queryText, mode: "insensitive" } });
      if (includeAssetId) {
        searchFilters.push({ assetId: { contains: queryText, mode: "insensitive" } });
      }
      searchFilters.push({ barcodeValue: { equals: queryText, mode: "insensitive" } });
      searchFilters.push({ serialNumber: { equals: queryText, mode: "insensitive" } });
      searchFilters.push({ sku: { equals: queryText, mode: "insensitive" } });
    }

    return {
    ...access.where,
    ...(searchFilters.length > 0 ? { OR: searchFilters } : {}),
    ...(inventoryTypeFilter.length > 0 ? { inventoryType: { in: inventoryTypeFilter } } : {}),
    ...(lifecycleStatusFilter.length > 0 ? { lifecycleStatus: { in: lifecycleStatusFilter } } : {}),
    ...(conditionStatusFilter.length > 0 ? { conditionStatus: { in: conditionStatusFilter } } : {}),
    };
  };

  let items:
    | Array<{
        id: string;
        name: string;
        assetId: string | null;
        inventoryType: GearInventoryType;
        lifecycleStatus: GearItemLifecycleStatus;
        conditionStatus: GearConditionStatus | null;
        inventoryCondition: import("@prisma/client").InventoryConditionStatus | null;
        readinessState: InventoryReadinessState | null;
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
  let assetIdUnavailable = false;

  try {
    items = await db.gearItem.findMany({
      where: buildItemWhere(true),
      select: {
        id: true,
        name: true,
        assetId: true,
        inventoryType: true,
        lifecycleStatus: true,
        conditionStatus: true,
        inventoryCondition: true,
        readinessState: true,
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
    const detail = describeSchemaUnavailableError(error);
    const isMissingAssetIdColumn =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2022" &&
      (error.meta as Record<string, unknown> | undefined)?.column === "GearItem.assetId";
    if (isSchemaUnavailableError(error) && isMissingAssetIdColumn) {
      assetIdUnavailable = true;
      try {
        const fallbackItems = await db.gearItem.findMany({
          where: buildItemWhere(false),
          select: {
            id: true,
            name: true,
            inventoryType: true,
            lifecycleStatus: true,
            conditionStatus: true,
            inventoryCondition: true,
            readinessState: true,
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
        items = fallbackItems.map((item) => ({ ...item, assetId: null }));
      } catch (fallbackError) {
        console.error("[gear-ops.items.page] Fallback item list query failed", {
          organizationId: scope.organizationId,
          actorPersonId: scope.auth.personId,
          schemaDetail: describeSchemaUnavailableError(fallbackError),
          moduleQuery: "gearItem.findMany.fallbackWithoutAssetId",
          error: fallbackError,
        });
      }
    }
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = detail
        ? `GearOps items query dependency is missing (${detail}) while running gearItem.findMany.`
        : "Database schema is not available yet. Run database setup before loading GearOps items.";
    }
    console.error("[gear-ops.items.page] Failed to load item list", {
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      schemaDetail: describeSchemaUnavailableError(error),
      moduleQuery: "gearItem.findMany",
      error,
    });
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
      <PageHeader title="GearOps items" description="Inventory item catalog with assignment, custody, and maintenance context." />
      <GearOpsSubnav current="items" />
      {assetIdUnavailable ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          Asset ID display/search is temporarily unavailable until the <code>GearItem.assetId</code> column is present in the active database schema.
        </div>
      ) : null}

      {/* Top action row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildHref("/gear-ops/items", { lifecycleStatus: [GearItemLifecycleStatus.ACTIVE] })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              lifecycleStatusFilter.includes(GearItemLifecycleStatus.ACTIVE)
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            Active
          </Link>
          <Link
            href={buildHref("/gear-ops/items", { lifecycleStatus: [GearItemLifecycleStatus.MAINTENANCE] })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              lifecycleStatusFilter.includes(GearItemLifecycleStatus.MAINTENANCE)
                ? "bg-amber-600 text-white"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            Maintenance
          </Link>
          <Link
            href={buildHref("/gear-ops/items", { inventoryType: [GearInventoryType.CONSUMABLE] })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              inventoryTypeFilter.includes(GearInventoryType.CONSUMABLE)
                ? "bg-sky-600 text-white"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            }`}
          >
            Consumables
          </Link>
          {hasFilters ? (
            <Link href="/gear-ops/items" className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400">
              ✕ Clear
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/gear-ops/scan?scanContext=INVENTORY_LOOKUP" className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Scan lookup
          </Link>
          <Link
            href="/gear-ops/items/new"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            New item
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
        <form action="/gear-ops/items" method="get" className="flex flex-col gap-2 sm:flex-row">
          {inventoryTypeFilter.map((v) => (
            <input key={v} type="hidden" name="inventoryType" value={v} />
          ))}
          {lifecycleStatusFilter.map((v) => (
            <input key={v} type="hidden" name="lifecycleStatus" value={v} />
          ))}
          {conditionStatusFilter.map((v) => (
            <input key={v} type="hidden" name="conditionStatus" value={v} />
          ))}
          <input
            name="q"
            defaultValue={queryText}
            placeholder="Search by Asset ID, name, barcode/QR, serial, or SKU"
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Search
          </button>
        </form>
      </div>

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
            const availabilitySignal = deriveAvailabilitySignal({
              lifecycleStatus: item.lifecycleStatus,
              hasOpenCheckout: activeCheckout !== null,
              hasActiveAssignment: activeAssignment !== null,
              readinessState: item.readinessState,
              inventoryCondition: item.inventoryCondition,
            });

            return (
              <article key={item.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                {/* Item header: name + availability + type badges */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium">
                      <Link href={`/gear-ops/items/${item.id}`} className="underline hover:text-zinc-600 dark:hover:text-zinc-300">
                        {item.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {item.assetId ? (
                        <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{item.assetId}</span>
                      ) : null}
                      {item.assetId ? " · " : null}
                      <Link href={`/gear-ops/categories/${item.category.id}`} className="underline">
                        {item.category.name}
                      </Link>
                      {item.program ? (
                        <>
                          {" · "}
                          <Link href={`/programs/${item.program.id}`} className="underline">
                            {item.program.name}
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <GearAvailabilityChip signal={availabilitySignal} />
                    <GearLifecycleBadge status={item.lifecycleStatus} />
                    <GearInventoryTypeBadge type={item.inventoryType} />
                    {item.conditionStatus ? <GearConditionBadge status={item.conditionStatus} /> : null}
                  </div>
                </div>

                {/* Custody & stock row */}
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  {activeCheckout ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Checked out by</dt>
                      <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                        <Link href={`/people/${activeCheckout.checkedOutBy.id}`} className="underline">
                          {activeCheckout.checkedOutBy.firstName} {activeCheckout.checkedOutBy.lastName}
                        </Link>
                        {activeCheckout.event ? (
                          <span className="text-zinc-500">
                            {" · "}
                            <Link href={`/events/${activeCheckout.event.id}`} className="underline">
                              {activeCheckout.event.title}
                            </Link>
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  ) : activeAssignment ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Assigned to</dt>
                      <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">
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
                          <span className="text-zinc-500">Context pending</span>
                        )}
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Stock</dt>
                    <dd className="mt-0.5 text-zinc-800 dark:text-zinc-200">
                      {item.quantityOnHand} on hand
                      {item.inventoryType === GearInventoryType.CONSUMABLE && item.quantityMin !== null ? (
                        <span className={item.quantityOnHand <= item.quantityMin ? " text-amber-600 font-medium" : " text-zinc-500"}>
                          {" · "}min {item.quantityMin}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  {latestMaintenance ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Last maintenance</dt>
                      <dd className="mt-0.5 text-zinc-500 dark:text-zinc-400 text-xs">
                        {formatGearOpsEnum(latestMaintenance.maintenanceType)} · {formatGearOpsDateTime(latestMaintenance.performedAt)}
                      </dd>
                    </div>
                  ) : null}
                  {latestTransaction ? (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Last transaction</dt>
                      <dd className="mt-0.5 text-zinc-500 dark:text-zinc-400 text-xs">
                        {formatGearOpsEnum(latestTransaction.transactionType)}{" "}
                        ({latestTransaction.quantityDelta > 0 ? "+" : ""}{latestTransaction.quantityDelta}) · {formatGearOpsDateTime(latestTransaction.recordedAt)}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {/* Item detail link */}
                <div className="mt-3 flex justify-end">
                  <Link href={`/gear-ops/items/${item.id}`} className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300">
                    View details →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
