import { InventoryDiscrepancyType, InventoryVerificationStatus } from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import {
  getInventoryAuditSession,
  labelForInventoryDiscrepancyStatus,
  labelForInventoryDiscrepancyType,
  labelForInventoryVerificationStatus,
  resolveInventoryAuditReadAccess,
  summarizeInventoryAuditSession,
} from "@/lib/inventory-audit";
import { getOrganizationScope } from "@/lib/organization-context";
import { isSchemaUnavailableError } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function InventoryAuditSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory audit session</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load inventory audit session right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory audit session</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const access = await resolveInventoryAuditReadAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
    workflow: "inventory-audit.session.access",
  });

  if (!access.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory audit session</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  let session: Awaited<ReturnType<typeof getInventoryAuditSession>> | null = null;
  let summary: Awaited<ReturnType<typeof summarizeInventoryAuditSession>> | null = null;
  let queryErrorMessage = "Unable to load inventory audit session right now. Please try again later.";

  try {
    [session, summary] = await Promise.all([
      getInventoryAuditSession({ organizationId: scope.organizationId, sessionId }),
      summarizeInventoryAuditSession({ organizationId: scope.organizationId, sessionId }),
    ]);
  } catch (error) {
    if (isSchemaUnavailableError(error)) {
      queryErrorMessage = "Database schema is not available yet. Run database setup before loading audit sessions.";
    }
  }

  if (!session || !summary) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Inventory audit session</h2>
        <ErrorMessage message={queryErrorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <BackLink href={session.audit ? `/gear-ops/audits/${session.audit.id}` : "/gear-ops/audits"} label="Back to audit" />
      <GearOpsSubnav current="audits" />

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{session.title}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {session.audit ? (
                <>
                  Audit:{" "}
                  <Link href={`/gear-ops/audits/${session.audit.id}`} className="underline">
                    {session.audit.name}
                  </Link>
                </>
              ) : (
                "Ad-hoc audit session"
              )}
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <p>Status: {session.status}</p>
            {session.startedAt ? <p>Started: {session.startedAt.toLocaleString()}</p> : null}
            {session.completedAt ? <p>Completed: {session.completedAt.toLocaleString()}</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border bg-white p-4 text-sm dark:bg-zinc-900 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-zinc-500">Total results</p>
          <p className="text-xl font-semibold">{session._count.results}</p>
        </div>
        <div>
          <p className="text-zinc-500">Open discrepancies</p>
          <p className="text-xl font-semibold">{summary.discrepancies.OPEN ?? 0}</p>
        </div>
        <div>
          <p className="text-zinc-500">Verified matches</p>
          <p className="text-xl font-semibold">{summary.verification.VERIFIED_MATCH ?? 0}</p>
        </div>
        <div>
          <p className="text-zinc-500">Verification not found</p>
          <p className="text-xl font-semibold">{summary.verification.NOT_FOUND ?? 0}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-medium">Record verification</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Scan-assisted: paste scan value or gear item ID. If scan resolves, verification links to the matched item.
        </p>
        <form action={`/gear-ops/audits/sessions/${session.id}/verify`} method="POST" className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="scanValue" placeholder="Scan value (optional)" className="rounded-md border px-3 py-2 text-sm dark:bg-zinc-800" />
          <input name="gearItemId" placeholder="Gear item ID (optional)" className="rounded-md border px-3 py-2 text-sm font-mono dark:bg-zinc-800" />
          <select
            name="verificationStatus"
            defaultValue={InventoryVerificationStatus.VERIFIED_MATCH}
            className="rounded-md border px-3 py-2 text-sm dark:bg-zinc-800"
          >
            {Object.values(InventoryVerificationStatus).map((status) => (
              <option key={status} value={status}>
                {labelForInventoryVerificationStatus(status)}
              </option>
            ))}
          </select>
          <select name="discrepancyType" defaultValue="" className="rounded-md border px-3 py-2 text-sm dark:bg-zinc-800">
            <option value="">Auto discrepancy type</option>
            {Object.values(InventoryDiscrepancyType).map((type) => (
              <option key={type} value={type}>
                {labelForInventoryDiscrepancyType(type)}
              </option>
            ))}
          </select>
          <textarea
            name="notes"
            rows={3}
            placeholder="Verification notes / discrepancy details"
            className="rounded-md border px-3 py-2 text-sm sm:col-span-2 dark:bg-zinc-800"
          />
          <button
            type="submit"
            className="rounded-md bg-black px-3 py-2 text-sm text-white sm:col-span-2 dark:bg-white dark:text-black"
          >
            Record verification
          </button>
        </form>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">Recent verification activity</h3>
        {session.results.length === 0 ? (
          <EmptyState message="No verification entries recorded yet." />
        ) : (
          <div className="space-y-2">
            {session.results.map((result) => (
              <article key={result.id} className="rounded-lg border bg-white p-3 text-sm dark:bg-zinc-900">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{labelForInventoryVerificationStatus(result.verificationStatus)}</p>
                  <time className="text-xs text-zinc-500">{result.verifiedAt.toLocaleString()}</time>
                </div>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Item:{" "}
                  {result.gearItem ? (
                    <Link href={`/gear-ops/items/${result.gearItem.id}`} className="underline">
                      {result.gearItem.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                  {result.scannedCode ? (
                    <>
                      {" · "}Scan: <span className="font-mono">{result.scannedCode}</span>
                    </>
                  ) : null}
                </p>
                {result.notes ? <p className="mt-1 text-zinc-500">{result.notes}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-medium">Discrepancies</h3>
        {session.discrepancies.length === 0 ? (
          <EmptyState message="No discrepancies recorded yet." />
        ) : (
          <div className="space-y-2">
            {session.discrepancies.map((discrepancy) => (
              <article key={discrepancy.id} className="rounded-lg border bg-white p-3 text-sm dark:bg-zinc-900">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{labelForInventoryDiscrepancyType(discrepancy.discrepancyType)}</p>
                  <p className="text-xs text-zinc-500">{labelForInventoryDiscrepancyStatus(discrepancy.status)}</p>
                </div>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">{discrepancy.summary}</p>
                {discrepancy.details ? <p className="mt-1 text-zinc-500">{discrepancy.details}</p> : null}
                {discrepancy.status === "OPEN" ? (
                  <form
                    action={`/gear-ops/audits/discrepancies/${discrepancy.id}/resolve`}
                    method="POST"
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <input
                      name="resolutionNotes"
                      placeholder="Resolution notes"
                      className="min-w-56 flex-1 rounded-md border px-2 py-1.5 text-xs dark:bg-zinc-800"
                    />
                    <button
                      type="submit"
                      name="resolutionAction"
                      value="RESOLVE"
                      className="rounded-md border px-2 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      Resolve
                    </button>
                    <button
                      type="submit"
                      name="resolutionAction"
                      value="DISMISS"
                      className="rounded-md border px-2 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      Dismiss
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
