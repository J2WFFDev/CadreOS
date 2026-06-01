import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import { resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function ValidateKitReturnPage({
  params,
}: {
  params: Promise<{ kitId: string }>;
}) {
  const { kitId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Validate kit return</h2>
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  const access = await resolveInventoryOpsWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.kits.checkin",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <BackLink href={`/gear-ops/kits/${kitId}`} label="Back to kit" />
        <ErrorMessage message={access.denialMessage ?? "Access denied."} />
      </section>
    );
  }

  const kit = await db.inventoryKit.findFirst({
    where: { id: kitId, organizationId: scope.organizationId },
    select: {
      id: true,
      name: true,
      items: {
        where: { removedAt: null },
        select: {
          id: true,
          gearItem: { select: { id: true, name: true } },
        },
        orderBy: [{ addedAt: "asc" }],
      },
    },
  });

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
      <BackLink href={`/gear-ops/kits/${kit.id}`} label="Back to kit" />
      <h2 className="text-xl font-semibold tracking-tight">Return validation · {kit.name}</h2>

      <form action={`/gear-ops/kits/${kit.id}/checkin`} method="POST" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Validate expected contents before completing return. Mark issues for missing, damaged, and maintenance-needed items.
        </p>

        <div className="space-y-3">
          {kit.items.map((kitItem) => (
            <article key={kitItem.id} className="rounded border p-3 text-sm">
              <input type="hidden" name="expectedGearItemId" value={kitItem.gearItem.id} />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">{kitItem.gearItem.name}</p>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input type="checkbox" name="returnedGearItemId" value={kitItem.gearItem.id} defaultChecked />
                  Returned
                </label>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-600 dark:text-zinc-300">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" name="damagedGearItemId" value={kitItem.gearItem.id} />
                  Damaged item
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" name="maintenanceGearItemId" value={kitItem.gearItem.id} />
                  Needs maintenance
                </label>
              </div>
            </article>
          ))}
        </div>

        <div className="space-y-1">
          <label htmlFor="notes" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Return notes
          </label>
          <textarea id="notes" name="notes" rows={3} maxLength={1000} className="w-full rounded-md border px-3 py-2 text-sm dark:bg-zinc-800 dark:text-zinc-50" />
        </div>

        <div className="flex justify-end gap-3">
          <Link href={`/gear-ops/kits/${kit.id}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Cancel
          </Link>
          <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            Complete return
          </button>
        </div>
      </form>
    </section>
  );
}
