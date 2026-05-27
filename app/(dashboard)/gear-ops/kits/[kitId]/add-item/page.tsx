import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import { resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

const COMPONENT_ROLE_OPTIONS = [
  { value: "REQUIRED", label: "Required" },
  { value: "OPTIONAL", label: "Optional" },
  { value: "CONSUMABLE", label: "Consumable" },
  { value: "REPLACEABLE", label: "Replaceable" },
  { value: "QUANTITY_MANAGED", label: "Quantity managed" },
];

export default async function AddKitItemPage({
  params,
}: {
  params: Promise<{ kitId: string }>;
}) {
  const { kitId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Add item to kit</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const access = await resolveInventoryOpsWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.kits.items.add",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <BackLink href={`/gear-ops/kits/${kitId}`} label="Back to kit" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
      </section>
    );
  }

  let kit: { id: string; name: string } | null = null;
  let availableItems: Array<{ id: string; name: string; inventoryType: string }> = [];
  let errorMessage: string | null = null;

  try {
    const [kitResult, itemsResult] = await Promise.all([
      db.inventoryKit.findFirst({
        where: { id: kitId, organizationId: scope.organizationId },
        select: { id: true, name: true },
      }),
      db.gearItem.findMany({
        where: {
          organizationId: scope.organizationId,
          lifecycleStatus: { not: "RETIRED" },
        },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true, inventoryType: true },
        take: 200,
      }),
    ]);
    kit = kitResult;
    availableItems = itemsResult;
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      errorMessage = "Database schema is not available yet.";
    } else {
      errorMessage = "Unable to load items. Please try again.";
    }
  }

  if (errorMessage) {
    return (
      <section className="space-y-4">
        <BackLink href={`/gear-ops/kits/${kitId}`} label="Back to kit" />
        <ErrorMessage message={errorMessage} />
      </section>
    );
  }

  if (!kit) {
    return (
      <section className="space-y-4">
        <BackLink href="/gear-ops/kits" label="Back to kits" />
        <ErrorMessage message="Kit not found." />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <BackLink href={`/gear-ops/kits/${kitId}`} label="Back to kit" />
      <h2 className="text-xl font-semibold tracking-tight">Add item to {kit.name}</h2>

      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <form action={`/gear-ops/kits/${kitId}/add-item-action`} method="POST" className="space-y-5">
          <div className="space-y-1">
            <label htmlFor="gearItemId" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Gear item <span className="text-rose-500">*</span>
            </label>
            <select
              id="gearItemId"
              name="gearItemId"
              required
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">Select a gear item…</option>
              {availableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.inventoryType})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="componentRole" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Component role
            </label>
            <select
              id="componentRole"
              name="componentRole"
              defaultValue="REQUIRED"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            >
              {COMPONENT_ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRequired"
              name="isRequired"
              value="true"
              defaultChecked
              className="rounded"
            />
            <label htmlFor="isRequired" className="text-sm text-zinc-900 dark:text-zinc-50">
              Required for kit completeness
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="quantity" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Current quantity
              </label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                min={1}
                defaultValue={1}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="quantityExpected" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Expected quantity
              </label>
              <input
                type="number"
                id="quantityExpected"
                name="quantityExpected"
                min={1}
                defaultValue={1}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>
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
              placeholder="Optional notes about this component"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Link
              href={`/gear-ops/kits/${kitId}`}
              className="rounded-md border px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
            >
              Add to kit
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
