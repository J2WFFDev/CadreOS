import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import { resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

const INSPECTION_STATUS_OPTIONS = [
  { value: "PASSED", label: "Passed — kit is complete and all items ready" },
  { value: "PASSED_WITH_NOTES", label: "Passed with notes — minor observations" },
  { value: "INCOMPLETE", label: "Incomplete — missing or unready items found" },
  { value: "FAILED", label: "Failed — kit is not ready for use" },
];

export default async function KitInspectPage({
  params,
}: {
  params: Promise<{ kitId: string }>;
}) {
  const { kitId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Log kit inspection</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const access = await resolveInventoryOpsWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.kits.inspect",
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
    items: Array<{
      id: string;
      isRequired: boolean;
      gearItem: { id: string; name: string };
    }>;
  } | null = null;
  let errorMessage: string | null = null;

  try {
    kit = await db.inventoryKit.findFirst({
      where: { id: kitId, organizationId: scope.organizationId },
      select: {
        id: true,
        name: true,
        items: {
          where: { removedAt: null },
          orderBy: [{ addedAt: "asc" }],
          select: {
            id: true,
            isRequired: true,
            gearItem: { select: { id: true, name: true } },
          },
        },
      },
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
      <h2 className="text-xl font-semibold tracking-tight">Inspect: {kit.name}</h2>

      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <form action={`/gear-ops/kits/${kitId}/inspect-action`} method="POST" className="space-y-5">
          <div className="space-y-1">
            <label htmlFor="status" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Inspection result <span className="text-rose-500">*</span>
            </label>
            <select
              id="status"
              name="status"
              required
              defaultValue=""
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="" disabled>
                Select result…
              </option>
              {INSPECTION_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="notes" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Overall notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={1000}
              placeholder="Optional: describe findings, missing items, or condition issues."
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          {kit.items.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Per-item observations (optional)
              </h3>
              {kit.items.map((kitItem) => (
                <div
                  key={kitItem.id}
                  className="rounded-md border p-3 space-y-2 bg-zinc-50 dark:bg-zinc-800"
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    <span>{kitItem.gearItem.name}</span>
                    {kitItem.isRequired ? (
                      <span className="text-xs text-zinc-500">(required)</span>
                    ) : (
                      <span className="text-xs text-zinc-400">(optional)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`missing_${kitItem.id}`}
                      name="missingItemId"
                      value={kitItem.gearItem.id}
                      className="rounded"
                    />
                    <label
                      htmlFor={`missing_${kitItem.id}`}
                      className="text-xs text-zinc-600 dark:text-zinc-400"
                    >
                      Mark as missing
                    </label>
                  </div>
                  <input
                    type="text"
                    name={`itemNote_${kitItem.id}`}
                    maxLength={200}
                    placeholder="Condition note (optional)"
                    className="w-full rounded-md border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:bg-zinc-700 dark:text-zinc-50"
                  />
                </div>
              ))}
            </div>
          ) : null}

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
              Save inspection
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
