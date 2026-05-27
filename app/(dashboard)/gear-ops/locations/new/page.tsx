import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { resolveInventoryOpsReadAccess } from "@/lib/inventory-ops";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function NewInventoryLocationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New location</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const access = await resolveInventoryOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-ops.locations.create.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="New location" description="Create an inventory storage location." />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
      </section>
    );
  }

  const name = readSearchParam(resolvedSearchParams, "name");
  const locationCode = readSearchParam(resolvedSearchParams, "locationCode");
  const description = readSearchParam(resolvedSearchParams, "description");
  const generalError = readSearchParam(resolvedSearchParams, "error");
  const nameError = readSearchParam(resolvedSearchParams, "nameError");
  const locationCodeError = readSearchParam(resolvedSearchParams, "locationCodeError");
  const descriptionError = readSearchParam(resolvedSearchParams, "descriptionError");

  return (
    <section className="space-y-4">
      <BackLink href="/gear-ops/locations" label="Back to locations" />
      <PageHeader title="New location" description="Create a storage location, vault, equipment cage, or team storage area." />
      <GearOpsSubnav current="locations" />
      {generalError ? <ErrorMessage message={generalError} /> : null}

      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <form action="/gear-ops/locations/create" method="POST" className="space-y-5">
          <div className="space-y-1">
            <label htmlFor="name" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Location name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              defaultValue={name}
              maxLength={120}
              placeholder="e.g., Main Vault, Range Cage, Team Storage Room A"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
            {nameError ? <p className="text-sm text-red-600">{nameError}</p> : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="locationCode" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Location code
            </label>
            <input
              type="text"
              id="locationCode"
              name="locationCode"
              defaultValue={locationCode}
              maxLength={20}
              placeholder="e.g., VAULT-01, CAGE-A, SHELF-B2"
              className="w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <p className="text-xs text-zinc-500">Optional short code for field use and future barcode/QR integration.</p>
            {locationCodeError ? <p className="text-sm text-red-600">{locationCodeError}</p> : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="description" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={description}
              rows={3}
              maxLength={500}
              placeholder="Optional: describe what is stored here, access requirements, etc."
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
            {descriptionError ? <p className="text-sm text-red-600">{descriptionError}</p> : null}
          </div>

          <div className="flex justify-end gap-3">
            <Link href="/gear-ops/locations" className="rounded-md border px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800">
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
            >
              Create location
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
