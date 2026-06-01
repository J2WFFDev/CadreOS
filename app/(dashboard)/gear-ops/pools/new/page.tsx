import { BackLink } from "@/components/dashboard/back-link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function NewPoolPage() {
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New Inventory Pool</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.pools.create.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="New Inventory Pool" description="Create an inventory pool." />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <BackLink href="/gear-ops/pools" label="Back to pools" />
      <PageHeader title="New Inventory Pool" description="Create a named collection of eligible gear for dynamic allocation." />
      <GearOpsSubnav current="pools" />

      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <form action="/gear-ops/pools/create" method="POST" className="space-y-5">
          <div className="space-y-1">
            <label htmlFor="name" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Pool name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              maxLength={120}
              placeholder="e.g., Magazine Pool, Radio Pool, Rifle Pool"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="description" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={500}
              placeholder="Optional description of what items belong in this pool."
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              name="active"
              value="1"
              defaultChecked
              className="rounded border-zinc-300"
            />
            <label htmlFor="active" className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Active
            </label>
          </div>

          <hr className="border-zinc-200 dark:border-zinc-700" />

          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            After creating the pool, you can add inventory items from the pool detail page.
          </p>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Create Pool
            </button>
            <a
              href="/gear-ops/pools"
              className="rounded-md border px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>
    </section>
  );
}
