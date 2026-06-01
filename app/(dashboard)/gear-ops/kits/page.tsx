import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSchemaWarning } from "@/components/gear-ops/schema-warning";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { getGearOpsSchemaStatus } from "@/lib/gear-ops-schema-status";
import { listInventoryKits, resolveInventoryOpsReadAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

function deriveListStaticAvailability(input: {
  readinessLabel: string;
  custodyStatus: string;
}) {
  if (
    input.custodyStatus === "CHECKED_OUT" ||
    input.custodyStatus === "RESERVED" ||
    input.custodyStatus === "IN_MAINTENANCE" ||
    input.readinessLabel === "OUT_OF_SERVICE" ||
    input.readinessLabel === "MISSING_COMPONENTS" ||
    input.readinessLabel === "CONFLICT"
  ) {
    return "UNAVAILABLE";
  }

  if (
    input.readinessLabel === "INCOMPLETE" ||
    input.readinessLabel === "LIMITED_USE" ||
    input.readinessLabel === "MAINTENANCE_NEEDED" ||
    input.readinessLabel === "NEEDS_INSPECTION" ||
    input.readinessLabel === "READY_WITH_WARNING"
  ) {
    return "INCOMPLETE";
  }

  return "AVAILABLE";
}

export default async function InventoryKitsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory kits</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load inventory kits right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory kits</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveInventoryOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.kits.list.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="Inventory kits" description="Operational kits and equipment loadouts." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  const schemaStatus = await getGearOpsSchemaStatus("kits");
  if (!schemaStatus.schemaReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Inventory kits" description="Operational kits and equipment loadouts." />
        <GearOpsSubnav current="kits" />
        <GearOpsSchemaWarning
          actionMessage="Run database setup before loading inventory kits."
          status={schemaStatus}
          organizationId={scope.organizationId}
          actorPersonId={scope.auth.personId}
        />
      </section>
    );
  }

  let kits: Awaited<ReturnType<typeof listInventoryKits>> | null = null;
  let queryErrorMessage = "Unable to load inventory kits right now. Please try again later.";

  try {
    kits = await listInventoryKits({ organizationId: scope.organizationId });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading inventory kits.";
    }
  }

  if (!kits) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory kits</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const activeKits = kits.filter((k) => k.isActive);
  const inactiveKits = kits.filter((k) => !k.isActive);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Inventory kits"
        description="Operational equipment kits and loadouts grouping multiple gear items for coordinated use."
      />
      <GearOpsSubnav current="kits" />

      <div className="flex justify-end">
        <Link
          href="/gear-ops/kits/new"
          className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
        >
          New kit
        </Link>
      </div>

      {kits.length === 0 ? (
        <EmptyState
          message="No inventory kits have been created yet. Create a kit to group gear items into operational loadouts."
          actionHref="/gear-ops/kits/new"
          actionLabel="New kit"
        />
      ) : (
        <div className="space-y-6">
          {activeKits.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Active kits</h3>
              {activeKits.map((kit) => (
                <article key={kit.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h4 className="text-base font-medium">
                        <Link href={`/gear-ops/kits/${kit.id}`} className="underline">
                          {kit.name}
                        </Link>
                      </h4>
                      {kit.description ? (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">{kit.description}</p>
                      ) : null}
                      {kit.category ? <p className="text-sm text-zinc-500">Category: {kit.category}</p> : null}
                      {kit.owner ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-500">
                          Owner:{" "}
                          <Link href={`/people/${kit.owner.id}`} className="underline">
                            {kit.owner.firstName} {kit.owner.lastName}
                          </Link>
                        </p>
                      ) : null}
                    </div>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {kit.itemCount} {kit.itemCount === 1 ? "item" : "items"}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        deriveListStaticAvailability(kit) === "AVAILABLE"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                          : deriveListStaticAvailability(kit) === "INCOMPLETE"
                            ? "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
                      }`}
                    >
                      {deriveListStaticAvailability(kit)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {inactiveKits.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Inactive kits</h3>
              {inactiveKits.map((kit) => (
                <article key={kit.id} className="rounded-lg border bg-white p-4 opacity-60 dark:bg-zinc-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h4 className="text-base font-medium">
                      <Link href={`/gear-ops/kits/${kit.id}`} className="underline">
                        {kit.name}
                      </Link>
                    </h4>
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
