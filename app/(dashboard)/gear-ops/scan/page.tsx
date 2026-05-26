import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOfflineScanForm } from "@/components/gear-ops/scan-offline-form";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { getOrganizationScope } from "@/lib/organization-context";
import { resolveInventoryScanReadAccess, SCAN_CONTEXTS } from "@/lib/inventory-scan";
import { findRapidOperationPresetByScanContext } from "@/lib/rapid-inventory-ops";

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

      <GearOfflineScanForm
        organizationId={scope.organizationId}
        defaultScanValue={scanValue}
        defaultScanContext={SCAN_CONTEXTS.includes(scanContext as (typeof SCAN_CONTEXTS)[number]) ? (scanContext as (typeof SCAN_CONTEXTS)[number]) : currentPreset.scanContext}
      />

      {/* Usage hints */}
      <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/30 dark:text-zinc-400">
        <div className="grid gap-2 sm:grid-cols-2">
          <p>Check-in reuses the active checkout record so return verification stays low-friction.</p>
          <p>Vault, audit, and readiness presets keep operators in the same scan-first flow without extra navigation, even when weak connectivity forces a local draft.</p>
        </div>
      </div>
    </section>
  );
}
