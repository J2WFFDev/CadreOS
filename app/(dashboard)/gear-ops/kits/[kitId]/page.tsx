import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearOpsDateTime, formatGearOpsEnum, getGearLifecycleBadgeClass } from "@/lib/gear-ops";
import { resolveInventoryOpsReadAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function InventoryKitDetailPage({
  params,
}: {
  params: Promise<{ kitId: string }>;
}) {
  const { kitId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory kit</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load kit details right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory kit</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveInventoryOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.kits.detail.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <BackLink href="/gear-ops/kits" label="Back to kits" />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let kit: {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    owner: { id: string; firstName: string; lastName: string } | null;
    items: Array<{
      id: string;
      quantity: number;
      notes: string | null;
      addedAt: Date;
      removedAt: Date | null;
      gearItem: {
        id: string;
        name: string;
        lifecycleStatus: import("@prisma/client").GearItemLifecycleStatus;
        inventoryType: import("@prisma/client").GearInventoryType;
      };
    }>;
  } | null = null;
  let queryErrorMessage = "Unable to load kit details right now. Please try again later.";

  try {
    kit = await db.inventoryKit.findFirst({
      where: { id: kitId, organizationId: scope.organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        owner: { select: { id: true, firstName: true, lastName: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            notes: true,
            addedAt: true,
            removedAt: true,
            gearItem: { select: { id: true, name: true, lifecycleStatus: true, inventoryType: true } },
          },
          orderBy: [{ addedAt: "desc" }],
        },
      },
    });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet.";
    }
  }

  if (!kit) {
    return (
      <section className="space-y-4">
        <BackLink href="/gear-ops/kits" label="Back to kits" />
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const activeItems = kit.items.filter((i) => !i.removedAt);
  const removedItems = kit.items.filter((i) => i.removedAt);

  return (
    <section className="space-y-4">
      <BackLink href="/gear-ops/kits" label="Back to kits" />
      <GearOpsSubnav current="kits" />

      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">{kit.name}</h2>
            {kit.description ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{kit.description}</p>
            ) : null}
            {kit.owner ? (
              <p className="text-sm text-zinc-500">
                Owner:{" "}
                <Link href={`/people/${kit.owner.id}`} className="underline">
                  {kit.owner.firstName} {kit.owner.lastName}
                </Link>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {!kit.isActive ? (
              <span className="rounded-full bg-zinc-200 px-2.5 py-1 font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                Inactive
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                Active
              </span>
            )}
            <Link
              href={`/gear-ops/labels?subjectType=INVENTORY_KIT&subjectId=${kit.id}&template=KIT_LOADOUT`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Print label
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Kit contents ({activeItems.length} {activeItems.length === 1 ? "item" : "items"})
        </h3>
        {activeItems.length === 0 ? (
          <EmptyState message="No gear items are currently in this kit." />
        ) : (
          <div className="space-y-2">
            {activeItems.map((kitItem) => (
              <article key={kitItem.id} className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <Link href={`/gear-ops/items/${kitItem.gearItem.id}`} className="text-sm underline">
                      {kitItem.gearItem.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {formatGearOpsEnum(kitItem.gearItem.inventoryType)} · Qty: {kitItem.quantity}
                      {kitItem.notes ? ` · ${kitItem.notes}` : ""}
                    </p>
                    <p className="text-xs text-zinc-400">Added {formatGearOpsDateTime(kitItem.addedAt)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getGearLifecycleBadgeClass(kitItem.gearItem.lifecycleStatus)}`}>
                    {formatGearOpsEnum(kitItem.gearItem.lifecycleStatus)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {removedItems.length > 0 ? (
        <details className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <summary className="cursor-pointer text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Previously removed items ({removedItems.length})
          </summary>
          <div className="mt-3 space-y-2">
            {removedItems.map((kitItem) => (
              <div key={kitItem.id} className="flex items-center justify-between gap-2 text-sm text-zinc-400">
                <Link href={`/gear-ops/items/${kitItem.gearItem.id}`} className="underline">
                  {kitItem.gearItem.name}
                </Link>
                {kitItem.removedAt ? (
                  <span className="text-xs">Removed {formatGearOpsDateTime(kitItem.removedAt)}</span>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
