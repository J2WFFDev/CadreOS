import {
  ConsumableTransactionType,
  GearReservationMode,
  GearReservationStatus,
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
import { GearDashboardCard } from "@/components/gear-ops/dashboard-card";
import { GearExceptionPanel, type GearException } from "@/components/gear-ops/exception-panel";
import { GearPendingDashboardCard } from "@/components/gear-ops/pending-dashboard-card";
import { GearQuickActionGrid, type GearQuickAction } from "@/components/gear-ops/quick-action-card";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import {
  countOpenGearWorkflowTasksByCategory,
  listOpenGearWorkflowTasks,
} from "@/lib/gear-ops-workflows";
import { formatGearOpsDateTime, formatGearOpsEnum } from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { toneToBoxClass } from "@/lib/gear-ops-ui";
import { getOrganizationScope } from "@/lib/organization-context";
import { describeSchemaUnavailableError, isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

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
        activeReservations: number;
        activeHolds: number;
        upcomingReservations: number;
        conflictingReservations: number;
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
  let openMaintenanceWorkflowTasks = 0;
  let openMissingWorkflowTasks = 0;
  let openDamageWorkflowTasks = 0;
  let recentWorkflowTasks: Awaited<ReturnType<typeof listOpenGearWorkflowTasks>> = [];
  let queryErrorMessage = "Unable to load GearOps dashboard metrics right now. Please try again later.";

  try {
    // --- Core GearOps queries (required tables: GearCategory, GearItem, GearAssignment,
    //     GearCheckout, ConsumableTransaction). These must succeed for the dashboard to load.
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

    // --- Optional GearReservation queries (Arc 20 feature — gracefully degrades to 0
    //     if the GearReservation table is not yet migrated in this environment).
    let activeReservations = 0;
    let activeHolds = 0;
    let upcomingReservations = 0;
    let conflictingReservations = 0;

    try {
      [activeReservations, activeHolds, upcomingReservations, conflictingReservations] = await Promise.all([
        db.gearReservation.count({
          where: {
            organizationId: scope.organizationId,
            status: { in: [GearReservationStatus.ACTIVE, GearReservationStatus.PENDING_REVIEW] },
            mode: GearReservationMode.HARD_RESERVATION,
            windowStartAt: { lte: now },
            windowEndAt: { gte: now },
            gearItem: { AND: [access.where] },
          },
        }),
        db.gearReservation.count({
          where: {
            organizationId: scope.organizationId,
            status: { in: [GearReservationStatus.ACTIVE, GearReservationStatus.PENDING_REVIEW] },
            mode: GearReservationMode.SOFT_HOLD,
            windowStartAt: { lte: now },
            windowEndAt: { gte: now },
            gearItem: { AND: [access.where] },
          },
        }),
        db.gearReservation.count({
          where: {
            organizationId: scope.organizationId,
            status: { in: [GearReservationStatus.ACTIVE, GearReservationStatus.PENDING_REVIEW] },
            windowStartAt: { gt: now },
            gearItem: { AND: [access.where] },
          },
        }),
        db.gearReservation.count({
          where: {
            organizationId: scope.organizationId,
            status: GearReservationStatus.CONFLICT,
            gearItem: { AND: [access.where] },
          },
        }),
      ]);
    } catch (reservationError) {
      const detail = describeSchemaUnavailableError(reservationError);
      if (detail) {
        console.warn(
          `[GearOps] GearReservation schema check failed (${detail}). ` +
            "Reservation counts will show 0. Run database setup to apply the GearReservation migration.",
        );
      } else {
        console.warn("[GearOps] GearReservation queries failed unexpectedly:", reservationError);
      }
      // Reservation counts remain at their default 0 values — dashboard continues to load.
    }

    [openMaintenanceWorkflowTasks, openMissingWorkflowTasks, openDamageWorkflowTasks, recentWorkflowTasks] = await Promise.all([
      countOpenGearWorkflowTasksByCategory({ organizationId: scope.organizationId, category: "maintenance" }),
      countOpenGearWorkflowTasksByCategory({ organizationId: scope.organizationId, category: "missing" }),
      countOpenGearWorkflowTasksByCategory({ organizationId: scope.organizationId, category: "damage" }),
      listOpenGearWorkflowTasks({ organizationId: scope.organizationId, limit: 5 }),
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
      activeAssignmentRecords,
      openCheckoutRecords,
      activeReservations,
      activeHolds,
      upcomingReservations,
      conflictingReservations,
      lowAvailabilityConsumables: lowAvailabilityConsumablesCount,
      consumableUsageUnits30d,
      consumableReplenishmentUnits30d,
      consumableNetDelta30d,
      readinessConcerns:
        maintenanceItems + conditionConcernItems + lowAvailabilityConsumablesCount + openCheckoutRecords,
    };
    lowAvailabilityConsumables = lowAvailabilityItems;
    openCheckouts = openCheckoutItems;
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      const detail = describeSchemaUnavailableError(error);
      queryErrorMessage = detail
        ? `Database schema is not available yet (${detail}). Run database setup before loading GearOps dashboard.`
        : "Database schema is not available yet. Run database setup before loading GearOps dashboard.";
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
    <section className="space-y-6">
      <PageHeader title="GearOps" description="Manage gear inventory, custody, readiness, and event deployment." />
      <GearOpsSubnav current="overview" />

      {/* Readiness concern banner */}
      {summary.readinessConcerns > 0 ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${toneToBoxClass("warning")}`}>
          <p className="font-semibold">
            {summary.readinessConcerns} readiness concern{summary.readinessConcerns === 1 ? "" : "s"} detected
          </p>
          <p className="mt-0.5 opacity-80">
            {summary.maintenanceItems > 0 && `${summary.maintenanceItems} in maintenance`}
            {summary.maintenanceItems > 0 && summary.conditionConcernItems > 0 ? " · " : ""}
            {summary.conditionConcernItems > 0 && `${summary.conditionConcernItems} condition concern${summary.conditionConcernItems === 1 ? "" : "s"}`}
            {(summary.maintenanceItems > 0 || summary.conditionConcernItems > 0) && summary.lowAvailabilityConsumables > 0 ? " · " : ""}
            {summary.lowAvailabilityConsumables > 0 && `${summary.lowAvailabilityConsumables} low-stock consumable${summary.lowAvailabilityConsumables === 1 ? "" : "s"}`}
            {" · "}
            <Link href="/gear-ops/items?lifecycleStatus=MAINTENANCE" className="font-medium underline">
              Review
            </Link>
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-lg font-semibold">EntryOps workflow visibility</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Open maintenance tasks</dt>
              <dd className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{openMaintenanceWorkflowTasks}</dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Open missing-item tasks</dt>
              <dd className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{openMissingWorkflowTasks}</dd>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <dt className="font-medium text-zinc-900 dark:text-zinc-100">Open damage-review tasks</dt>
              <dd className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{openDamageWorkflowTasks}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-lg font-semibold">Recent linked workflow tasks</h3>
          {recentWorkflowTasks.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              No open GearOps workflow tasks are currently linked into EntryOps.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {recentWorkflowTasks.map((task) => (
                <article key={task.taskId} className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/tasks/${task.taskId}?returnTo=${encodeURIComponent("/gear-ops")}`} className="font-medium underline">
                        {task.title}
                      </Link>
                      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                        {task.assigneeName} · Updated {formatGearOpsDateTime(task.updatedAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      {formatGearOpsEnum(task.status)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick-action area for field operators */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Quick actions
        </h2>
        <GearQuickActionGrid
          actions={QUICK_ACTIONS}
        />
      </div>

      {/* Metric summary cards */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Inventory overview
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <GearPendingDashboardCard />
          <GearDashboardCard label="Total items" value={summary.totalItems} href="/gear-ops/items" />
          <GearDashboardCard label="Active / available" value={summary.activeAvailableItems} href="/gear-ops/items?lifecycleStatus=ACTIVE" tone="success" />
          <GearDashboardCard
            label="Assigned or checked out"
            value={summary.assignedOrCheckedOutItems}
            href="/gear-ops/items?lifecycleStatus=ASSIGNED&lifecycleStatus=CHECKED_OUT"
            tone="info"
          />
          <GearDashboardCard label="Reserved now" value={summary.activeReservations} href="/gear-ops/reports#reservation-reporting" tone="info" />
          <GearDashboardCard label="Held now" value={summary.activeHolds} href="/gear-ops/reports#reservation-reporting" />
          <GearDashboardCard label="Upcoming reservations" value={summary.upcomingReservations} href="/gear-ops/reports#reservation-reporting" />
          <GearDashboardCard label="Reservation conflicts" value={summary.conflictingReservations} href="/gear-ops/reports#reservation-reporting" tone="warning" />
          <GearDashboardCard
            label="In maintenance"
            value={summary.maintenanceItems}
            href="/gear-ops/items?lifecycleStatus=MAINTENANCE"
            tone={summary.maintenanceItems > 0 ? "warning" : "neutral"}
          />
          <GearDashboardCard label="Durable items" value={summary.durableItems} href="/gear-ops/items?inventoryType=DURABLE" />
          <GearDashboardCard label="Consumable items" value={summary.consumableItems} href="/gear-ops/items?inventoryType=CONSUMABLE" />
          <GearDashboardCard
            label="Condition concerns"
            value={summary.conditionConcernItems}
            href="/gear-ops/items?conditionStatus=POOR&conditionStatus=DAMAGED"
            tone={summary.conditionConcernItems > 0 ? "warning" : "neutral"}
          />
          <GearDashboardCard
            label="Low-stock consumables"
            value={summary.lowAvailabilityConsumables}
            href="/gear-ops/items?inventoryType=CONSUMABLE"
            tone={summary.lowAvailabilityConsumables > 0 ? "warning" : "neutral"}
          />
          <GearDashboardCard label="Active assignments" value={summary.activeAssignmentRecords} href="/gear-ops/items" />
          <GearDashboardCard
            label="Open checkouts"
            value={summary.openCheckoutRecords}
            href="/gear-ops/items"
            tone={summary.openCheckoutRecords > 0 ? "info" : "neutral"}
          />
          <GearDashboardCard label="Categories" value={summary.totalCategories} href="/gear-ops/categories" />
          <GearDashboardCard
            label="Readiness concerns"
            value={summary.readinessConcerns}
            href="/gear-ops/items"
            tone={summary.readinessConcerns > 0 ? "warning" : "success"}
          />
        </div>
      </div>

      {summary.totalItems === 0 ? (
        <EmptyState
          message="No gear items are visible for this organization yet."
          actionHref="/gear-ops/categories"
          actionLabel="Review categories"
        />
      ) : (
        <>
          {/* Exceptions panel */}
          <GearExceptionPanel
            title="Operational exceptions"
            exceptions={buildDashboardExceptions({
              lowAvailabilityConsumables,
              openCheckouts,
              maintenanceItems: summary.maintenanceItems,
              conditionConcernItems: summary.conditionConcernItems,
            })}
          />

          {/* Consumable trend + spotlight lists */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold">Consumable trend (30 days)</h3>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md border p-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">Used</dt>
                  <dd className="mt-1 text-base font-semibold text-amber-700 dark:text-amber-400">
                    {summary.consumableUsageUnits30d}
                  </dd>
                </div>
                <div className="rounded-md border p-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">Received</dt>
                  <dd className="mt-1 text-base font-semibold text-emerald-700 dark:text-emerald-400">
                    {summary.consumableReplenishmentUnits30d}
                  </dd>
                </div>
                <div className="rounded-md border p-2">
                  <dt className="text-zinc-500 dark:text-zinc-400">Net</dt>
                  <dd className={`mt-1 text-base font-semibold ${summary.consumableNetDelta30d >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                    {summary.consumableNetDelta30d > 0 ? "+" : ""}{summary.consumableNetDelta30d}
                  </dd>
                </div>
              </dl>
              <div className="mt-3">
                <Link href="/gear-ops/items?inventoryType=CONSUMABLE" className="text-sm underline">
                  Review consumables
                </Link>
              </div>
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold">Low-stock consumables</h3>
              {lowAvailabilityConsumables.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  No low-stock consumables right now.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {lowAvailabilityConsumables.slice(0, 3).map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/30">
                      <div>
                        <Link href={`/gear-ops/items/${item.id}`} className="font-medium hover:underline">
                          {item.name}
                        </Link>
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          On hand: {item.quantityOnHand} · Min: {item.quantityMin ?? "—"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                        Low
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold">Open checkouts</h3>
              {openCheckouts.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  No open checkouts right now.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {openCheckouts.slice(0, 3).map((checkout) => (
                    <li key={checkout.id} className="rounded-md border p-2">
                      <Link href={`/gear-ops/items/${checkout.gearItem.id}`} className="font-medium hover:underline">
                        {checkout.gearItem.name}
                      </Link>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {checkout.checkedOutBy.firstName} {checkout.checkedOutBy.lastName}
                        {" · "}
                        <span className={checkout.status === GearCheckoutStatus.OVERDUE ? "text-amber-700 dark:text-amber-400" : ""}>
                          {formatGearOpsEnum(checkout.status)}
                        </span>
                        {" · "}{formatGearOpsDateTime(checkout.checkedOutAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

const QUICK_ACTIONS: GearQuickAction[] = [
  {
    key: "scan",
    title: "Scan gear",
    description: "Check out, check in, or look up any item by barcode or QR code.",
    href: "/gear-ops/scan",
    primary: true,
  },
  {
    key: "items",
    title: "Browse items",
    description: "View all gear with lifecycle, readiness, and custody status.",
    href: "/gear-ops/items",
  },
  {
    key: "reports",
    title: "Reports & exceptions",
    description: "Readiness summary, custody report, consumable trends, and event gaps.",
    href: "/gear-ops/reports",
  },
  {
    key: "locations",
    title: "Locations",
    description: "Vault, cage, and staging location assignments.",
    href: "/gear-ops/locations",
  },
  {
    key: "categories",
    title: "Categories",
    description: "Configure behavior, custody mode, and maintenance rules per category.",
    href: "/gear-ops/categories",
  },
  {
    key: "audits",
    title: "Audits",
    description: "Start a physical count session or review discrepancy records.",
    href: "/gear-ops/audits",
  },
];

function buildDashboardExceptions({
  lowAvailabilityConsumables,
  openCheckouts,
  maintenanceItems,
  conditionConcernItems,
}: {
  lowAvailabilityConsumables: Array<{ id: string; name: string; quantityOnHand: number; quantityMin: number | null }>;
  openCheckouts: Array<{
    id: string;
    status: GearCheckoutStatus;
    gearItem: { id: string; name: string };
    checkedOutBy: { id: string; firstName: string; lastName: string };
    checkedOutAt: Date;
  }>;
  maintenanceItems: number;
  conditionConcernItems: number;
}): GearException[] {
  const exceptions: GearException[] = [];

  if (maintenanceItems > 0) {
    exceptions.push({
      id: "maintenance-items",
      severity: "warning",
      title: `${maintenanceItems} item${maintenanceItems === 1 ? "" : "s"} in maintenance`,
      detail: "These items are unavailable until maintenance or inspection is complete.",
      href: "/gear-ops/items?lifecycleStatus=MAINTENANCE",
      actionLabel: "Review",
    });
  }

  if (conditionConcernItems > 0) {
    exceptions.push({
      id: "condition-concerns",
      severity: "warning",
      title: `${conditionConcernItems} item${conditionConcernItems === 1 ? "" : "s"} with condition concerns`,
      detail: "Items rated Poor or Damaged should be inspected before next use.",
      href: "/gear-ops/items?conditionStatus=POOR&conditionStatus=DAMAGED",
      actionLabel: "Review",
    });
  }

  for (const item of lowAvailabilityConsumables) {
    exceptions.push({
      id: `low-consumable-${item.id}`,
      severity: "warning",
      title: `${item.name} — low stock`,
      detail: `On hand: ${item.quantityOnHand} · Minimum: ${item.quantityMin ?? "—"}`,
      href: `/gear-ops/items/${item.id}`,
      actionLabel: "View item",
    });
  }

  for (const checkout of openCheckouts.filter((c) => c.status === GearCheckoutStatus.OVERDUE)) {
    exceptions.push({
      id: `overdue-checkout-${checkout.id}`,
      severity: "warning",
      title: `${checkout.gearItem.name} — overdue checkout`,
      detail: `Checked out by ${checkout.checkedOutBy.firstName} ${checkout.checkedOutBy.lastName} · ${formatGearOpsDateTime(checkout.checkedOutAt)}`,
      href: `/gear-ops/items/${checkout.gearItem.id}`,
      actionLabel: "View item",
    });
  }

  return exceptions;
}
