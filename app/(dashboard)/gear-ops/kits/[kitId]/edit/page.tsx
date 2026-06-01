import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import { resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

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

export default async function EditInventoryKitPage({
  params,
}: {
  params: Promise<{ kitId: string }>;
}) {
  const { kitId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit kit</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const access = await resolveInventoryOpsWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.kits.edit",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <BackLink href={`/gear-ops/kits/${kitId}`} label="Back to kit" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
      </section>
    );
  }

  let kit: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    notes: string | null;
    kitType: import("@prisma/client").GearKitType;
    isActive: boolean;
  } | null = null;
  let errorMessage: string | null = null;

  try {
    kit = await db.inventoryKit.findFirst({
      where: { id: kitId, organizationId: scope.organizationId },
      select: { id: true, name: true, description: true, category: true, notes: true, kitType: true, isActive: true },
    });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      errorMessage = "Database schema is not available yet.";
    } else {
      errorMessage = "Unable to load kit. Please try again.";
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
      <h2 className="text-xl font-semibold tracking-tight">Edit kit</h2>

      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <form action={`/gear-ops/kits/${kitId}/update`} method="POST" className="space-y-5">
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
              defaultValue={kit.name}
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
              defaultValue={kit.kitType}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            >
              {KIT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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
              defaultValue={kit.description ?? ""}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="category" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Category
            </label>
            <input
              id="category"
              name="category"
              maxLength={80}
              defaultValue={kit.category ?? ""}
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
              defaultValue={kit.notes ?? ""}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              value="true"
              defaultChecked={kit.isActive}
              className="rounded"
            />
            <label htmlFor="isActive" className="text-sm text-zinc-900 dark:text-zinc-50">
              Active
            </label>
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
              Save changes
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
