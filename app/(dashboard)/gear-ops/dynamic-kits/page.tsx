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

export default async function DynamicKitsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Dynamic Kits</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load dynamic kits right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Dynamic Kits</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.dynamic-kits.list.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="Dynamic Kits" description="Requirements-based kit definitions for dynamic inventory allocation." />
        <GearOpsSubnav current="dynamic-kits" />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  type KitDef = {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    active: boolean;
    createdAt: Date;
    _count: { requirements: number; allocations: number };
  };

  let kitDefs: KitDef[] | null = null;
  let queryErrorMessage = "Unable to load dynamic kit definitions. Please try again later.";

  try {
    kitDefs = await db.dynamicKitDefinition.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        active: true,
        createdAt: true,
        _count: {
          select: { requirements: true, allocations: true },
        },
      },
    });
  } catch (err) {
    if (isSchemaUnavailableError(err)) {
      queryErrorMessage = "Dynamic kit tables are not yet available. Run database setup to enable this feature.";
    }
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Dynamic Kits"
        description="Requirements-based kit definitions for dynamic inventory allocation."
      />
      <GearOpsSubnav current="dynamic-kits" />

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Define kit requirements — the allocation engine selects available inventory at reservation time.
        </p>
        <Link
          href="/gear-ops/dynamic-kits/new"
          className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          + New Dynamic Kit
        </Link>
      </div>

      {kitDefs === null ? (
        <ErrorMessage message={queryErrorMessage} />
      ) : kitDefs.length === 0 ? (
        <EmptyState
          message="No dynamic kits defined. Create a dynamic kit definition to describe what inventory a kit requires."
          actionHref="/gear-ops/dynamic-kits/new"
          actionLabel="Create Dynamic Kit"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
            <thead className="bg-zinc-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Requirements</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Allocations</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {kitDefs.map((def) => (
                <tr key={def.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/gear-ops/dynamic-kits/${def.id}`}
                      className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {def.name}
                    </Link>
                    {def.description && (
                      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{def.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {def.category ?? <span className="italic text-zinc-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {def._count.requirements}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {def._count.allocations}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        def.active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {def.active ? "Active" : "Inactive"}
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
