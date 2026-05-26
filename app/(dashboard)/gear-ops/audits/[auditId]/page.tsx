import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import {
  getInventoryAudit,
  labelForInventoryAuditScope,
  labelForInventoryAuditSessionStatus,
  labelForInventoryAuditType,
  resolveInventoryAuditReadAccess,
} from "@/lib/inventory-audit";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function InventoryAuditDetailsPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory audit</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load inventory audit details right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory audit</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveInventoryAuditReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-audit.detail.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory audit</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let audit: Awaited<ReturnType<typeof getInventoryAudit>> | null = null;
  let queryErrorMessage = "Unable to load inventory audit details right now. Please try again later.";

  try {
    audit = await getInventoryAudit({ organizationId: scope.organizationId, auditId });
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading audit details.";
    }
  }

  if (!audit) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory audit</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <BackLink href="/gear-ops/audits" label="Back to audits" />
      <GearOpsSubnav current="audits" />

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">{audit.name}</h2>
            {audit.description ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{audit.description}</p> : null}
            <p className="text-xs text-zinc-500">
              {labelForInventoryAuditType(audit.auditType)} · Scope: {labelForInventoryAuditScope(audit.scope)}
            </p>
            <p className="text-xs text-zinc-500">
              Created by {audit.createdBy.firstName} {audit.createdBy.lastName} · {audit.createdAt.toLocaleString()}
            </p>
          </div>
          <form action={`/gear-ops/audits/${audit.id}/sessions/start`} method="POST" className="space-y-2 rounded-md border p-3 text-sm">
            <label htmlFor="title" className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Start session title
            </label>
            <input
              id="title"
              name="title"
              required
              maxLength={120}
              defaultValue={`${audit.name} · ${new Date().toLocaleDateString()}`}
              className="w-72 rounded-md border px-2 py-1.5 text-sm dark:bg-zinc-800"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
            >
              Start session
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900 sm:grid-cols-3">
        <div>
          <p className="text-zinc-500">Cadence days</p>
          <p className="font-medium">{audit.cadenceDays ?? "—"}</p>
        </div>
        <div>
          <p className="text-zinc-500">Next scheduled</p>
          <p className="font-medium">{audit.nextScheduledAt ? audit.nextScheduledAt.toLocaleString() : "—"}</p>
        </div>
        <div>
          <p className="text-zinc-500">Last executed</p>
          <p className="font-medium">{audit.lastExecutedAt ? audit.lastExecutedAt.toLocaleString() : "—"}</p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">Recent sessions</h3>
        {audit.sessions.length === 0 ? (
          <EmptyState message="No sessions have been run for this audit yet." />
        ) : (
          <div className="space-y-2">
            {audit.sessions.map((session) => (
              <article key={session.id} className="rounded-lg border bg-white p-3 text-sm dark:bg-zinc-900">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">
                    <Link href={`/gear-ops/audits/sessions/${session.id}`} className="underline">
                      {session.title}
                    </Link>
                  </p>
                  <p className="text-xs text-zinc-500">{labelForInventoryAuditSessionStatus(session.status)}</p>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Results: {session._count.results} · Discrepancies: {session._count.discrepancies}
                  {session.startedAt ? ` · Started ${session.startedAt.toLocaleString()}` : ""}
                  {session.completedAt ? ` · Completed ${session.completedAt.toLocaleString()}` : ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
