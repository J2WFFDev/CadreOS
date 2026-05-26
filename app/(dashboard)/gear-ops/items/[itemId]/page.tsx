import {
  ConsumableTransactionType,
  GearAssignmentStatus,
  GearCheckoutStatus,
  GearConditionStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
  type GearMaintenanceType,
  type InventoryMovementType,
  type InventoryReadinessState,
} from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import {
  GearAvailabilityBanner,
  GearConditionBadge,
  GearInventoryTypeBadge,
  GearLifecycleBadge,
  GearReadinessChip,
} from "@/components/gear-ops/status-badge";
import { GearPendingSubjectCard } from "@/components/gear-ops/pending-subject-card";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import {
  formatGearOpsDateTime,
  formatGearOpsEnum,
} from "@/lib/gear-ops";
import { deriveAvailabilitySignal } from "@/lib/gear-ops-ui";
import {
  labelForMovementType,
  labelForOwnershipType,
} from "@/lib/inventory-ops";
import {
  labelForScanContext,
  labelForScanEventResult,
  SCAN_CONTEXTS,
  SCAN_EVENT_RESULTS,
  type ScanContext,
  type ScanEventResult,
} from "@/lib/inventory-scan";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { resolveMobileInventoryActions } from "@/lib/rapid-inventory-ops";
import { formatDateTimeInputValue, isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function GearOpsItemDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { itemId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  const readSearchParam = (key: string) => {
    const value = resolvedSearchParams[key];
    if (Array.isArray(value)) return value[0] ?? "";
    return value ?? "";
  };

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear item</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query gear item details right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.items.detail.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let item:
    | {
        id: string;
        name: string;
        inventoryType: GearInventoryType;
        lifecycleStatus: GearItemLifecycleStatus;
        conditionStatus: GearConditionStatus | null;
        readinessState: InventoryReadinessState | null;
        ownershipType: import("@prisma/client").InventoryOwnershipType | null;
        barcodeValue: string | null;
        sku: string | null;
        serialNumber: string | null;
        quantityOnHand: number;
        quantityMin: number | null;
        notes: string | null;
        location: { id: string; name: string; locationCode: string | null } | null;
        category: { id: string; name: string; inventoryType: GearInventoryType };
        program: { id: string; name: string } | null;
        assignments: Array<{
          id: string;
          status: GearAssignmentStatus;
          assignedAt: Date;
          expectedReturnAt: Date | null;
          returnedAt: Date | null;
          notes: string | null;
          assignedBy: { id: string; firstName: string; lastName: string };
          assignedTo: { id: string; firstName: string; lastName: string } | null;
          assignedTeam: { id: string; name: string; program: { id: string; name: string } | null } | null;
          assignedEvent: { id: string; title: string; program: { id: string; name: string } | null } | null;
        }>;
        checkouts: Array<{
          id: string;
          status: GearCheckoutStatus;
          checkedOutAt: Date;
          expectedReturnAt: Date | null;
          returnedAt: Date | null;
          purposeNotes: string | null;
          returnNotes: string | null;
          conditionOnReturn: GearConditionStatus | null;
          checkedOutBy: { id: string; firstName: string; lastName: string };
          issuedBy: { id: string; firstName: string; lastName: string };
          returnedBy: { id: string; firstName: string; lastName: string } | null;
          receivedBy: { id: string; firstName: string; lastName: string } | null;
          event:
            | {
                id: string;
                title: string;
                team: { id: string; name: string } | null;
                program: { id: string; name: string } | null;
              }
            | null;
        }>;
        maintenanceLogs: Array<{
          id: string;
          maintenanceType: GearMaintenanceType;
          performedAt: Date;
          createdAt: Date;
          conditionBefore: GearConditionStatus | null;
          conditionAfter: GearConditionStatus | null;
          notes: string;
          performedBy: { id: string; firstName: string; lastName: string };
        }>;
        consumableTransactions: Array<{
          id: string;
          transactionType: ConsumableTransactionType;
          quantityDelta: number;
          recordedAt: Date;
          createdAt: Date;
          notes: string | null;
          recordedBy: { id: string; firstName: string; lastName: string };
          event:
            | {
                id: string;
                title: string;
                team: { id: string; name: string } | null;
                program: { id: string; name: string } | null;
              }
            | null;
        }>;
        inventoryMovements: Array<{
          id: string;
          movementType: InventoryMovementType;
          fromLocation: { id: string; name: string; locationCode: string | null } | null;
          toLocation: { id: string; name: string; locationCode: string | null } | null;
          actor: { id: string; firstName: string; lastName: string };
          custodyPerson: { id: string; firstName: string; lastName: string } | null;
          relatedRecordType: string | null;
          notes: string | null;
          occurredAt: Date;
        }>;
        scanEvents: Array<{
          id: string;
          scanContext: string;
          result: string;
          inventoryIdentifierType: string;
          rawValue: string;
          createdAt: Date;
          actor: { id: string; firstName: string; lastName: string } | null;
        }>;
      }
    | null = null;
  let queryFailed = false;
  let queryErrorMessage = "Unable to load GearOps item details right now. Please try again later.";

  try {
    item = await db.gearItem.findFirst({
      where: {
        id: itemId,
        AND: [access.where],
      },
      select: {
        id: true,
        name: true,
        inventoryType: true,
        lifecycleStatus: true,
        conditionStatus: true,
        readinessState: true,
        ownershipType: true,
        barcodeValue: true,
        sku: true,
        serialNumber: true,
        quantityOnHand: true,
        quantityMin: true,
        notes: true,
        location: { select: { id: true, name: true, locationCode: true } },
        category: { select: { id: true, name: true, inventoryType: true } },
        program: { select: { id: true, name: true } },
        assignments: {
          select: {
            id: true,
            status: true,
            assignedAt: true,
            expectedReturnAt: true,
            returnedAt: true,
            notes: true,
            assignedBy: { select: { id: true, firstName: true, lastName: true } },
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
            assignedTeam: { select: { id: true, name: true, program: { select: { id: true, name: true } } } },
            assignedEvent: { select: { id: true, title: true, program: { select: { id: true, name: true } } } },
          },
          orderBy: [{ assignedAt: "desc" }, { createdAt: "desc" }],
          take: 8,
        },
        checkouts: {
          select: {
            id: true,
            status: true,
            checkedOutAt: true,
            expectedReturnAt: true,
            returnedAt: true,
            purposeNotes: true,
            returnNotes: true,
            conditionOnReturn: true,
            checkedOutBy: { select: { id: true, firstName: true, lastName: true } },
            issuedBy: { select: { id: true, firstName: true, lastName: true } },
            returnedBy: { select: { id: true, firstName: true, lastName: true } },
            receivedBy: { select: { id: true, firstName: true, lastName: true } },
            event: { select: { id: true, title: true, team: { select: { id: true, name: true } }, program: { select: { id: true, name: true } } } },
          },
          orderBy: [{ checkedOutAt: "desc" }, { createdAt: "desc" }],
          take: 8,
        },
        maintenanceLogs: {
          select: {
            id: true,
            maintenanceType: true,
            performedAt: true,
            createdAt: true,
            conditionBefore: true,
            conditionAfter: true,
            notes: true,
            performedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
          take: 12,
        },
        consumableTransactions: {
          select: {
            id: true,
            transactionType: true,
            quantityDelta: true,
            recordedAt: true,
            createdAt: true,
            notes: true,
            recordedBy: { select: { id: true, firstName: true, lastName: true } },
            event: { select: { id: true, title: true, team: { select: { id: true, name: true } }, program: { select: { id: true, name: true } } } },
          },
          orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
          take: 12,
        },
        inventoryMovements: {
          select: {
            id: true,
            movementType: true,
            fromLocation: { select: { id: true, name: true, locationCode: true } },
            toLocation: { select: { id: true, name: true, locationCode: true } },
            actor: { select: { id: true, firstName: true, lastName: true } },
            custodyPerson: { select: { id: true, firstName: true, lastName: true } },
            relatedRecordType: true,
            notes: true,
            occurredAt: true,
          },
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          take: 20,
        },
        scanEvents: {
          select: {
            id: true,
            scanContext: true,
            result: true,
            inventoryIdentifierType: true,
            rawValue: true,
            createdAt: true,
            actor: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 10,
        },
      },
    });
  } catch (error) {
    queryFailed = true;
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading GearOps item details.";
    }
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear item</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  if (!item) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Gear item</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Gear item not found in the selected organization scope.</p>
        </div>
      </section>
    );
  }

  const gearItem = item;
  const currentAssignmentStatuses = new Set<GearAssignmentStatus>([
    GearAssignmentStatus.PENDING,
    GearAssignmentStatus.ACTIVE,
    GearAssignmentStatus.OVERDUE,
  ]);
  const currentAssignments = gearItem.assignments.filter((assignment) => currentAssignmentStatuses.has(assignment.status));
  const assignmentHistory = gearItem.assignments.filter((assignment) => !currentAssignmentStatuses.has(assignment.status));
  const currentCheckoutStatuses = new Set<GearCheckoutStatus>([GearCheckoutStatus.OPEN, GearCheckoutStatus.OVERDUE]);
  const currentCheckouts = gearItem.checkouts.filter((checkout) => currentCheckoutStatuses.has(checkout.status));
  const checkoutHistory = gearItem.checkouts.filter((checkout) => !currentCheckoutStatuses.has(checkout.status));
  const recentMaintenanceLogs = gearItem.maintenanceLogs.slice(0, 3);
  const maintenanceHistory = gearItem.maintenanceLogs.slice(3);
  const recentConsumableTransactions = gearItem.consumableTransactions.slice(0, 3);
  const consumableTransactionHistory = gearItem.consumableTransactions.slice(3);
  const lowAvailabilityConcern =
    gearItem.inventoryType === GearInventoryType.CONSUMABLE &&
    gearItem.quantityMin !== null &&
    gearItem.quantityOnHand <= gearItem.quantityMin;
  const readinessConcernCount =
    (gearItem.lifecycleStatus === GearItemLifecycleStatus.MAINTENANCE ? 1 : 0) +
    ((gearItem.conditionStatus === GearConditionStatus.POOR || gearItem.conditionStatus === GearConditionStatus.DAMAGED)
      ? 1
      : 0) +
    (currentCheckouts.length > 0 ? 1 : 0) +
    (lowAvailabilityConcern ? 1 : 0);
  const scanned = readSearchParam("scanned") === "1";
  const scanContextRaw = readSearchParam("scanContext");
  const scanContext = SCAN_CONTEXTS.includes(scanContextRaw as ScanContext) ? (scanContextRaw as ScanContext) : null;
  const scanValue = readSearchParam("scanValue");
  const rapidNowInputValue = formatDateTimeInputValue(new Date());
  const primaryCheckout = currentCheckouts[0] ?? null;
  const primaryAssignment = currentAssignments[0] ?? null;
  const rapidActions = resolveMobileInventoryActions({
    itemId: gearItem.id,
    inventoryType: gearItem.inventoryType,
    lifecycleStatus: gearItem.lifecycleStatus,
    readinessState: gearItem.readinessState,
    scanContext,
    nowInputValue: rapidNowInputValue,
    currentCheckoutId: primaryCheckout?.id ?? null,
    currentAssignmentId: primaryAssignment?.id ?? null,
    locationId: gearItem.location?.id ?? null,
  });

  function renderAssignmentCard(assignment: (typeof gearItem.assignments)[number]) {
    const assignmentProgram = assignment.assignedEvent?.program ?? assignment.assignedTeam?.program ?? gearItem.program;

    return (
      <article key={assignment.id} className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-medium">
            {formatGearOpsEnum(assignment.status)} · Assigned {formatGearOpsDateTime(assignment.assignedAt)}
          </p>
          <Link
            href={`/gear-ops/items/${gearItem.id}/assignments/${assignment.id}/edit`}
            className="rounded-md border px-2.5 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit
          </Link>
        </div>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Assigned by{" "}
          <Link href={`/people/${assignment.assignedBy.id}`} className="underline">
            {assignment.assignedBy.firstName} {assignment.assignedBy.lastName}
          </Link>
        </p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Person:{" "}
          {assignment.assignedTo ? (
            <Link href={`/people/${assignment.assignedTo.id}`} className="underline">
              {assignment.assignedTo.firstName} {assignment.assignedTo.lastName}
            </Link>
          ) : (
            "—"
          )}
          {" · "}Team:{" "}
          {assignment.assignedTeam ? (
            <Link href={`/teams/${assignment.assignedTeam.id}`} className="underline">
              {assignment.assignedTeam.name}
            </Link>
          ) : (
            "—"
          )}
          {" · "}Event:{" "}
          {assignment.assignedEvent ? (
            <Link href={`/events/${assignment.assignedEvent.id}`} className="underline">
              {assignment.assignedEvent.title}
            </Link>
          ) : (
            "—"
          )}
          {" · "}Program:{" "}
          {assignmentProgram ? (
            <Link href={`/programs/${assignmentProgram.id}`} className="underline">
              {assignmentProgram.name}
            </Link>
          ) : (
            "—"
          )}
        </p>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Expected return: {formatGearOpsDateTime(assignment.expectedReturnAt)} · Returned:{" "}
          {formatGearOpsDateTime(assignment.returnedAt)}
        </p>
        {assignment.notes ? <p className="mt-1 text-zinc-600 dark:text-zinc-400">{assignment.notes}</p> : null}
      </article>
    );
  }

  function renderCheckoutCard(checkout: (typeof gearItem.checkouts)[number]) {
    const checkoutProgram = checkout.event?.program ?? gearItem.program;
    const checkoutTeam = checkout.event?.team;

    return (
      <article key={checkout.id} className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-medium">
            {formatGearOpsEnum(checkout.status)} · Checked out {formatGearOpsDateTime(checkout.checkedOutAt)}
          </p>
          <Link
            href={`/gear-ops/items/${gearItem.id}/checkouts/${checkout.id}/edit`}
            className="rounded-md border px-2.5 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit
          </Link>
        </div>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Checked out to:{" "}
          <Link href={`/people/${checkout.checkedOutBy.id}`} className="underline">
            {checkout.checkedOutBy.firstName} {checkout.checkedOutBy.lastName}
          </Link>
          {" · "}Issued by{" "}
          <Link href={`/people/${checkout.issuedBy.id}`} className="underline">
            {checkout.issuedBy.firstName} {checkout.issuedBy.lastName}
          </Link>
        </p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Team:{" "}
          {checkoutTeam ? (
            <Link href={`/teams/${checkoutTeam.id}`} className="underline">
              {checkoutTeam.name}
            </Link>
          ) : (
            "—"
          )}
          {" · "}Program:{" "}
          {checkoutProgram ? (
            <Link href={`/programs/${checkoutProgram.id}`} className="underline">
              {checkoutProgram.name}
            </Link>
          ) : (
            "—"
          )}
          {" · "}Event:{" "}
          {checkout.event ? (
            <Link href={`/events/${checkout.event.id}`} className="underline">
              {checkout.event.title}
            </Link>
          ) : (
            "—"
          )}
        </p>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Expected return: {formatGearOpsDateTime(checkout.expectedReturnAt)} · Returned:{" "}
          {formatGearOpsDateTime(checkout.returnedAt)}
        </p>
        {checkout.returnedBy || checkout.receivedBy ? (
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">
            Returned by:{" "}
            {checkout.returnedBy ? (
              <Link href={`/people/${checkout.returnedBy.id}`} className="underline">
                {checkout.returnedBy.firstName} {checkout.returnedBy.lastName}
              </Link>
            ) : (
              "—"
            )}
            {" · "}Received by:{" "}
            {checkout.receivedBy ? (
              <Link href={`/people/${checkout.receivedBy.id}`} className="underline">
                {checkout.receivedBy.firstName} {checkout.receivedBy.lastName}
              </Link>
            ) : (
              "—"
            )}
            {" · "}Condition on return: {checkout.conditionOnReturn ? formatGearOpsEnum(checkout.conditionOnReturn) : "—"}
          </p>
        ) : null}
        {checkout.purposeNotes ? <p className="mt-1 text-zinc-600 dark:text-zinc-400">{checkout.purposeNotes}</p> : null}
        {checkout.returnNotes ? <p className="mt-1 text-zinc-600 dark:text-zinc-400">{checkout.returnNotes}</p> : null}
      </article>
    );
  }

  function renderMaintenanceCard(entry: (typeof gearItem.maintenanceLogs)[number]) {
    return (
      <article key={entry.id} className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-medium">
            {formatGearOpsEnum(entry.maintenanceType)} · Service {formatGearOpsDateTime(entry.performedAt)}
          </p>
          <Link
            href={`/gear-ops/items/${gearItem.id}/maintenance/${entry.id}/edit`}
            className="rounded-md border px-2.5 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit
          </Link>
        </div>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Performed by{" "}
          <Link href={`/people/${entry.performedBy.id}`} className="underline">
            {entry.performedBy.firstName} {entry.performedBy.lastName}
          </Link>
          {" · "}Logged {formatGearOpsDateTime(entry.createdAt)}
        </p>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          Condition before: {entry.conditionBefore ? formatGearOpsEnum(entry.conditionBefore) : "—"} · Condition after:{" "}
          {entry.conditionAfter ? formatGearOpsEnum(entry.conditionAfter) : "—"}
        </p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{entry.notes}</p>
      </article>
    );
  }

  function renderConsumableTransactionCard(entry: (typeof gearItem.consumableTransactions)[number]) {
    const relatedTeam = entry.event?.team;
    const relatedProgram = entry.event?.program ?? gearItem.program;

    return (
      <article key={entry.id} className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-medium">
            {formatGearOpsEnum(entry.transactionType)} · Quantity: {entry.quantityDelta > 0 ? "+" : ""}
            {entry.quantityDelta} · Unit: units
          </p>
          <Link
            href={`/gear-ops/items/${gearItem.id}/consumables/${entry.id}/edit`}
            className="rounded-md border px-2.5 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit
          </Link>
        </div>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Recorded by{" "}
          <Link href={`/people/${entry.recordedBy.id}`} className="underline">
            {entry.recordedBy.firstName} {entry.recordedBy.lastName}
          </Link>
          {" · "}Recorded {formatGearOpsDateTime(entry.recordedAt)}
          {" · "}Logged {formatGearOpsDateTime(entry.createdAt)}
        </p>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Person: —{" · "}Team:{" "}
          {relatedTeam ? (
            <Link href={`/teams/${relatedTeam.id}`} className="underline">
              {relatedTeam.name}
            </Link>
          ) : (
            "—"
          )}
          {" · "}Program:{" "}
          {relatedProgram ? (
            <Link href={`/programs/${relatedProgram.id}`} className="underline">
              {relatedProgram.name}
            </Link>
          ) : (
            "—"
          )}
          {" · "}Event:{" "}
          {entry.event ? (
            <Link href={`/events/${entry.event.id}`} className="underline">
              {entry.event.title}
            </Link>
          ) : (
            "—"
          )}
        </p>
        {entry.notes ? <p className="mt-1 text-zinc-600 dark:text-zinc-400">{entry.notes}</p> : null}
      </article>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <BackLink href="/gear-ops/items" label="Items" />
        <GearOpsSubnav current="items" />
      </div>

      <div className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{item.name}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Category:{" "}
              <Link href={`/gear-ops/categories/${item.category.id}`} className="underline">
                {item.category.name}
              </Link>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GearAvailabilityBanner
              signal={deriveAvailabilitySignal({
                lifecycleStatus: item.lifecycleStatus,
                hasOpenCheckout: currentCheckouts.length > 0,
                hasActiveAssignment: currentAssignments.length > 0,
              })}
            />
            <GearLifecycleBadge status={item.lifecycleStatus} />
            <GearInventoryTypeBadge type={item.inventoryType} />
            {item.conditionStatus ? <GearConditionBadge status={item.conditionStatus} /> : null}
            <Link
              href={`/gear-ops/items/${item.id}/edit`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Edit
            </Link>
            <Link
              href={`/gear-ops/scan?scanContext=INVENTORY_LOOKUP&scanValue=${encodeURIComponent(item.id)}`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Scan center
            </Link>
            <Link
              href={`/gear-ops/labels?subjectType=GEAR_ITEM&subjectId=${item.id}&template=${item.inventoryType === GearInventoryType.CONSUMABLE ? "CONSUMABLE" : "INVENTORY_ITEM"}`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Print label
            </Link>
            <Link
              href={`/gear-ops/labels?subjectType=GEAR_ITEM&subjectId=${item.id}&template=CUSTODY_ASSIGNMENT`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Custody label
            </Link>
          </div>
        </div>
      </div>

      {scanned ? (
        <div className="rounded-lg border bg-white p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <p>
            Scan resolved for {scanContext ? labelForScanContext(scanContext) : "inventory lookup"}
            {scanValue ? ` · ${scanValue}` : ""}.
          </p>
        </div>
      ) : null}

      <div id="rapid-ops" className="space-y-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium">Rapid field actions</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Keep scan follow-through low-friction with the next operational action surfaced here.
            </p>
          </div>
          <Link
            href={`/gear-ops/scan?scanContext=${scanContext ?? "INVENTORY_LOOKUP"}&scanValue=${encodeURIComponent(scanValue || item.id)}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Continue scanning
          </Link>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.1fr,0.9fr]">
          <article className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {scanContext ? labelForScanContext(scanContext) : "Mobile inventory action"}
            </p>
            <p className="mt-2 text-base font-semibold">{rapidActions.primaryAction.label}</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{rapidActions.primaryAction.detail}</p>
            <div className="mt-3">
              <Link
                href={rapidActions.primaryAction.href}
                className="inline-flex rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {rapidActions.primaryAction.label}
              </Link>
            </div>
          </article>

          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {rapidActions.quickCustodyFlows.map((action) => (
              <Link
                key={action.key}
                href={action.href}
                className="rounded-lg border p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <p className="font-medium">{action.label}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{action.detail}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rapidActions.actions.map((action) => (
            <Link
              key={action.key}
              href={action.href}
              className={`rounded-lg border p-3 text-sm transition ${
                action.tone === "primary"
                  ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <p className="font-medium">{action.label}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{action.detail}</p>
            </Link>
          ))}
        </div>
      </div>

      <GearPendingSubjectCard
        subjectType="GEAR_ITEM"
        subjectId={item.id}
        title="Local pending activity"
        emptyMessage="No local pending or failed actions are attached to this item."
      />

      <dl id="readiness" className="grid gap-3 rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Program</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {item.program ? <Link href={`/programs/${item.program.id}`} className="underline">{item.program.name}</Link> : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">SKU / Serial</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {item.sku ?? "—"} / {item.serialNumber ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Stock</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            On hand: {item.quantityOnHand}
            {item.inventoryType === GearInventoryType.CONSUMABLE ? ` · Min: ${item.quantityMin ?? "—"}` : ""}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Notes</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{item.notes ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Location</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {item.location ? (
              <Link href={`/gear-ops/locations/${item.location.id}`} className="underline">
                {item.location.name}
                {item.location.locationCode ? ` (${item.location.locationCode})` : ""}
              </Link>
            ) : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Readiness</dt>
          <dd>
            {item.readinessState ? (
              <GearReadinessChip state={item.readinessState} />
            ) : (
              <span className="text-zinc-600 dark:text-zinc-400">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Ownership</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">
            {item.ownershipType ? labelForOwnershipType(item.ownershipType) : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Barcode / QR</dt>
          <dd className="font-mono text-zinc-600 dark:text-zinc-400">{item.barcodeValue ?? "—"}</dd>
        </div>
      </dl>

      <dl className="grid gap-3 rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Current assignments</dt>
          <dd className={currentAssignments.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
            {currentAssignments.length}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Open checkouts</dt>
          <dd className={currentCheckouts.length > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
            {currentCheckouts.length}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Recent maintenance logs</dt>
          <dd className="text-zinc-600 dark:text-zinc-400">{recentMaintenanceLogs.length}</dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Low-availability status</dt>
          <dd className={lowAvailabilityConcern ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
            {lowAvailabilityConcern ? "At or below min threshold" : "No low-availability signal"}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-zinc-900 dark:text-zinc-50">Operational readiness concerns</dt>
          <dd className={readinessConcernCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400"}>
            {readinessConcernCount}
          </dd>
        </div>
      </dl>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-medium">Assignments</h3>
          <Link
            href={`/gear-ops/items/${item.id}/assign`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Assign gear
          </Link>
        </div>
        {item.assignments.length === 0 ? (
          <EmptyState message="No assignment records are currently visible for this item." />
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Current assignments
              </h4>
              {currentAssignments.length === 0 ? (
                <EmptyState message="No active assignment records are currently visible for this item." />
              ) : (
                <div className="space-y-3">{currentAssignments.map((assignment) => renderAssignmentCard(assignment))}</div>
              )}
            </div>

            <div id="scan-activity" className="space-y-3">
              <h3 className="text-lg font-medium">Recent scan activity</h3>
              {item.scanEvents.length === 0 ? (
                <EmptyState message="No scan activity is currently recorded for this item." />
              ) : (
                <div className="space-y-2">
                  {item.scanEvents.map((event) => {
                    const eventContext = SCAN_CONTEXTS.includes(event.scanContext as ScanContext)
                      ? (event.scanContext as ScanContext)
                      : null;
                    const eventResult = SCAN_EVENT_RESULTS.includes(event.result as ScanEventResult)
                      ? (event.result as ScanEventResult)
                      : null;

                    return (
                      <article key={event.id} className="rounded-lg border bg-white p-3 text-sm dark:bg-zinc-900">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="font-medium">{eventResult ? labelForScanEventResult(eventResult) : event.result}</p>
                          <time className="text-xs text-zinc-500">{formatGearOpsDateTime(event.createdAt)}</time>
                        </div>
                        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                          Context: {eventContext ? labelForScanContext(eventContext) : event.scanContext}
                          {" · "}Identifier: {event.inventoryIdentifierType}
                          {" · "}Value: <span className="font-mono">{event.rawValue}</span>
                        </p>
                        {event.actor ? (
                          <p className="mt-1 text-xs text-zinc-500">
                            Actor:{" "}
                            <Link href={`/people/${event.actor.id}`} className="underline">
                              {event.actor.firstName} {event.actor.lastName}
                            </Link>
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Assignment history
              </h4>
              {assignmentHistory.length === 0 ? (
                <EmptyState message="No assignment history is currently visible for this item." />
              ) : (
                <div className="space-y-3">{assignmentHistory.map((assignment) => renderAssignmentCard(assignment))}</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div id="checkouts" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-medium">Checkouts</h3>
          <Link
            href={`/gear-ops/items/${item.id}/checkout`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Check out gear
          </Link>
        </div>
        {item.checkouts.length === 0 ? (
          <EmptyState message="No checkout history is currently visible for this item." />
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Current open checkouts
              </h4>
              {currentCheckouts.length === 0 ? (
                <EmptyState message="No open checkout records are currently visible for this item." />
              ) : (
                <div className="space-y-3">{currentCheckouts.map((checkout) => renderCheckoutCard(checkout))}</div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Checkout history
              </h4>
              {checkoutHistory.length === 0 ? (
                <EmptyState message="No completed checkout history is currently visible for this item." />
              ) : (
                <div className="space-y-3">{checkoutHistory.map((checkout) => renderCheckoutCard(checkout))}</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-medium">Maintenance and condition logs</h3>
          <Link
            href={`/gear-ops/items/${item.id}/maintenance/new`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            New maintenance log
          </Link>
        </div>
        {item.maintenanceLogs.length === 0 ? (
          <EmptyState message="No maintenance history is currently visible for this item." />
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Recent logs</h4>
              <div className="space-y-3">{recentMaintenanceLogs.map((entry) => renderMaintenanceCard(entry))}</div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Maintenance history
              </h4>
              {maintenanceHistory.length === 0 ? (
                <EmptyState message="No additional maintenance history is currently visible for this item." />
              ) : (
                <div className="space-y-3">{maintenanceHistory.map((entry) => renderMaintenanceCard(entry))}</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-medium">Consumable transactions</h3>
          {item.inventoryType === GearInventoryType.CONSUMABLE ? (
            <Link
              href={`/gear-ops/items/${item.id}/consumables/new`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              New transaction
            </Link>
          ) : null}
        </div>
        {item.inventoryType !== GearInventoryType.CONSUMABLE ? (
          <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            Consumable transactions do not apply to durable gear items.
          </div>
        ) : item.consumableTransactions.length === 0 ? (
          <EmptyState message="No consumable transaction history is currently visible for this item." />
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Recent transactions
              </h4>
              <div className="space-y-3">
                {recentConsumableTransactions.map((entry) => renderConsumableTransactionCard(entry))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Transaction history
              </h4>
              {consumableTransactionHistory.length === 0 ? (
                <EmptyState message="No additional consumable transaction history is currently visible for this item." />
              ) : (
                <div className="space-y-3">
                  {consumableTransactionHistory.map((entry) => renderConsumableTransactionCard(entry))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div id="movement-history" className="space-y-3">
        <h3 className="text-lg font-medium">Inventory movement history</h3>
        {item.inventoryMovements.length === 0 ? (
          <EmptyState message="No inventory movement history is currently recorded for this item." />
        ) : (
          <div className="space-y-2">
            {item.inventoryMovements.map((movement) => (
              <article key={movement.id} className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{labelForMovementType(movement.movementType)}</p>
                  <time className="text-xs text-zinc-500">{formatGearOpsDateTime(movement.occurredAt)}</time>
                </div>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  By{" "}
                  <Link href={`/people/${movement.actor.id}`} className="underline">
                    {movement.actor.firstName} {movement.actor.lastName}
                  </Link>
                  {movement.custodyPerson ? (
                    <>
                      {" · "}Custody:{" "}
                      <Link href={`/people/${movement.custodyPerson.id}`} className="underline">
                        {movement.custodyPerson.firstName} {movement.custodyPerson.lastName}
                      </Link>
                    </>
                  ) : null}
                </p>
                {(movement.fromLocation || movement.toLocation) ? (
                  <p className="mt-1 text-zinc-500 dark:text-zinc-400 text-xs">
                    {movement.fromLocation ? (
                      <>
                        From:{" "}
                        <Link href={`/gear-ops/locations/${movement.fromLocation.id}`} className="underline">
                          {movement.fromLocation.name}
                          {movement.fromLocation.locationCode ? ` (${movement.fromLocation.locationCode})` : ""}
                        </Link>
                      </>
                    ) : null}
                    {movement.fromLocation && movement.toLocation ? " → " : null}
                    {movement.toLocation ? (
                      <>
                        To:{" "}
                        <Link href={`/gear-ops/locations/${movement.toLocation.id}`} className="underline">
                          {movement.toLocation.name}
                          {movement.toLocation.locationCode ? ` (${movement.toLocation.locationCode})` : ""}
                        </Link>
                      </>
                    ) : null}
                  </p>
                ) : null}
                {movement.relatedRecordType ? (
                  <p className="mt-1 text-zinc-500 text-xs">Context: {movement.relatedRecordType}</p>
                ) : null}
                {movement.notes ? (
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">{movement.notes}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
