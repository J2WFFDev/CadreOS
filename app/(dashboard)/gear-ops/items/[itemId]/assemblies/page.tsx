import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { db } from "@/lib/db";
import {
  formatGearAssemblyRelationshipType,
  GEAR_ASSEMBLY_RELATIONSHIP_TYPES,
} from "@/lib/gear-assembly";
import {
  resolveInventoryOpsReadAccess,
  resolveInventoryOpsWriteAccess,
} from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function GearItemAssembliesPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Asset assemblies</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const [readAccess, writeAccess] = await Promise.all([
    resolveInventoryOpsReadAccess({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      workflow: "inventory-ops.assemblies.read",
    }),
    resolveInventoryOpsWriteAccess({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      workflow: "inventory-ops.assemblies.write",
    }),
  ]);

  if (!readAccess.allowed) {
    return (
      <section className="space-y-4">
        <BackLink href={`/gear-ops/items/${itemId}`} label="Back to item" />
        <ErrorMessage message={readAccess.denialMessage ?? "Access denied."} />
      </section>
    );
  }

  const item = await db.gearItem.findFirst({
    where: { id: itemId, organizationId: scope.organizationId },
    select: {
      id: true,
      name: true,
      parentAssemblies: {
        where: { isActive: true },
        select: {
          id: true,
          relationshipType: true,
          notes: true,
          parentGearItem: { select: { id: true, name: true } },
        },
      },
      childAssemblies: {
        where: { isActive: true },
        select: {
          id: true,
          relationshipType: true,
          notes: true,
          childGearItem: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!item) {
    return (
      <section className="space-y-4">
        <BackLink href="/gear-ops/items" label="Back to items" />
        <ErrorMessage message="Item not found." />
      </section>
    );
  }

  const candidateItems = await db.gearItem.findMany({
    where: {
      organizationId: scope.organizationId,
      id: { not: item.id },
    },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true },
    take: 300,
  });

  return (
    <section className="space-y-4">
      <BackLink href={`/gear-ops/items/${item.id}`} label="Back to item" />
      <h2 className="text-xl font-semibold tracking-tight">Assemblies · {item.name}</h2>

      {writeAccess.allowed ? (
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Add child asset</h3>
          <form action={`/gear-ops/items/${item.id}/assemblies/create`} method="POST" className="mt-3 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="childGearItemId" className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Child asset
                </label>
                <select id="childGearItemId" name="childGearItemId" required className="w-full rounded-md border px-3 py-2 text-sm dark:bg-zinc-800 dark:text-zinc-50">
                  <option value="">Select asset</option>
                  {candidateItems.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="relationshipType" className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Relationship type
                </label>
                <select id="relationshipType" name="relationshipType" required className="w-full rounded-md border px-3 py-2 text-sm dark:bg-zinc-800 dark:text-zinc-50">
                  {GEAR_ASSEMBLY_RELATIONSHIP_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {formatGearAssemblyRelationshipType(value)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="notes" className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Notes
              </label>
              <input id="notes" name="notes" maxLength={500} className="w-full rounded-md border px-3 py-2 text-sm dark:bg-zinc-800 dark:text-zinc-50" />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
                Add child
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">{writeAccess.denialMessage}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Parent assets</h3>
          {item.parentAssemblies.length === 0 ? (
            <EmptyState message="This asset has no parent assemblies." />
          ) : (
            <ul className="mt-3 space-y-2">
              {item.parentAssemblies.map((assembly) => (
                <li key={assembly.id} className="rounded border p-2 text-sm">
                  <Link className="underline" href={`/gear-ops/items/${assembly.parentGearItem.id}`}>
                    {assembly.parentGearItem.name}
                  </Link>
                  <p className="text-xs text-zinc-500">{formatGearAssemblyRelationshipType(assembly.relationshipType)}</p>
                  {assembly.notes ? <p className="text-xs text-zinc-500">{assembly.notes}</p> : null}
                  {writeAccess.allowed ? (
                    <form action={`/gear-ops/items/${item.id}/assemblies/${assembly.id}/remove`} method="POST" className="mt-1">
                      <button className="text-xs text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400" type="submit">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Child assets</h3>
          {item.childAssemblies.length === 0 ? (
            <EmptyState message="This asset has no child assemblies." />
          ) : (
            <ul className="mt-3 space-y-2">
              {item.childAssemblies.map((assembly) => (
                <li key={assembly.id} className="rounded border p-2 text-sm">
                  <Link className="underline" href={`/gear-ops/items/${assembly.childGearItem.id}`}>
                    {assembly.childGearItem.name}
                  </Link>
                  <p className="text-xs text-zinc-500">{formatGearAssemblyRelationshipType(assembly.relationshipType)}</p>
                  {assembly.notes ? <p className="text-xs text-zinc-500">{assembly.notes}</p> : null}
                  {writeAccess.allowed ? (
                    <form action={`/gear-ops/items/${item.id}/assemblies/${assembly.id}/remove`} method="POST" className="mt-1">
                      <button className="text-xs text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400" type="submit">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
