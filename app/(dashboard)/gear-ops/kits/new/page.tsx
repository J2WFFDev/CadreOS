import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { resolveInventoryOpsReadAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

const KIT_TYPE_OPTIONS = [
  { value: "KIT", label: "Kit" },
  { value: "BUNDLE", label: "Bundle" },
  { value: "CASE", label: "Case" },
  { value: "BAG", label: "Bag" },
  { value: "SET", label: "Set" },
  { value: "LOADOUT", label: "Loadout" },
  { value: "EQUIPMENT_PACKAGE", label: "Equipment Package" },
];

export default async function NewInventoryKitPage() {
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New kit</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const access = await resolveInventoryOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.kits.create.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="New kit" description="Create an inventory kit or loadout." />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <BackLink href="/gear-ops/kits" label="Back to kits" />
      <PageHeader title="New kit" description="Create an operational equipment kit or loadout." />
      <GearOpsSubnav current="kits" />

      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <form action="/gear-ops/kits/create" method="POST" className="space-y-5">
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
              placeholder="e.g., Match Day Kit, Event Radio Kit, Medical Response Bag"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="kitType" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Kit type
            </label>
            <select
              id="kitType"
              name="kitType"
              defaultValue="KIT"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            >
              {KIT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500">
              Choose the type that best describes how this collection is used or stored.
            </p>
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
              placeholder="Optional: describe the purpose and contents of this kit."
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="category" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Category
            </label>
            <input
              type="text"
              id="category"
              name="category"
              maxLength={80}
              placeholder="e.g., Competition, Medical, Communications"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="notes" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={1000}
              placeholder="Optional operational notes for this static kit."
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <p className="text-xs text-zinc-500">
            After creating the kit, you can add gear items to it from the kit detail page.
          </p>

          <div className="flex justify-end gap-3">
            <Link href="/gear-ops/kits" className="rounded-md border px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800">
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
            >
              Create kit
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
