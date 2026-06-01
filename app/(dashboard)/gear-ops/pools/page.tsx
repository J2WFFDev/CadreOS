import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function PoolsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory Pools</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load pools right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory Pools</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.pools.list.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="Inventory Pools" description="Named collections of eligible gear for dynamic allocation." />
        <GearOpsSubnav current="pools" />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  type Pool = {
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    _count: { memberships: number };
  };

  let pools: Pool[] | null = null;
  let queryErrorMessage = "Unable to load inventory pools. Please try again later.";

  try {
    pools = await db.inventoryPool.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        active: true,
        _count: { select: { memberships: true } },
      },
    });
  } catch (err) {
    if (isSchemaUnavailableError(err)) {
      queryErrorMessage = "Inventory pool tables are not yet available. Run database setup to enable this feature.";
    }
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Inventory Pools"
        description="Named collections of eligible gear for dynamic allocation."
      />
      <GearOpsSubnav current="pools" />

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Pools group inventory items by purpose — the allocation engine draws from pools to fulfill kit requirements.
        </p>
        <Link
          href="/gear-ops/pools/new"
          className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          + New Pool
        </Link>
      </div>

      {pools === null ? (
        <ErrorMessage message={queryErrorMessage} />
      ) : pools.length === 0 ? (
        <EmptyState
          message="No inventory pools defined. Create a pool to group related inventory items for dynamic kit allocation."
          actionHref="/gear-ops/pools/new"
          actionLabel="Create Pool"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Pool Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Members</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {pools.map((pool) => (
                <tr key={pool.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/gear-ops/pools/${pool.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {pool.name}
                    </Link>
                    {pool.description && (
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{pool.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {pool._count.memberships}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        pool.active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {pool.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
