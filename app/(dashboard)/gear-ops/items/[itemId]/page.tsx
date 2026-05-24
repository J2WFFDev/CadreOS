import {
  GearAssignmentStatus,
  GearCheckoutStatus,
  GearConditionStatus,
  GearInventoryType,
  GearItemLifecycleStatus,
  type GearMaintenanceType,
} from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
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

export default async function GearOpsItemDetailsPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const scope = await getOrganizationScope();

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
        sku: string | null;
        serialNumber: string | null;
        quantityOnHand: number;
        quantityMin: number | null;
        notes: string | null;
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
          conditionBefore: GearConditionStatus | null;
          conditionAfter: GearConditionStatus | null;
          notes: string;
          performedBy: { id: string; firstName: string; lastName: string };
        }>;
        consumableTransactions: Array<{
          id: string;
          transactionType: string;
          quantityDelta: number;
          recordedAt: Date;
          notes: string | null;
          recordedBy: { id: string; firstName: string; lastName: string };
          event: { id: string; title: string } | null;
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
        sku: true,
        serialNumber: true,
        quantityOnHand: true,
        quantityMin: true,
        notes: true,
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
            conditionBefore: true,
            conditionAfter: true,
            notes: true,
            performedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
          take: 8,
        },
        consumableTransactions: {
          select: {
            id: true,
            transactionType: true,
            quantityDelta: true,
            recordedAt: true,
            notes: true,
            recordedBy: { select: { id: true, firstName: true, lastName: true } },
            event: { select: { id: true, title: true } },
          },
          orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
          take: 8,
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
            <Link
              href={`/gear-ops/items/${item.id}/edit`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Edit
            </Link>
          </div>
        </div>
      </div>

      <dl className="grid gap-3 rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="space-y-3">
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
        <h3 className="text-lg font-medium">Maintenance history</h3>
        {item.maintenanceLogs.length === 0 ? (
          <EmptyState message="No maintenance history is currently visible for this item." />
        ) : (
          <div className="space-y-3">
            {item.maintenanceLogs.map((entry) => (
              <article key={entry.id} className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
                <p className="font-medium">
                  {formatGearOpsEnum(entry.maintenanceType)} · {formatGearOpsDateTime(entry.performedAt)}
                </p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Performed by{" "}
                  <Link href={`/people/${entry.performedBy.id}`} className="underline">
                    {entry.performedBy.firstName} {entry.performedBy.lastName}
                  </Link>
                </p>
                <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                  Before: {entry.conditionBefore ? formatGearOpsEnum(entry.conditionBefore) : "—"} · After:{" "}
                  {entry.conditionAfter ? formatGearOpsEnum(entry.conditionAfter) : "—"}
                </p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">{entry.notes}</p>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-medium">Consumable transactions</h3>
        {item.consumableTransactions.length === 0 ? (
          <EmptyState message="No consumable transaction history is currently visible for this item." />
        ) : (
          <div className="space-y-3">
            {item.consumableTransactions.map((entry) => (
              <article key={entry.id} className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
                <p className="font-medium">
                  {formatGearOpsEnum(entry.transactionType)} ({entry.quantityDelta > 0 ? "+" : ""}
                  {entry.quantityDelta}) · {formatGearOpsDateTime(entry.recordedAt)}
                </p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Recorded by{" "}
                  <Link href={`/people/${entry.recordedBy.id}`} className="underline">
                    {entry.recordedBy.firstName} {entry.recordedBy.lastName}
                  </Link>
                  {entry.event ? (
                    <>
                      {" · "}Event:{" "}
                      <Link href={`/events/${entry.event.id}`} className="underline">
                        {entry.event.title}
                      </Link>
                    </>
                  ) : null}
                </p>
                {entry.notes ? <p className="mt-1 text-zinc-600 dark:text-zinc-400">{entry.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
