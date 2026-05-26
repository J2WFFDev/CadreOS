import { InventoryAuditScope, InventoryAuditType } from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import {
  labelForInventoryAuditScope,
  labelForInventoryAuditType,
  resolveInventoryAuditReadAccess,
} from "@/lib/inventory-audit";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function NewInventoryAuditPage() {
  const scope = await getOrganizationScope();

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New inventory audit</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
      </section>
    );
  }

  const access = await resolveInventoryAuditReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-audit.create.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="New inventory audit" description="Create an operational inventory audit workflow." />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <BackLink href="/gear-ops/audits" label="Back to audits" />
      <PageHeader
        title="New inventory audit"
        description="Define a reusable audit workflow for verification, reconciliation, and discrepancy traceability."
      />
      <GearOpsSubnav current="audits" />

      <div className="rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <form action="/gear-ops/audits/create" method="POST" className="space-y-5">
          <div className="space-y-1">
            <label htmlFor="name" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Audit name <span className="text-rose-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={120}
              placeholder="e.g., Weekly Vault Firearm Audit"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="auditType" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Audit type
            </label>
            <select
              id="auditType"
              name="auditType"
              defaultValue={InventoryAuditType.SCHEDULED}
              className="w-full rounded-md border px-3 py-2 text-sm dark:bg-zinc-800 dark:text-zinc-50"
            >
              {Object.values(InventoryAuditType).map((auditType) => (
                <option key={auditType} value={auditType}>
                  {labelForInventoryAuditType(auditType)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="scope" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Scope
            </label>
            <select
              id="scope"
              name="scope"
              defaultValue={InventoryAuditScope.ORGANIZATION}
              className="w-full rounded-md border px-3 py-2 text-sm dark:bg-zinc-800 dark:text-zinc-50"
            >
              {Object.values(InventoryAuditScope).map((scopeValue) => (
                <option key={scopeValue} value={scopeValue}>
                  {labelForInventoryAuditScope(scopeValue)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="scopeReferenceId" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Scope reference ID
            </label>
            <input
              id="scopeReferenceId"
              name="scopeReferenceId"
              type="text"
              maxLength={50}
              placeholder="Optional: location, event, kit, or person ID"
              className="w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="cadenceDays" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Cadence days
              </label>
              <input
                id="cadenceDays"
                name="cadenceDays"
                type="number"
                min={1}
                max={365}
                placeholder="Optional"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="nextScheduledAt" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Next scheduled at
              </label>
              <input
                id="nextScheduledAt"
                name="nextScheduledAt"
                type="datetime-local"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="description" className="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              maxLength={1000}
              placeholder="Operational instructions, readiness checks, and discrepancy expectations."
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:bg-zinc-800 dark:text-zinc-50"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Link
              href="/gear-ops/audits"
              className="rounded-md border px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black"
            >
              Create audit
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
