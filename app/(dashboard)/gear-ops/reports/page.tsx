import {
  ApprovalStatus,
  GearHoldType,
  GearReservationMode,
  GearReservationPurpose,
  GearReservationStatus,
  GearAssignmentStatus,
  GearCheckoutStatus,
  GearItemLifecycleStatus,
  InventoryOwnershipType,
  InventoryReadinessState,
  type Prisma,
} from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import {
  deriveEventGearAssignmentStatus,
  summarizeEventGearRequirement,
} from "@/lib/event-gear";
import {
  buildGearOpsExceptions,
  filterGearOpsItems,
  summarizeConsumables,
  summarizeCustody,
  summarizeEventRequirements,
  summarizeLocations,
  summarizeMaintenance,
  summarizeReadiness,
  THIRTY_DAYS_IN_MS,
  type GearOpsEventRequirementSnapshot,
  type GearOpsItemSnapshot,
  type GearOpsReportFilter,
} from "@/lib/gear-ops-dashboard";
import { formatGearOpsDateTime, formatGearOpsEnum } from "@/lib/gear-ops";
import { summarizeGearReservations } from "@/lib/gear-reservations";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const MAX_EXCEPTION_ROWS = 30;
const MAX_LIST_ROWS = 12;

type GearItemRow = {
  id: string;
  name: string;
  inventoryType: GearOpsItemSnapshot["inventoryType"];
  lifecycleStatus: GearOpsItemSnapshot["lifecycleStatus"];
  conditionStatus: GearOpsItemSnapshot["conditionStatus"];
  ownershipType: GearOpsItemSnapshot["ownershipType"];
  readinessState: GearOpsItemSnapshot["readinessState"];
  quantityOnHand: number;
  quantityMin: number | null;
  // Arc 20Y
  inspectionDueStatus: GearOpsItemSnapshot["inspectionDueStatus"];
  maintenanceDueStatus: GearOpsItemSnapshot["maintenanceDueStatus"];
  nextInspectionDueAt: Date | null;
  nextMaintenanceDueAt: Date | null;
  category: { id: string; name: string };
  location: { id: string; name: string } | null;
  assignments: Array<{
    id: string;
    status: GearAssignmentStatus;
    expectedReturnAt: Date | null;
    returnedAt: Date | null;
    assignedToPersonId: string | null;
    assignedToEventId: string | null;
    assignedTo: { id: string; firstName: string; lastName: string } | null;
    assignedEvent: { id: string; title: string } | null;
  }>;
  checkouts: Array<{
    id: string;
    status: GearCheckoutStatus;
    expectedReturnAt: Date | null;
    returnedAt: Date | null;
    checkedOutAt: Date;
    checkedOutBy: { id: string; firstName: string; lastName: string };
    event: { id: string; title: string } | null;
  }>;
};

type ConsumableTransactionRow = {
  id: string;
  gearItemId: string;
  transactionType: "RECEIVED" | "USED" | "DISTRIBUTED" | "DISPOSED" | "ADJUSTED";
  quantityDelta: number;
  recordedAt: Date;
};

type ReservationRow = {
  id: string;
  mode: GearReservationMode;
  status: GearReservationStatus;
  holdType: string | null;
  purpose: string;
  windowStartAt: Date;
  windowEndAt: Date;
  conflictSummary: string | null;
  gearItem: { id: string; name: string };
  reservedFor: { id: string; firstName: string; lastName: string } | null;
  reservedTeam: { id: string; name: string } | null;
  reservedEvent: { id: string; title: string } | null;
};

type EventRequirementRow = {
  quantityNeeded: number;
  plan: { event: { id: string; title: string } };
  assignments: Array<{
    stagedAt: Date | null;
    recoveredAt: Date | null;
    gearItem: EventRequirementItemState;
  }>;
};

type EventRequirementItemState = Pick<
  GearOpsItemSnapshot,
  "lifecycleStatus" | "readinessState" | "conditionStatus" | "quantityOnHand" | "quantityMin"
> & {
  checkouts: Array<{ status: GearCheckoutStatus; returnedAt: Date | null; eventId: string | null }>;
  assignments: Array<{ assignedToEventId: string | null }>;
};

function readSearchParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function resolveEnumValue<T extends string>(value: string, candidates: readonly T[]) {
  const candidateSet = new Set(candidates);
  if (!candidateSet.has(value as T)) {
    return undefined;
  }
  return value as T;
}

function resolveFilter(searchParams: SearchParams): GearOpsReportFilter {
  return {
    categoryId: readSearchParam(searchParams, "categoryId") || undefined,
    locationId: readSearchParam(searchParams, "locationId") || undefined,
    eventId: readSearchParam(searchParams, "eventId") || undefined,
    status: resolveEnumValue(readSearchParam(searchParams, "status"), Object.values(GearItemLifecycleStatus)),
    owner: resolveEnumValue(readSearchParam(searchParams, "owner"), Object.values(InventoryOwnershipType)),
    assigneePersonId: readSearchParam(searchParams, "assigneePersonId") || undefined,
    readiness: resolveEnumValue(readSearchParam(searchParams, "readiness"), Object.values(InventoryReadinessState)),
  };
}

function hasFilter(filter: GearOpsReportFilter) {
  return Boolean(
    filter.categoryId ||
      filter.locationId ||
      filter.eventId ||
      filter.status ||
      filter.owner ||
      filter.assigneePersonId ||
      filter.readiness,
  );
}

function buildFilterWhere(filter: GearOpsReportFilter, accessWhere: Prisma.GearItemWhereInput): Prisma.GearItemWhereInput {
  return {
    ...accessWhere,
    ...(filter.categoryId ? { gearCategoryId: filter.categoryId } : {}),
    ...(filter.locationId ? { locationId: filter.locationId } : {}),
    ...(filter.status ? { lifecycleStatus: filter.status } : {}),
    ...(filter.owner ? { ownershipType: filter.owner } : {}),
    ...(filter.readiness ? { readinessState: filter.readiness } : {}),
    ...(filter.eventId
      ? {
          OR: [
            { assignments: { some: { assignedToEventId: filter.eventId } } },
            { checkouts: { some: { eventId: filter.eventId } } },
            { eventGearAssignments: { some: { plan: { eventId: filter.eventId } } } },
          ],
        }
      : {}),
    ...(filter.assigneePersonId
      ? {
          OR: [
            { assignments: { some: { assignedToPersonId: filter.assigneePersonId } } },
            { checkouts: { some: { checkedOutById: filter.assigneePersonId } } },
          ],
        }
      : {}),
  };
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </article>
  );
}

export default async function GearOpsReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps reports</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query GearOps reports right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps reports</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.reports.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="GearOps reports" description="Operational dashboard and exception reporting for GearOps." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  const filter = resolveFilter(resolvedSearchParams);
  const itemWhere = buildFilterWhere(filter, access.where);
  const now = new Date();
  const transactionThreshold = new Date(now.getTime() - THIRTY_DAYS_IN_MS);

  let gearItems: GearItemRow[] | null = null;
  let transactions: ConsumableTransactionRow[] | null = null;
  let eventRequirements: EventRequirementRow[] | null = null;
  let reservations: ReservationRow[] | null = null;
  let queryErrorMessage = "Unable to load GearOps reporting data right now. Please try again later.";

  try {
    const [itemRows, transactionRows, requirementRows, reservationRows] = await Promise.all([
      db.gearItem.findMany({
        where: itemWhere,
        select: {
          id: true,
          name: true,
          inventoryType: true,
          lifecycleStatus: true,
          conditionStatus: true,
          ownershipType: true,
          readinessState: true,
          quantityOnHand: true,
          quantityMin: true,
          // Arc 20Y
          inspectionDueStatus: true,
          maintenanceDueStatus: true,
          nextInspectionDueAt: true,
          nextMaintenanceDueAt: true,
          category: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          assignments: {
            where: { status: { in: [GearAssignmentStatus.PENDING, GearAssignmentStatus.ACTIVE, GearAssignmentStatus.OVERDUE] } },
            select: {
              id: true,
              status: true,
              expectedReturnAt: true,
              returnedAt: true,
              assignedToPersonId: true,
              assignedToEventId: true,
              assignedTo: { select: { id: true, firstName: true, lastName: true } },
              assignedEvent: { select: { id: true, title: true } },
            },
          },
          checkouts: {
            where: { status: { in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE] } },
            select: {
              id: true,
              status: true,
              expectedReturnAt: true,
              returnedAt: true,
              checkedOutAt: true,
              checkedOutBy: { select: { id: true, firstName: true, lastName: true } },
              event: { select: { id: true, title: true } },
            },
          },
        },
        orderBy: [{ name: "asc" }],
      }),
      db.consumableTransaction.findMany({
        where: {
          organizationId: scope.organizationId,
          gearItem: { AND: [itemWhere] },
          recordedAt: { gte: transactionThreshold },
        },
        select: {
          id: true,
          gearItemId: true,
          transactionType: true,
          quantityDelta: true,
          recordedAt: true,
        },
        orderBy: [{ recordedAt: "desc" }],
      }),
      db.eventGearRequirement.findMany({
        where: {
          organizationId: scope.organizationId,
          ...(filter.eventId ? { plan: { eventId: filter.eventId } } : {}),
          assignments: { some: { gearItem: { AND: [itemWhere] } } },
        },
        select: {
          quantityNeeded: true,
          plan: { select: { event: { select: { id: true, title: true } } } },
          assignments: {
            where: { gearItem: { AND: [itemWhere] } },
            select: {
              stagedAt: true,
              recoveredAt: true,
              gearItem: {
                select: {
                  lifecycleStatus: true,
                  readinessState: true,
                  conditionStatus: true,
                  quantityOnHand: true,
                  quantityMin: true,
                  checkouts: {
                    where: { status: { in: [GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE, GearCheckoutStatus.RETURNED] } },
                    orderBy: [{ checkedOutAt: "desc" }],
                    take: 3,
                    select: { status: true, returnedAt: true, eventId: true },
                  },
                  assignments: {
                    where: { status: { in: [GearAssignmentStatus.PENDING, GearAssignmentStatus.ACTIVE, GearAssignmentStatus.OVERDUE] } },
                    select: { assignedToEventId: true },
                  },
                },
              },
            },
          },
        },
      }),
      db.gearReservation.findMany({
        where: {
          organizationId: scope.organizationId,
          gearItem: { AND: [itemWhere] },
        },
        select: {
          id: true,
          mode: true,
          status: true,
          holdType: true,
          purpose: true,
          windowStartAt: true,
          windowEndAt: true,
          conflictSummary: true,
          gearItem: { select: { id: true, name: true } },
          reservedFor: { select: { id: true, firstName: true, lastName: true } },
          reservedTeam: { select: { id: true, name: true } },
          reservedEvent: { select: { id: true, title: true } },
        },
        orderBy: [{ windowStartAt: "desc" }, { createdAt: "desc" }],
      }),
    ]);

    gearItems = itemRows as GearItemRow[];
    transactions = transactionRows as ConsumableTransactionRow[];
    eventRequirements = requirementRows as EventRequirementRow[];
    reservations = reservationRows as ReservationRow[];
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading GearOps reports.";
    }
  }

  if (!gearItems || !transactions || !eventRequirements || !reservations) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps reports</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const snapshots: GearOpsItemSnapshot[] = gearItems.map((item) => ({
    id: item.id,
    name: item.name,
    categoryId: item.category.id,
    categoryName: item.category.name,
    inventoryType: item.inventoryType,
    lifecycleStatus: item.lifecycleStatus,
    conditionStatus: item.conditionStatus,
    ownershipType: item.ownershipType,
    readinessState: item.readinessState,
    locationId: item.location?.id ?? null,
    locationName: item.location?.name ?? null,
    quantityOnHand: item.quantityOnHand,
    quantityMin: item.quantityMin,
    // Arc 20Y
    inspectionDueStatus: item.inspectionDueStatus ?? null,
    maintenanceDueStatus: item.maintenanceDueStatus ?? null,
    nextInspectionDueAt: item.nextInspectionDueAt ?? null,
    nextMaintenanceDueAt: item.nextMaintenanceDueAt ?? null,
    assignments: item.assignments.map((assignment) => ({
      id: assignment.id,
      gearItemId: item.id,
      status: assignment.status,
      expectedReturnAt: assignment.expectedReturnAt,
      returnedAt: assignment.returnedAt,
      assignedToPersonId: assignment.assignedToPersonId,
      assignedToPersonName: assignment.assignedTo
        ? `${assignment.assignedTo.firstName} ${assignment.assignedTo.lastName}`
        : null,
      assignedToEventId: assignment.assignedToEventId,
      assignedToEventTitle: assignment.assignedEvent?.title ?? null,
    })),
    checkouts: item.checkouts.map((checkout) => ({
      id: checkout.id,
      gearItemId: item.id,
      status: checkout.status,
      expectedReturnAt: checkout.expectedReturnAt,
      returnedAt: checkout.returnedAt,
      checkedOutById: checkout.checkedOutBy.id,
      checkedOutByName: `${checkout.checkedOutBy.firstName} ${checkout.checkedOutBy.lastName}`,
      eventId: checkout.event?.id ?? null,
      eventTitle: checkout.event?.title ?? null,
    })),
  }));
  const filteredSnapshots = filterGearOpsItems(snapshots, filter);

  const eventRequirementSnapshots: GearOpsEventRequirementSnapshot[] = eventRequirements.map((requirement) => {
    const assignments = requirement.assignments.map((assignment) => {
      const activeEventCheckout =
        assignment.gearItem.checkouts.find((checkout) => checkout.eventId === requirement.plan.event.id) ?? null;
      const blockingCheckout =
        assignment.gearItem.checkouts.find(
          (checkout) =>
            checkout.eventId !== requirement.plan.event.id &&
            (checkout.status === GearCheckoutStatus.OPEN || checkout.status === GearCheckoutStatus.OVERDUE) &&
            checkout.returnedAt === null,
        ) ?? null;
      const blockingAssignment = assignment.gearItem.assignments.some(
        (gearAssignment) =>
          gearAssignment.assignedToEventId !== requirement.plan.event.id &&
          gearAssignment.assignedToEventId !== null,
      );
      return {
        stagedAt: assignment.stagedAt,
        recoveredAt: assignment.recoveredAt,
        activeEventCheckout,
        blockingCheckout,
        blockingAssignment,
        gearItem: {
          lifecycleStatus: assignment.gearItem.lifecycleStatus,
          readinessState: assignment.gearItem.readinessState,
          conditionStatus: assignment.gearItem.conditionStatus,
          quantityOnHand: assignment.gearItem.quantityOnHand,
          quantityMin: assignment.gearItem.quantityMin,
        },
      };
    });
    const summary = summarizeEventGearRequirement({
      requirementType: "REQUIRED",
      quantityNeeded: requirement.quantityNeeded,
      assignments,
    });
    const deployedCount = assignments.filter((assignment) => deriveEventGearAssignmentStatus(assignment) === "DEPLOYED").length;
    const unreturnedCount = assignments.filter((assignment) => {
      const status = deriveEventGearAssignmentStatus(assignment);
      return status === "DEPLOYED" || status === "STAGED";
    }).length;
    return {
      eventId: requirement.plan.event.id,
      eventTitle: requirement.plan.event.title,
      quantityNeeded: summary.quantityNeeded,
      assignedCount: summary.assignedCount,
      readyCount: summary.readyCount,
      unavailableCount: summary.unavailableCount,
      outOfServiceCount: summary.outOfServiceCount,
      maintenanceNeededCount: summary.maintenanceNeededCount,
      deployedCount,
      unreturnedCount,
    };
  });

  const readiness = summarizeReadiness(filteredSnapshots);
  const custody = summarizeCustody(
    filteredSnapshots.flatMap((item) => item.assignments),
    filteredSnapshots.flatMap((item) => item.checkouts),
    now,
  );
  const locationSummary = summarizeLocations(filteredSnapshots);
  const maintenance = summarizeMaintenance(filteredSnapshots);
  const consumables = summarizeConsumables(
    filteredSnapshots,
    transactions.map((transaction) => ({
      id: transaction.id,
      gearItemId: transaction.gearItemId,
      transactionType: transaction.transactionType,
      quantityDelta: transaction.quantityDelta,
      recordedAt: transaction.recordedAt,
    })),
    now,
  );
  const eventSummary = summarizeEventRequirements(eventRequirementSnapshots);
  const reservationSummary = summarizeGearReservations(
    reservations.map((reservation) => ({
      id: reservation.id,
      gearItemId: reservation.gearItem.id,
      mode: reservation.mode,
      status: reservation.status,
      approvalStatus: ApprovalStatus.NOT_REQUIRED,
      holdType: reservation.holdType as GearHoldType | null,
      purpose: reservation.purpose as GearReservationPurpose,
      quantityRequested: 1,
      windowStartAt: reservation.windowStartAt,
      windowEndAt: reservation.windowEndAt,
      reservedForPersonId: reservation.reservedFor?.id ?? null,
      reservedForTeamId: reservation.reservedTeam?.id ?? null,
      reservedForEventId: reservation.reservedEvent?.id ?? null,
      programId: null,
      conflictSummary: reservation.conflictSummary,
    })),
    now,
  );
  const exceptions = buildGearOpsExceptions({ items: filteredSnapshots, eventRequirements: eventRequirementSnapshots, now });
  const outOfService = filteredSnapshots.filter(
    (item) =>
      item.lifecycleStatus === "MAINTENANCE" ||
      item.lifecycleStatus === "QUARANTINED" ||
      item.lifecycleStatus === "RETIRED" ||
      item.lifecycleStatus === "LOST" ||
      item.readinessState === "NOT_READY" ||
      item.readinessState === "DECOMMISSIONED",
  );
  const overdue = exceptions.filter((exception) => exception.kind === "OVERDUE_UNRETURNED");
  const categories = Array.from(new Map(gearItems.map((item) => [item.category.id, item.category])).values());
  const locations = Array.from(
    new Map(
      gearItems.filter((item) => item.location).map((item) => [item.location?.id ?? "", item.location as { id: string; name: string }]),
    ).values(),
  );
  const events = Array.from(new Map(eventSummary.map((entry) => [entry.eventId, entry.eventTitle])).entries()).map(([id, title]) => ({
    id,
    title,
  }));
  const assignees = Array.from(
    new Map(
      filteredSnapshots
        .flatMap((item) => item.assignments)
        .filter((assignment) => assignment.assignedToPersonId && assignment.assignedToPersonName)
        .map((assignment) => [assignment.assignedToPersonId as string, assignment.assignedToPersonName as string]),
    ).entries(),
  ).map(([id, name]) => ({ id, name }));

  return (
    <section className="space-y-4">
      <PageHeader
        title="GearOps reports"
        description="Filterable operational dashboard for readiness, custody, maintenance, location, event gear status, consumables, and exceptions."
      />
      <GearOpsSubnav current="reports" />

      <div className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
        <form action="/gear-ops/reports" method="get" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select name="categoryId" defaultValue={filter.categoryId ?? ""} className="rounded-md border px-3 py-2 text-sm">
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select name="locationId" defaultValue={filter.locationId ?? ""} className="rounded-md border px-3 py-2 text-sm">
            <option value="">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          <select name="eventId" defaultValue={filter.eventId ?? ""} className="rounded-md border px-3 py-2 text-sm">
            <option value="">All events</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={filter.status ?? ""} className="rounded-md border px-3 py-2 text-sm">
            <option value="">All status</option>
            {Object.values(GearItemLifecycleStatus).map((status) => (
              <option key={status} value={status}>
                {formatGearOpsEnum(status)}
              </option>
            ))}
          </select>
          <select name="owner" defaultValue={filter.owner ?? ""} className="rounded-md border px-3 py-2 text-sm">
            <option value="">All owners</option>
            {Object.values(InventoryOwnershipType).map((owner) => (
              <option key={owner} value={owner}>
                {formatGearOpsEnum(owner)}
              </option>
            ))}
          </select>
          <select
            name="assigneePersonId"
            defaultValue={filter.assigneePersonId ?? ""}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="">All assignees</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.name}
              </option>
            ))}
          </select>
          <select name="readiness" defaultValue={filter.readiness ?? ""} className="rounded-md border px-3 py-2 text-sm">
            <option value="">All readiness</option>
            {Object.values(InventoryReadinessState).map((readinessState) => (
              <option key={readinessState} value={readinessState}>
                {formatGearOpsEnum(readinessState)}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black">
              Apply
            </button>
            <Link href="/gear-ops/reports" className="rounded-md border px-3 py-2 text-sm">
              Clear
            </Link>
          </div>
        </form>
      </div>

      {hasFilter(filter) ? (
        <div className="rounded-lg border bg-white p-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          Filters are active and applied to all summary and exception sections.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Visible gear" value={filteredSnapshots.length} />
        <Metric label="Readiness ready" value={readiness.ready} />
        <Metric label="Out of service" value={maintenance.outOfServiceCount} />
        <Metric label="Maintenance needed" value={maintenance.maintenanceNeededCount} />
        <Metric label="Overdue / unreturned" value={custody.overdueAssignments + custody.overdueCheckouts} />
        <Metric label="Low consumables" value={consumables.lowConsumableCount} />
        <Metric label="Reserved now" value={reservationSummary.currentReservedCount} />
        <Metric label="Held now" value={reservationSummary.currentHeldCount} />
        <Metric label="Upcoming reservations" value={reservationSummary.upcomingCount} />
        <Metric label="Reservation conflicts" value={reservationSummary.conflictCount} />
        <Metric label="Event gear gaps" value={eventSummary.reduce((total, event) => total + event.gapCount, 0)} />
        <Metric label="Event unreturned" value={eventSummary.reduce((total, event) => total + event.unreturnedCount, 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium">Readiness summary</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Ready {readiness.ready} / {readiness.total} ({readiness.readyPercent}%)
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Inspection {readiness.needsInspection} · Maintenance required {readiness.maintenanceRequired} · Not ready{" "}
            {readiness.notReady}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium">Custody summary</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Assignments {custody.activeAssignments} · Checkouts {custody.openCheckouts}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Overdue assignments {custody.overdueAssignments} · Overdue checkouts {custody.overdueCheckouts}
          </p>
        </div>
      </div>

      <div id="reservation-reporting" className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium">Reservation and hold summary</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Reserved now {reservationSummary.currentReservedCount} · Held now {reservationSummary.currentHeldCount}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Upcoming {reservationSummary.upcomingCount} · Expired {reservationSummary.expiredCount} · Conflicts {reservationSummary.conflictCount}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Event holds {reservationSummary.eventHeldCount} · Maintenance holds {reservationSummary.maintenanceHeldCount} · Blocked {reservationSummary.blockedCount}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium">Upcoming reservation list</h3>
          {reservations.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No reservation rows are visible for the selected filters.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {reservations.slice(0, MAX_LIST_ROWS).map((reservation) => (
                <li key={reservation.id} className="rounded-md border p-2">
                  <Link href={`/gear-ops/items/${reservation.gearItem.id}`} className="underline">
                    {reservation.gearItem.name}
                  </Link>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {formatGearOpsEnum(reservation.mode)} · {formatGearOpsEnum(reservation.status)} · {formatGearOpsDateTime(reservation.windowStartAt)} → {formatGearOpsDateTime(reservation.windowEndAt)}
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {reservation.reservedEvent
                      ? `Event: ${reservation.reservedEvent.title}`
                      : reservation.reservedTeam
                        ? `Team: ${reservation.reservedTeam.name}`
                        : reservation.reservedFor
                          ? `Person: ${[reservation.reservedFor.firstName, reservation.reservedFor.lastName].filter(Boolean).join(" ")}`
                          : "General operational context"}
                  </p>
                  {reservation.conflictSummary ? <p className="text-amber-700 dark:text-amber-300">{reservation.conflictSummary}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-sm font-medium">Inventory exception list</h3>
        {exceptions.length === 0 ? (
          <EmptyState message="No exceptions are visible for the selected filters." />
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {exceptions.slice(0, MAX_EXCEPTION_ROWS).map((exception) => (
              <li key={exception.id} className="rounded-md border p-2">
                <p className="font-medium">{exception.title}</p>
                <p className="text-zinc-600 dark:text-zinc-400">{exception.detail}</p>
                <Link href={exception.href} className="underline">
                  Drill down
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium">Out-of-service gear view</h3>
          {outOfService.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No out-of-service gear visible.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {outOfService.slice(0, MAX_LIST_ROWS).map((item) => (
                <li key={item.id} className="rounded-md border p-2">
                  <Link href={`/gear-ops/items/${item.id}`} className="underline">
                    {item.name}
                  </Link>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {formatGearOpsEnum(item.lifecycleStatus)}
                    {item.readinessState ? ` · ${formatGearOpsEnum(item.readinessState)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium">Overdue or unreturned gear view</h3>
          {overdue.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No overdue or unreturned items visible.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {overdue.slice(0, MAX_LIST_ROWS).map((entry) => (
                <li key={entry.id} className="rounded-md border p-2">
                  <p className="font-medium">{entry.title}</p>
                  <p className="text-zinc-600 dark:text-zinc-400">{entry.detail}</p>
                  <Link href={entry.href} className="underline">
                    Open item
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium">Gear by location</h3>
          {locationSummary.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No location rows visible.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {locationSummary.slice(0, MAX_LIST_ROWS).map((location) => (
                <li key={`${location.locationId ?? "none"}-${location.locationName}`} className="flex justify-between rounded-md border px-2 py-1.5">
                  <span>{location.locationName}</span>
                  <span>{location.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium">Event gear gap summary</h3>
          {eventSummary.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No event gear rows visible.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {eventSummary.slice(0, MAX_LIST_ROWS).map((event) => (
                <li key={event.eventId} className="rounded-md border p-2">
                  <Link href={`/events/${event.eventId}/gear`} className="underline">
                    {event.eventTitle}
                  </Link>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Need {event.quantityNeeded} · Gap {event.gapCount} · Unreturned {event.unreturnedCount}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-sm font-medium">Recent gear activity</h3>
        {transactions.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">No recent consumable activity is visible.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {transactions.slice(0, MAX_LIST_ROWS).map((transaction) => (
              <li key={transaction.id} className="rounded-md border p-2">
                <p className="font-medium">
                  {formatGearOpsEnum(transaction.transactionType)} · {transaction.quantityDelta > 0 ? "+" : ""}
                  {transaction.quantityDelta}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">{formatGearOpsDateTime(transaction.recordedAt)}</p>
                <Link href={`/gear-ops/items/${transaction.gearItemId}`} className="underline">
                  Open item history
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
