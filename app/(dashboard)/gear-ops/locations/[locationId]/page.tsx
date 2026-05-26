import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsEnum, getGearLifecycleBadgeClass } from "@/lib/gear-ops";
import { resolveInventoryOpsReadAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function InventoryLocationDetailPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory location</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load location details right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory location</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveInventoryOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.locations.detail.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <BackLink href="/gear-ops/locations" label="Back to locations" />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let location: {
    id: string;
    name: string;
    description: string | null;
    locationCode: string | null;
    isActive: boolean;
    parentLocation: { id: string; name: string } | null;
    childLocations: Array<{ id: string; name: string; locationCode: string | null; isActive: boolean }>;
    gearItems: Array<{
      id: string;
      name: string;
      lifecycleStatus: import("@prisma/client").GearItemLifecycleStatus;
      inventoryType: import("@prisma/client").GearInventoryType;
    }>;
  } | null = null;
  let queryErrorMessage = "Unable to load location details right now. Please try again later.";

  try {
    location = await db.inventoryLocation.findFirst({
      where: { id: locationId, organizationId: scope.organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        locationCode: true,
        isActive: true,
        parentLocation: { select: { id: true, name: true } },
        childLocations: {
          select: { id: true, name: true, locationCode: true, isActive: true },
          orderBy: [{ name: "asc" }],
        },
        gearItems: {
          select: { id: true, name: true, lifecycleStatus: true, inventoryType: true },
          orderBy: [{ name: "asc" }],
        },
      },
    });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet.";
    }
  }

  if (!location) {
    return (
      <section className="space-y-4">
        <BackLink href="/gear-ops/locations" label="Back to locations" />
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <BackLink href="/gear-ops/locations" label="Back to locations" />
      <GearOpsSubnav current="locations" />

      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{location.name}</h2>
            {location.description ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{location.description}</p>
            ) : null}
            {location.parentLocation ? (
              <p className="text-sm text-zinc-500">
                Parent:{" "}
                <Link href={`/gear-ops/locations/${location.parentLocation.id}`} className="underline">
                  {location.parentLocation.name}
                </Link>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {location.locationCode ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-mono font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {location.locationCode}
              </span>
            ) : null}
            {!location.isActive ? (
              <span className="rounded-full bg-zinc-200 px-2.5 py-1 font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                Inactive
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                Active
              </span>
            )}
            <Link
              href={`/gear-ops/labels?subjectType=INVENTORY_LOCATION&subjectId=${location.id}&template=${location.locationCode ? "INVENTORY_LOCATION" : "TEMPORARY_OPERATIONAL"}`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Print label
            </Link>
          </div>
        </div>
      </div>

      {location.childLocations.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Sub-locations</h3>
          <div className="space-y-2">
            {location.childLocations.map((child) => (
              <article key={child.id} className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/gear-ops/locations/${child.id}`} className="text-sm underline">
                    {child.name}
                  </Link>
                  {child.locationCode ? (
                    <span className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-600 dark:bg-zinc-800">
                      {child.locationCode}
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Items at this location ({location.gearItems.length})
        </h3>
        {location.gearItems.length === 0 ? (
          <EmptyState message="No gear items are currently assigned to this location." />
        ) : (
          <div className="space-y-2">
            {location.gearItems.map((item) => (
              <article key={item.id} className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/gear-ops/items/${item.id}`} className="text-sm underline">
                      {item.name}
                    </Link>
                    <span className="ml-2 text-xs text-zinc-500">{formatGearOpsEnum(item.inventoryType)}</span>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getGearLifecycleBadgeClass(item.lifecycleStatus)}`}>
                    {formatGearOpsEnum(item.lifecycleStatus)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
