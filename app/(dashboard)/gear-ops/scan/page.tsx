import Link from "next/link";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { getOrganizationScope } from "@/lib/organization-context";
import { labelForScanContext, resolveInventoryScanReadAccess, SCAN_CONTEXTS } from "@/lib/inventory-scan";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function GearOpsScanPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Scan inventory</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load scan workflow right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Scan inventory</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveInventoryScanReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.scan.page.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="Scan inventory" description="Barcode/QR assisted inventory operations." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  const scanValue = readSearchParam(resolvedSearchParams, "scanValue");
  const scanContext = readSearchParam(resolvedSearchParams, "scanContext");
  const error = readSearchParam(resolvedSearchParams, "error");
  const info = readSearchParam(resolvedSearchParams, "info");

  return (
    <section className="space-y-4">
      <PageHeader
        title="Scan inventory"
        description="Fast scan flow for lookup, custody operations, verification, cage/vault, and audit prep."
      />
      <GearOpsSubnav current="scan" />

      {error ? <ErrorMessage message={error} /> : null}
      {info ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {info}
        </div>
      ) : null}

      <form action="/gear-ops/scan/resolve" method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-1">
          <label htmlFor="scanValue" className="text-sm font-medium">
            Scan barcode / QR
          </label>
          <input
            id="scanValue"
            name="scanValue"
            defaultValue={scanValue}
            autoFocus
            autoComplete="off"
            inputMode="text"
            className="w-full rounded-md border px-3 py-3 text-base"
            placeholder="Scan or enter code"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="scanContext" className="text-sm font-medium">
            Scan context
          </label>
          <select
            id="scanContext"
            name="scanContext"
            defaultValue={scanContext || "INVENTORY_LOOKUP"}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {SCAN_CONTEXTS.map((context) => (
              <option key={context} value={context}>
                {labelForScanContext(context)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Resolve scan
        </button>
      </form>

      <div className="rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900">
        <p className="font-medium">Rapid contexts</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SCAN_CONTEXTS.map((context) => (
            <Link
              key={context}
              href={`/gear-ops/scan?scanContext=${context}`}
              className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              {labelForScanContext(context)}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
