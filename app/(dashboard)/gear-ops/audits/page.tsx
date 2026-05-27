import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSchemaWarning } from "@/components/gear-ops/schema-warning";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { getGearOpsSchemaStatus } from "@/lib/gear-ops-schema-status";
import {
  labelForInventoryAuditScope,
  labelForInventoryAuditSessionStatus,
  labelForInventoryAuditType,
  listInventoryAudits,
  resolveInventoryAuditReadAccess,
} from "@/lib/inventory-audit";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function InventoryAuditsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory audits</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load inventory audits right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory audits</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveInventoryAuditReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-audit.list.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <PageHeader title="Inventory audits" description="Operational verification and reconciliation sessions." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  const schemaStatus = await getGearOpsSchemaStatus("audits");
  if (!schemaStatus.schemaReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="Inventory audits" description="Operational verification and reconciliation sessions." />
        <GearOpsSubnav current="audits" />
        <GearOpsSchemaWarning
          actionMessage="Run database setup before loading inventory audits."
          status={schemaStatus}
          organizationId={scope.organizationId}
          actorPersonId={scope.auth.personId}
        />
      </section>
    );
  }

  let audits: Awaited<ReturnType<typeof listInventoryAudits>> | null = null;
  let queryErrorMessage = "Unable to load inventory audits right now. Please try again later.";

  try {
    audits = await listInventoryAudits({ organizationId: scope.organizationId });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading inventory audits.";
    }
  }

  if (!audits) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory audits</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Inventory audits"
        description="Scheduled and ad-hoc operational inventory verification, reconciliation, and readiness validation."
      />
      <GearOpsSubnav current="audits" />

      <div className="flex justify-end">
        <Link
          href="/gear-ops/audits/new"
          className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
        >
          New audit
        </Link>
      </div>

      {audits.length === 0 ? (
        <EmptyState
          message="No inventory audits exist yet. Create an audit to start discrepancy-traceable verification."
          actionHref="/gear-ops/audits/new"
          actionLabel="New audit"
        />
      ) : (
        <div className="space-y-3">
          {audits.map((audit) => (
            <article key={audit.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-medium">
                    <Link href={`/gear-ops/audits/${audit.id}`} className="underline">
                      {audit.name}
                    </Link>
                  </h3>
                  {audit.description ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{audit.description}</p> : null}
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    {labelForInventoryAuditType(audit.auditType)} · Scope: {labelForInventoryAuditScope(audit.scope)}
                    {" · "}Sessions: {audit.totalSessions}
                  </p>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  {audit.nextScheduledAt ? <p>Next scheduled: {audit.nextScheduledAt.toLocaleString()}</p> : null}
                  {audit.latestSession ? (
                    <p>
                      Last session: {labelForInventoryAuditSessionStatus(audit.latestSession.status)}
                      {audit.latestSession.startedAt ? ` · ${audit.latestSession.startedAt.toLocaleString()}` : ""}
                    </p>
                  ) : (
                    <p>No sessions yet</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
