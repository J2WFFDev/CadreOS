import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { listInventoryLocations, resolveInventoryOpsReadAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function InventoryLocationsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory locations</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load inventory locations right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory locations</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveInventoryOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.locations.list.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="Inventory locations" description="Storage locations, vaults, and equipment cages." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let locations: Awaited<ReturnType<typeof listInventoryLocations>> | null = null;
  let queryErrorMessage = "Unable to load inventory locations right now. Please try again later.";

  try {
    locations = await listInventoryLocations({ organizationId: scope.organizationId });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading inventory locations.";
    }
  }

  if (!locations) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory locations</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const activeLocations = locations.filter((l) => l.isActive);
  const inactiveLocations = locations.filter((l) => !l.isActive);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Inventory locations"
        description="Storage locations, vaults, equipment cages, and team storage areas."
      />
      <GearOpsSubnav current="locations" />

      <div className="flex justify-end">
        <Link
          href="/gear-ops/locations/new"
          className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
        >
          New location
        </Link>
      </div>

      {locations.length === 0 ? (
        <EmptyState
          message="No inventory locations have been created yet. Add a location to start tracking where gear is stored."
          actionHref="/gear-ops/locations/new"
          actionLabel="New location"
        />
      ) : (
        <div className="space-y-6">
          {activeLocations.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Active locations</h3>
              {activeLocations.map((location) => (
                <article key={location.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="text-base font-medium">
                        <Link href={`/gear-ops/locations/${location.id}`} className="underline">
                          {location.name}
                        </Link>
                      </h4>
                      {location.description ? (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">{location.description}</p>
                      ) : null}
                      {location.parentLocation ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-500">
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
                      <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {location.itemCount} {location.itemCount === 1 ? "item" : "items"}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {inactiveLocations.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Inactive locations</h3>
              {inactiveLocations.map((location) => (
                <article key={location.id} className="rounded-lg border bg-white p-4 opacity-60 dark:bg-zinc-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="text-base font-medium">
                        <Link href={`/gear-ops/locations/${location.id}`} className="underline">
                          {location.name}
                        </Link>
                      </h4>
                    </div>
                    <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                      Inactive
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
