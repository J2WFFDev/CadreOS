import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import { formatDateTimeInputValue } from "@/lib/workflows";
import { resolveInventoryOpsWriteAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function ReserveKitPage({
  params,
}: {
  params: Promise<{ kitId: string }>;
}) {
  const { kitId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Reserve kit</h2>
        <ErrorMessage message="No organization context is available yet." />
      </section>
    );
  }

  const access = await resolveInventoryOpsWriteAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.kits.reserve",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <BackLink href={`/gear-ops/kits/${kitId}`} label="Back to kit" />
        <ErrorMessage message={access.denialMessage ?? "Access denied."} />
      </section>
    );
  }

  const [kit, people] = await Promise.all([
    db.inventoryKit.findFirst({
      where: { id: kitId, organizationId: scope.organizationId },
      select: {
        id: true,
        name: true,
        items: {
          where: { removedAt: null },
          select: {
            id: true,
            gearItem: {
              select: {
                id: true,
                name: true,
                lifecycleStatus: true,
                checkouts: { where: { status: { in: ["OPEN", "OVERDUE"] } }, select: { id: true }, take: 1 },
                reservations: {
                  where: { status: { in: ["ACTIVE", "PENDING_REVIEW", "CONFLICT"] } },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    }),
    db.person.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
      take: 300,
    }),
  ]);

  if (!kit) {
    return (
      <section className="space-y-4">
        <BackLink href="/gear-ops/kits" label="Back to kits" />
        <ErrorMessage message="Kit not found." />
      </section>
    );
  }

  const memberCount = kit.items.length;
  const blockedCount = kit.items.filter(
    (entry) => entry.gearItem.checkouts.length > 0 || entry.gearItem.reservations.length > 0,
  ).length;
  const defaultStart = new Date();
  const defaultEnd = new Date(defaultStart.getTime() + 1000 * 60 * 60 * 24);

  return (
    <section className="space-y-4">
      <BackLink href={`/gear-ops/kits/${kit.id}`} label="Back to kit" />
      <h2 className="text-xl font-semibold tracking-tight">Reserve static kit</h2>

      <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
        <p className="font-medium">{kit.name}</p>
        <p className="text-zinc-500">
          Members: {memberCount} · Currently blocked members: {blockedCount}
        </p>
      </div>

      <form action={`/gear-ops/kits/${kit.id}/reserve/create`} method="POST" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-1">
          <label htmlFor="reservedForPersonId" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Reserve for person
          </label>
          <select id="reservedForPersonId" name="reservedForPersonId" required className="w-full rounded-md border px-3 py-2 text-sm dark:bg-zinc-800 dark:text-zinc-50">
            <option value="">Select person</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.firstName} {person.lastName}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="windowStartAt" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Start
            </label>
            <input id="windowStartAt" name="windowStartAt" type="datetime-local" required defaultValue={formatDateTimeInputValue(defaultStart)} className="w-full rounded-md border px-3 py-2 text-sm dark:bg-zinc-800 dark:text-zinc-50" />
          </div>
          <div className="space-y-1">
            <label htmlFor="windowEndAt" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              End
            </label>
            <input id="windowEndAt" name="windowEndAt" type="datetime-local" required defaultValue={formatDateTimeInputValue(defaultEnd)} className="w-full rounded-md border px-3 py-2 text-sm dark:bg-zinc-800 dark:text-zinc-50" />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="notes" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Notes
          </label>
          <textarea id="notes" name="notes" rows={3} maxLength={1000} className="w-full rounded-md border px-3 py-2 text-sm dark:bg-zinc-800 dark:text-zinc-50" />
        </div>

        <div className="flex justify-end gap-3">
          <Link href={`/gear-ops/kits/${kit.id}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Cancel
          </Link>
          <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            Reserve kit
          </button>
        </div>
      </form>
    </section>
  );
}
