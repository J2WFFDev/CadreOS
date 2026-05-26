import Link from "next/link";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { getOrganizationScope } from "@/lib/organization-context";
import { labelForScanContext, resolveInventoryScanReadAccess, SCAN_CONTEXTS } from "@/lib/inventory-scan";
import {
  buildRapidOperationHref,
  findRapidOperationPresetByScanContext,
  INVENTORY_ACTION_PRESETS,
} from "@/lib/rapid-inventory-ops";

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
  const currentPreset = findRapidOperationPresetByScanContext(
    SCAN_CONTEXTS.includes(scanContext as (typeof SCAN_CONTEXTS)[number])
      ? (scanContext as (typeof SCAN_CONTEXTS)[number])
      : null,
  );

  return (
    <section className="space-y-4">
      <PageHeader
        title="Scan inventory"
        description="Fast scan flow for lookup, custody operations, verification, cage/vault, and audit prep."
      />
      <GearOpsSubnav current="scan" />

      {error ? <ErrorMessage message={error} /> : null}
      {info ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
          {info}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[1.2fr,0.8fr]">
        {/* Scan form */}
        <form action="/gear-ops/scan/resolve" method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
          {/* Active mode card */}
          <div className="flex items-start gap-3 rounded-lg border-l-4 border-zinc-800 bg-zinc-50 p-3 dark:border-zinc-200 dark:bg-zinc-950/40">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Active mode</p>
              <h3 className="mt-0.5 text-base font-semibold text-zinc-900 dark:text-zinc-50">{currentPreset.title}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{currentPreset.description}</p>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">{currentPreset.followThroughLabel}</p>
            </div>
          </div>

          {/* Scan input — large for field use */}
          <div className="space-y-1.5">
            <label htmlFor="scanValue" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Scan barcode / QR code
            </label>
            <input
              id="scanValue"
              name="scanValue"
              defaultValue={scanValue}
              autoFocus
              autoComplete="off"
              inputMode="text"
              className="w-full rounded-md border-2 border-zinc-300 px-4 py-3 text-lg font-mono focus:border-zinc-800 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800 dark:focus:border-zinc-200"
              placeholder="Scan or type code here"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="scanContext" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Scan context
            </label>
            <select
              id="scanContext"
              name="scanContext"
              defaultValue={scanContext || currentPreset.scanContext}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:border-zinc-700"
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
            className="w-full rounded-md bg-zinc-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {currentPreset.primaryActionLabel}
          </button>
        </form>

        {/* Mode presets panel */}
        <div className="space-y-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Rapid operation presets</h3>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Pick a mode once, then keep scanning with the same follow-through.
            </p>
          </div>
          <div className="grid gap-2">
            {INVENTORY_ACTION_PRESETS.map((preset) => {
              const isActive = preset.scanContext === currentPreset.scanContext;
              return (
                <Link
                  key={preset.key}
                  href={buildRapidOperationHref(preset.scanContext, scanValue || undefined)}
                  className={`rounded-lg border p-3 text-sm transition ${
                    isActive
                      ? "border-zinc-900 bg-zinc-100 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-50"
                      : "border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                  }`}
                >
                  <p className="font-medium">{preset.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{preset.description}</p>
                </Link>
              );
            })}
          </div>

          {/* Quick context chips */}
          <div className="border-t pt-3 dark:border-zinc-800">
            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">All contexts</p>
            <div className="flex flex-wrap gap-1.5">
              {SCAN_CONTEXTS.map((context) => (
                <Link
                  key={context}
                  href={buildRapidOperationHref(context)}
                  className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  {labelForScanContext(context)}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Usage hints */}
      <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
        <div className="grid gap-2 sm:grid-cols-2">
          <p>Check-in reuses the active checkout record so return verification stays low-friction.</p>
          <p>Vault, audit, and readiness presets keep operators in the same scan-first flow without extra navigation.</p>
        </div>
      </div>
    </section>
  );
}
