import { GearReservationStatus } from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { GearOpsSchemaWarning } from "@/components/gear-ops/schema-warning";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsDateTime, formatGearOpsEnum } from "@/lib/gear-ops";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getGearOpsSchemaStatus } from "@/lib/gear-ops-schema-status";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function GearOpsReservationsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Reservations</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load reservations right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Reservations</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.reservations.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Reservations</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  const schemaStatus = await getGearOpsSchemaStatus("reservation-creation");
  if (!schemaStatus.schemaReady) {
    return (
      <section className="space-y-4">
        <GearOpsSubnav current="reservations" />
        <h2 className="text-2xl font-semibold tracking-tight">Reservations</h2>
        <GearOpsSchemaWarning
          actionMessage="Run database setup before using reservation workflows."
          status={schemaStatus}
          organizationId={scope.organizationId}
          actorPersonId={scope.auth.personId}
        />
      </section>
    );
  }

  const reservations = await db.gearReservation.findMany({
    where: { organizationId: scope.organizationId },
    select: {
      id: true,
      status: true,
      workflowStatus: true,
      windowStartAt: true,
      windowEndAt: true,
      purpose: true,
      requestedBy: { select: { id: true, firstName: true, lastName: true } },
      reservedFor: { select: { id: true, firstName: true, lastName: true } },
      gearItem: { select: { id: true, name: true } },
      inventoryKit: {
        select: {
          id: true,
          name: true,
          items: {
            where: { removedAt: null },
            select: {
              id: true,
              gearItem: {
                select: {
                  id: true,
                  name: true,
                  lifecycleStatus: true,
                  checkouts: {
                    where: { status: { in: ["OPEN", "OVERDUE"] } },
                    select: { id: true },
                    take: 1,
                  },
                  reservations: {
                    where: { status: { in: ["ACTIVE", "PENDING_REVIEW", "CONFLICT"] } },
                    select: { id: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
  });

  return (
    <section className="space-y-4">
      <GearOpsSubnav current="reservations" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Reservations</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Approval, checkout, and custody workflow foundation list.
          </p>
        </div>
        <Link href="/gear-ops/items" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Create from item
        </Link>
      </div>

      {reservations.length === 0 ? (
        <EmptyState message="No reservation records are currently visible." />
      ) : (
        <div className="space-y-3">
          {reservations.map((reservation) => (
            <article key={reservation.id} className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">
                  {formatGearOpsEnum(reservation.workflowStatus)} · {formatGearOpsEnum(reservation.status)}
                </p>
                {reservation.gearItem && (
                  <Link
                    href={`/gear-ops/items/${reservation.gearItem.id}`}
                    className="rounded-md border px-2.5 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    View item
                  </Link>
                )}
              </div>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                {reservation.gearItem ? (
                  <>
                    Item:{" "}
                    <Link href={`/gear-ops/items/${reservation.gearItem.id}`} className="underline">
                      {reservation.gearItem.name}
                    </Link>
                  </>
                ) : null}
                {reservation.inventoryKit ? (
                  <>
                    {" · "}Kit:{" "}
                    <Link href={`/gear-ops/kits/${reservation.inventoryKit.id}`} className="underline">
                      {reservation.inventoryKit.name}
                    </Link>
                  </>
                ) : null}
                {" · "}Requested by{" "}
                <Link href={`/people/${reservation.requestedBy.id}`} className="underline">
                  {reservation.requestedBy.firstName} {reservation.requestedBy.lastName}
                </Link>
                {" · "}Requested for{" "}
                {reservation.reservedFor ? (
                  <Link href={`/people/${reservation.reservedFor.id}`} className="underline">
                    {reservation.reservedFor.firstName} {reservation.reservedFor.lastName}
                  </Link>
                ) : (
                  "—"
                )}
              </p>
              <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                Window: {formatGearOpsDateTime(reservation.windowStartAt)} → {formatGearOpsDateTime(reservation.windowEndAt)}
              </p>
              {reservation.inventoryKit ? (
                <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/40">
                  <p className="font-medium text-zinc-700 dark:text-zinc-200">
                    Kit members ({reservation.inventoryKit.items.length})
                  </p>
                  <p className="mt-1 text-zinc-500 dark:text-zinc-400">
                    Availability summary:{" "}
                    {reservation.inventoryKit.items.filter((item) => item.gearItem.checkouts.length === 0).length} not checked out ·{" "}
                    {reservation.inventoryKit.items.filter((item) => item.gearItem.reservations.length === 0).length} not reserved ·{" "}
                    {reservation.inventoryKit.items.filter((item) =>
                      ["MAINTENANCE", "QUARANTINED", "RETIRED", "LOST"].includes(item.gearItem.lifecycleStatus),
                    ).length} out of service
                  </p>
                  <ul className="mt-2 space-y-1">
                    {reservation.inventoryKit.items.map((item) => (
                      <li key={item.id}>
                        <Link className="underline" href={`/gear-ops/items/${item.gearItem.id}`}>
                          {item.gearItem.name}
                        </Link>
                        <span className="text-zinc-500">
                          {item.gearItem.checkouts.length > 0 ? " · Checked out" : ""}
                          {item.gearItem.reservations.length > 0 ? " · Reserved" : ""}
                          {["MAINTENANCE", "QUARANTINED", "RETIRED", "LOST"].includes(item.gearItem.lifecycleStatus)
                            ? " · Out of service"
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {reservation.status === GearReservationStatus.PENDING_REVIEW && reservation.gearItem ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={`/gear-ops/items/${reservation.gearItem.id}/reservations/${reservation.id}/status`} method="post">
                    <input type="hidden" name="status" value="ACTIVE" />
                    <input type="hidden" name="reason" value="Approved from reservations list." />
                    <button type="submit" className="rounded-md border px-2.5 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      Approve
                    </button>
                  </form>
                  <form action={`/gear-ops/items/${reservation.gearItem.id}/reservations/${reservation.id}/status`} method="post">
                    <input type="hidden" name="status" value="CANCELED" />
                    <input type="hidden" name="reason" value="Denied from reservations list." />
                    <button type="submit" className="rounded-md border px-2.5 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      Deny
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
