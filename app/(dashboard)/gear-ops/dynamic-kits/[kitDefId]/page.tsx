import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import {
  getAllocationStatusBadgeClass,
  labelForAllocationStatus,
} from "@/lib/gear-dynamic-kit";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ kitDefId: string }>;
};

export default async function DynamicKitDetailPage({ params }: Props) {
  const { kitDefId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Dynamic Kit</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.dynamic-kits.detail.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="Dynamic Kit" description="Requirements-based kit definition." />
        <GearOpsSubnav current="dynamic-kits" />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let def;
  try {
    def = await db.dynamicKitDefinition.findUnique({
      where: { id: kitDefId },
      include: {
        requirements: {
          orderBy: { createdAt: "asc" },
          include: {
            gearCategory: { select: { name: true } },
          },
        },
        allocations: {
          orderBy: { allocatedAt: "desc" },
          take: 10,
          include: {
            items: {
              include: {
                gearItem: { select: { id: true, name: true, serialNumber: true } },
              },
            },
            reservation: { select: { id: true, notes: true, purpose: true } },
          },
        },
      },
    });
  } catch {
    return (
      <section className="space-y-4">
        <BackLink href="/gear-ops/dynamic-kits" label="Back to dynamic kits" />
        <ErrorMessage message="Unable to load dynamic kit definition. Database tables may not be ready." />
      </section>
    );
  }

  if (!def || def.organizationId !== scope.organizationId) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <BackLink href="/gear-ops/dynamic-kits" label="Back to dynamic kits" />
      <PageHeader
        title={def.name}
        description={def.description ?? "Requirements-based kit definition."}
      />
      <GearOpsSubnav current="dynamic-kits" />

      {/* Kit metadata */}
      <div className="rounded-lg border bg-white p-5 dark:bg-zinc-900">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Category</dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{def.category ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Status</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  def.active
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {def.active ? "Active" : "Inactive"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Requirements</dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{def.requirements.length}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Allocations</dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">{def.allocations.length}+</dd>
          </div>
        </dl>
      </div>

      {/* Requirements */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Requirements</h3>
          <form action={`/gear-ops/dynamic-kits/${kitDefId}/requirements/add`} method="POST">
            <Link
              href={`/gear-ops/dynamic-kits/${kitDefId}/requirements/new`}
              className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              + Add Requirement
            </Link>
          </form>
        </div>

        {def.requirements.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No requirements defined.</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              Add requirements to define what inventory this kit needs.
            </p>
            <div className="mt-3">
              <Link
                href={`/gear-ops/dynamic-kits/${kitDefId}/requirements/new`}
                className="text-sm font-medium text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300"
              >
                Add first requirement
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-white dark:bg-zinc-900">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-700">
              <thead className="bg-zinc-50 dark:bg-zinc-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Inventory Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Notes</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {def.requirements.map((req) => (
                  <tr key={req.id}>
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {req.inventoryType.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {req.gearCategory?.name ?? req.categoryLabel ?? <span className="italic text-zinc-400">Any</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {req.quantityRequired}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
                      {req.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form
                        action={`/gear-ops/dynamic-kits/${kitDefId}/requirements/${req.id}/delete`}
                        method="POST"
                      >
                        <button
                          type="submit"
                          className="text-xs text-rose-600 hover:underline dark:text-rose-400"
                          onClick={(e) => {
                            if (!confirm("Remove this requirement?")) e.preventDefault();
                          }}
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Allocations */}
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Recent Allocations</h3>
        {def.allocations.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No allocations yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {def.allocations.map((alloc) => (
              <div key={alloc.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getAllocationStatusBadgeClass(alloc.status)}`}>
                      {labelForAllocationStatus(alloc.status)}
                    </span>
                    {alloc.reservation && (
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">
                        Reservation: {alloc.reservation.notes ?? alloc.reservation.purpose ?? alloc.reservation.id}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400">
                    {alloc.allocatedAt.toLocaleDateString()}
                  </span>
                </div>
                {alloc.items.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {alloc.items.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400" />
                        <Link
                          href={`/gear-ops/items/${item.gearItem.id}`}
                          className="hover:underline"
                        >
                          {item.gearItem.name}
                          {item.gearItem.serialNumber && (
                            <span className="ml-1 text-zinc-400">({item.gearItem.serialNumber})</span>
                          )}
                        </Link>
                        {item.returnIssue && (
                          <span className="rounded bg-amber-100 px-1.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            {item.returnIssue.replace(/_/g, " ")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
