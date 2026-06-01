import { BackLink } from "@/components/dashboard/back-link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ kitDefId: string }>;
};

export default async function NewRequirementPage({ params }: Props) {
  const { kitDefId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Add Requirement</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.dynamic-kits.requirements.add.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="Add Requirement" description="Add a requirement to this dynamic kit." />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
      </section>
    );
  }

  let def;
  try {
    def = await db.dynamicKitDefinition.findUnique({
      where: { id: kitDefId },
      select: { id: true, name: true, organizationId: true },
    });
  } catch {
    def = null;
  }

  if (!def || def.organizationId !== scope.organizationId) {
    notFound();
  }

  const categories = await db.gearCategory.findMany({
    where: { organizationId: scope.organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <section className="space-y-4">
      <BackLink href={`/gear-ops/dynamic-kits/${kitDefId}`} label={`Back to ${def.name}`} />
      <PageHeader title="Add Requirement" description={`Add an inventory requirement to "${def.name}".`} />
      <GearOpsSubnav current="dynamic-kits" />

      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <form
          action={`/gear-ops/dynamic-kits/${kitDefId}/requirements/add`}
          method="POST"
          className="space-y-5"
        >
          <div className="space-y-1">
            <label htmlFor="inventoryType" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Inventory type <span className="text-rose-500">*</span>
            </label>
            <select
              id="inventoryType"
              name="inventoryType"
              required
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">— Select type —</option>
              <option value="DURABLE">Durable</option>
              <option value="CONSUMABLE">Consumable</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="gearCategoryId" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Category
            </label>
            <select
              id="gearCategoryId"
              name="gearCategoryId"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">— Any category —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-400">Leave blank to match any category of the selected type.</p>
          </div>

          <div className="space-y-1">
            <label htmlFor="categoryLabel" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Category label (free text)
            </label>
            <input
              type="text"
              id="categoryLabel"
              name="categoryLabel"
              maxLength={80}
              placeholder="e.g., Rifle, Magazine, Chamber Flag"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <p className="text-xs text-zinc-400">Optional label when a linked category is not available.</p>
          </div>

          <div className="space-y-1">
            <label htmlFor="quantityRequired" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Quantity required <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              id="quantityRequired"
              name="quantityRequired"
              required
              min={1}
              max={999}
              defaultValue={1}
              className="w-32 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="notes" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Notes
            </label>
            <input
              type="text"
              id="notes"
              name="notes"
              maxLength={200}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Add Requirement
            </button>
            <a
              href={`/gear-ops/dynamic-kits/${kitDefId}`}
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
