
import { GearCustodyMode, GearReportGroup } from "@prisma/client";
import Link from "next/link";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { db } from "@/lib/db";
import { formatGearCustodyMode, formatGearReportGroup } from "@/lib/gear-category-config";
import { resolveGearOpsAdminAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string) {
  const value = searchParams[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export default async function GearOpsAdminPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps admin</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load GearOps admin settings right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps admin</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsAdminAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="GearOps admin" description="Organization-level GearOps controls." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let settings:
    | {
        defaultCustodyMode: GearCustodyMode;
        enableGuardianApproval: boolean;
        enableConsumableTracking: boolean;
        enableEventDeployment: boolean;
        enableReadinessTracking: boolean;
        enableMaintenanceTracking: boolean;
        defaultReportGroup: GearReportGroup;
        adminNotes: string | null;
      }
    | null = null;
  let templateCount: number | null = 0;
  let queryErrorMessage = "Unable to load GearOps admin settings right now. Please try again later.";

  try {
    [settings, templateCount] = await Promise.all([
      db.gearOpsOrganizationSettings.findUnique({
        where: { organizationId: scope.organizationId },
        select: {
          defaultCustodyMode: true,
          enableGuardianApproval: true,
          enableConsumableTracking: true,
          enableEventDeployment: true,
          enableReadinessTracking: true,
          enableMaintenanceTracking: true,
          defaultReportGroup: true,
          adminNotes: true,
        },
      }),
      db.eventGearRequirementTemplate.count({
        where: { organizationId: scope.organizationId },
      }),
    ]);
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading GearOps admin settings.";
    }
  }

  if (templateCount === null) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps admin</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  const effectiveSettings = settings ?? {
    defaultCustodyMode: GearCustodyMode.FREE_CHECKOUT,
    enableGuardianApproval: false,
    enableConsumableTracking: true,
    enableEventDeployment: true,
    enableReadinessTracking: true,
    enableMaintenanceTracking: true,
    defaultReportGroup: GearReportGroup.GENERAL,
    adminNotes: null,
  };

  return (
    <section className="space-y-4">
      <PageHeader title="GearOps admin" description="Organization-level GearOps configuration and starter template controls." />
      <GearOpsSubnav current="admin" />
      {readSearchParam(resolvedSearchParams, "error") ? <ErrorMessage message={readSearchParam(resolvedSearchParams, "error")} /> : null}
      {readSearchParam(resolvedSearchParams, "saved") ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          GearOps admin settings saved.
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-medium">Event gear requirement templates</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{templateCount} template{templateCount === 1 ? "" : "s"} configured for this organization.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/gear-ops/event-templates" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">View templates</Link>
            <Link href="/gear-ops/event-templates/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">New template</Link>
          </div>
        </div>
      </div>

      <form action="/gear-ops/admin/settings/update" method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div>
          <h3 className="text-lg font-medium">Organization settings</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Default capability toggles and baseline custody/reporting settings.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="defaultCustodyMode" className="text-sm font-medium">Default custody mode</label>
            <select id="defaultCustodyMode" name="defaultCustodyMode" defaultValue={effectiveSettings.defaultCustodyMode} className="w-full rounded-md border px-3 py-2 text-sm">
              {Object.values(GearCustodyMode).map((mode) => (
                <option key={mode} value={mode}>{formatGearCustodyMode(mode)}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="defaultReportGroup" className="text-sm font-medium">Default report group</label>
            <select id="defaultReportGroup" name="defaultReportGroup" defaultValue={effectiveSettings.defaultReportGroup} className="w-full rounded-md border px-3 py-2 text-sm">
              {Object.values(GearReportGroup).map((group) => (
                <option key={group} value={group}>{formatGearReportGroup(group)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {([
            ["enableGuardianApproval", "Enable guardian approval", effectiveSettings.enableGuardianApproval],
            ["enableConsumableTracking", "Enable consumable tracking", effectiveSettings.enableConsumableTracking],
            ["enableEventDeployment", "Enable event deployment", effectiveSettings.enableEventDeployment],
            ["enableReadinessTracking", "Enable readiness tracking", effectiveSettings.enableReadinessTracking],
            ["enableMaintenanceTracking", "Enable maintenance tracking", effectiveSettings.enableMaintenanceTracking],
          ] as const).map(([name, label, checked]) => (
            <label key={name} className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <input type="hidden" name={name} value="false" />
              <input type="checkbox" name={name} value="true" defaultChecked={checked} />
              {label}
            </label>
          ))}
        </div>
        <div className="space-y-1">
          <label htmlFor="adminNotes" className="text-sm font-medium">Admin notes (optional)</label>
          <textarea id="adminNotes" name="adminNotes" defaultValue={effectiveSettings.adminNotes ?? ""} rows={5} className="w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="rounded-md bg-black px-3 py-2 text-sm text-white dark:bg-white dark:text-black">Save settings</button>
        </div>
      </form>
    </section>
  );
}
