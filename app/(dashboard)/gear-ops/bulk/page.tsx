import Link from "next/link";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearBulkOperationsPanel } from "@/components/gear-ops/bulk-operations-panel";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { resolveGearOpsReadAccess } from "@/lib/gear-ops-access";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

const EXPORT_LINKS = [
  { key: "inventory", label: "Inventory export" },
  { key: "custody", label: "Custody summary export" },
  { key: "location", label: "Location summary export" },
  { key: "readiness", label: "Readiness summary export" },
  { key: "event_plan", label: "Event gear plan export" },
  { key: "audit_summary", label: "Audit summary export" },
] as const;

export default async function GearOpsBulkPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps bulk operations</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load GearOps bulk operations right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">GearOps bulk operations</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveGearOpsReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "gear-ops.bulk.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="GearOps bulk operations" description="CSV import/export and label-sheet operations." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="GearOps bulk operations"
        description="Bounded import/export workflows for pilot setup, audit support, and field label operations."
      />
      <GearOpsSubnav current="bulk" />

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="space-y-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold tracking-tight">Import template & exports</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/gear-ops/bulk/template" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Download import template
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXPORT_LINKS.map((link) => (
              <Link
                key={link.key}
                href={`/gear-ops/bulk/export?dataset=${link.key}`}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </article>

        <article className="space-y-3 rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold tracking-tight">Label sheets</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Generate printable label sheets for category, location, or event-grouped inventory rows.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/gear-ops/bulk/labels" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Open label sheet builder
            </Link>
            <Link href="/gear-ops/labels" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              Single label preview
            </Link>
          </div>
        </article>
      </div>

      <GearBulkOperationsPanel />
    </section>
  );
}
