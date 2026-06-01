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

  const schemaStatus = await getGearOpsSchemaStatus("reservations-list");
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
                <Link
                  href={`/gear-ops/items/${reservation.gearItem.id}`}
                  className="rounded-md border px-2.5 py-1 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  View item
                </Link>
              </div>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                Item:{" "}
                <Link href={`/gear-ops/items/${reservation.gearItem.id}`} className="underline">
                  {reservation.gearItem.name}
                </Link>
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
              {reservation.status === GearReservationStatus.PENDING_REVIEW ? (
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
