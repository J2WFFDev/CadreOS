import { BackLink } from "@/components/dashboard/back-link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ poolId: string }>;
};

export default async function AddItemToPoolPage({ params }: Props) {
  const { poolId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Add Item to Pool</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.pools.add-item.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="Add Item to Pool" description="Add an inventory item to this pool." />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
      </section>
    );
  }

  let pool;
  try {
    pool = await db.inventoryPool.findUnique({
      where: { id: poolId },
      select: {
        id: true,
        name: true,
        organizationId: true,
        memberships: { select: { gearItemId: true } },
      },
    });
  } catch {
    pool = null;
  }

  if (!pool || pool.organizationId !== scope.organizationId) {
    notFound();
  }

  // Exclude items already in pool
  const existingItemIds = pool.memberships.map((m) => m.gearItemId);

  const availableItems = await db.gearItem.findMany({
    where: {
      organizationId: scope.organizationId,
      id: existingItemIds.length > 0 ? { notIn: existingItemIds } : undefined,
      lifecycleStatus: { notIn: ["RETIRED", "LOST"] },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      serialNumber: true,
      inventoryType: true,
      lifecycleStatus: true,
      category: { select: { name: true } },
    },
    take: 200,
  });

  return (
    <section className="space-y-4">
      <BackLink href={`/gear-ops/pools/${poolId}`} label={`Back to ${pool.name}`} />
      <PageHeader title="Add Item to Pool" description={`Add an inventory item to "${pool.name}".`} />
      <GearOpsSubnav current="pools" />

      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900">
        {availableItems.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No available items to add. All active inventory items are already in this pool, or no items exist.
          </p>
        ) : (
          <form action={`/gear-ops/pools/${poolId}/add-item-submit`} method="POST" className="space-y-5">
            <div className="space-y-1">
              <label htmlFor="gearItemId" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Select item <span className="text-rose-500">*</span>
              </label>
              <select
                id="gearItemId"
                name="gearItemId"
                required
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
              >
                <option value="">— Select an item —</option>
                {availableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.serialNumber ? ` (${item.serialNumber})` : ""}
                    {item.category ? ` — ${item.category.name}` : ""}
                    {` [${item.inventoryType}]`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Add to Pool
              </button>
              <a
                href={`/gear-ops/pools/${poolId}`}
                className="rounded-md border px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </a>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
