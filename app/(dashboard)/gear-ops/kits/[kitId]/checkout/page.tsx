import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import { resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function KitCheckoutPage({
  params,
}: {
  params: Promise<{ kitId: string }>;
}) {
  const { kitId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Check out kit</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const access = await resolveInventoryOpsWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.kits.checkout",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <BackLink href={`/gear-ops/kits/${kitId}`} label="Back to kit" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
      </section>
    );
  }

  let kit: { id: string; name: string; custodyStatus: import("@prisma/client").GearKitCustodyStatus } | null =
    null;
  let people: Array<{ id: string; firstName: string; lastName: string }> = [];
  let errorMessage: string | null = null;

  try {
    const [kitResult, peopleResult] = await Promise.all([
      db.inventoryKit.findFirst({
        where: { id: kitId, organizationId: scope.organizationId },
        select: { id: true, name: true, custodyStatus: true },
      }),
      db.person.findMany({
        where: {
          organizationId: scope.organizationId,
          lifecycleStatus: { in: ["ACTIVE", "PROSPECT"] },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: { id: true, firstName: true, lastName: true },
        take: 200,
      }),
    ]);
    kit = kitResult;
    people = peopleResult;
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      errorMessage = "Database schema is not available yet.";
    } else {
      errorMessage = "Unable to load checkout form. Please try again.";
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

  if (kit.custodyStatus === "CHECKED_OUT") {
    return (
      <section className="space-y-4">
        <BackLink href={`/gear-ops/kits/${kitId}`} label="Back to kit" />
        <div className="rounded-lg border bg-amber-50 p-4 dark:bg-amber-950/20">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            This kit is already checked out. Check it in before checking it out again.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <BackLink href={`/gear-ops/kits/${kitId}`} label="Back to kit" />
      <h2 className="text-xl font-semibold tracking-tight">Check out: {kit.name}</h2>

      <div className="rounded-lg border bg-amber-50 p-4 dark:bg-amber-950/20">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          <strong>Online required:</strong> Kit checkout transfers custody of the parent kit and all child
          items. This action requires a live connection.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <form action={`/gear-ops/kits/${kitId}/checkout-action`} method="POST" className="space-y-5">
          <div className="space-y-1">
            <label htmlFor="custodyPersonId" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Check out to <span className="text-rose-500">*</span>
            </label>
            <select
              id="custodyPersonId"
              name="custodyPersonId"
              required
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="">Select a person…</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.lastName}, {p.firstName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="notes" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={500}
              placeholder="Optional checkout notes"
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
              Check out kit
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
