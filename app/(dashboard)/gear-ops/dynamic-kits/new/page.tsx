import { BackLink } from "@/components/dashboard/back-link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function NewDynamicKitPage() {
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New Dynamic Kit</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.dynamic-kits.create.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="New Dynamic Kit" description="Define a requirements-based kit." />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
      </section>
    );
  }

  const categories = await db.gearCategory.findMany({
    where: { organizationId: scope.organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <section className="space-y-4">
      <BackLink href="/gear-ops/dynamic-kits" label="Back to dynamic kits" />
      <PageHeader title="New Dynamic Kit" description="Define a requirements-based kit for dynamic inventory allocation." />
      <GearOpsSubnav current="dynamic-kits" />

      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <form action="/gear-ops/dynamic-kits/create" method="POST" className="space-y-5">
          <div className="space-y-1">
            <label htmlFor="name" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Kit name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              maxLength={120}
              placeholder="e.g., Practice Rifle Kit, Event Radio Kit"
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
              placeholder="Optional description of what this kit is used for."
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="category" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Category
            </label>
            <select
              id="category"
              name="category"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">— No category —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
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
            After creating the kit, you can add inventory requirements from the kit detail page.
          </p>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Create Dynamic Kit
            </button>
            <a
              href="/gear-ops/dynamic-kits"
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
