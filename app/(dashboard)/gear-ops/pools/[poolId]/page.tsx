import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { isPoolMemberDisplayAvailable, summarizePoolAvailability } from "@/lib/gear-inventory-pool";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ poolId: string }>;
};

export default async function PoolDetailPage({ params }: Props) {
  const { poolId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Pool</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.pools.detail.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="Pool" description="Inventory pool detail." />
        <GearOpsSubnav current="pools" />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let pool;
  try {
    pool = await db.inventoryPool.findUnique({
      where: { id: poolId },
      include: {
        memberships: {
          orderBy: { addedAt: "asc" },
          include: {
            gearItem: {
              select: {
                id: true,
                name: true,
                serialNumber: true,
                lifecycleStatus: true,
                conditionStatus: true,
                readinessState: true,
                inventoryType: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
  } catch {
    return (
      <section className="space-y-4">
        <BackLink href="/gear-ops/pools" label="Back to pools" />
        <ErrorMessage message="Unable to load pool. Database tables may not be ready." />
      </section>
    );
  }

  if (!pool || pool.organizationId !== scope.organizationId) {
    notFound();
  }

  // Build availability summary using pure lib helper
  const memberSnapshots = pool.memberships.map((m) => ({
    membershipId: m.id,
    gearItemId: m.gearItem.id,
    gearItemName: m.gearItem.name,
    inventoryType: m.gearItem.inventoryType,
    gearCategoryId: m.gearItem.category?.id ?? "",
    gearCategoryName: m.gearItem.category?.name ?? "",
    lifecycleStatus: m.gearItem.lifecycleStatus,
    readinessState: m.gearItem.readinessState,
    poolId: pool.id,
  }));

  const poolSnapshot = { poolId: pool.id, poolName: pool.name };
  const summary = summarizePoolAvailability(poolSnapshot, memberSnapshots);
  // Normalize summary field names for display
  const displaySummary = {
    total: summary.totalMembers,
    available: summary.availableMembers,
    unavailable: summary.unavailableMembers,
  };

  return (
    <section className="space-y-4">
      <BackLink href="/gear-ops/pools" label="Back to pools" />
      <PageHeader
        title={pool.name}
        description={pool.description ?? "Inventory pool."}
      />
      <GearOpsSubnav current="pools" />

      {/* Pool metadata */}
      <div className="rounded-lg border bg-white p-5 dark:bg-zinc-900">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Status</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  pool.active
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {pool.active ? "Active" : "Inactive"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Members</dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{displaySummary.total}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Available</dt>
            <dd className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">{displaySummary.available}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Unavailable</dt>
            <dd className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{displaySummary.unavailable}</dd>
          </div>
        </dl>
      </div>

      {/* Members */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Members</h3>
          <Link
            href={`/gear-ops/pools/${poolId}/add-item`}
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            + Add Item
          </Link>
        </div>

        {pool.memberships.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No items in this pool.</p>
            <div className="mt-3">
              <Link
                href={`/gear-ops/pools/${poolId}/add-item`}
                className="text-sm font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300"
              >
                Add first item
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white dark:bg-zinc-900">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Type / Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Lifecycle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Availability</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {pool.memberships.map((m) => {
                  const snap = memberSnapshots.find((s) => s.membershipId === m.id)!;
                  const available = isPoolMemberDisplayAvailable(snap);
                  return (
                    <tr key={m.id}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/gear-ops/items/${m.gearItem.id}`}
                          className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                        >
                          {m.gearItem.name}
                        </Link>
                        {m.gearItem.serialNumber && (
                          <p className="mt-0.5 text-xs text-zinc-400">{m.gearItem.serialNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                        <span>{m.gearItem.inventoryType}</span>
                        {m.gearItem.category && (
                          <span className="ml-1 text-zinc-400">/ {m.gearItem.category.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                        {m.gearItem.lifecycleStatus.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            available
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {available ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <form
                          action={`/gear-ops/pools/${poolId}/remove-item/${m.id}`}
                          method="POST"
                        >
                          <button
                            type="submit"
                            className="text-xs text-rose-600 hover:underline dark:text-rose-400"
                          >
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
