import { PageHeader } from "@/components/dashboard/page-header";
import { GearOpsSubnav } from "@/components/gear-ops/subnav";
import { resolveGearOpsAdminAccess } from "@/lib/gear-ops-access";
import {
  GEAR_OPS_ALL_SCOPES,
  getGearOpsSchemaStatus,
} from "@/lib/gear-ops-schema-status";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function GearOpsAdminSchemaDiagnosticsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <PageHeader title="GearOps schema diagnostics" description="Admin-only schema readiness check." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-red-600 dark:text-red-400">
            {scope.errorMessage ?? "Database connection is not available."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="GearOps schema diagnostics" description="Admin-only schema readiness check." />
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
        <PageHeader title="GearOps schema diagnostics" description="Admin-only schema readiness check." />
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{access.denialMessage}</p>
        </div>
      </section>
    );
  }

  const results = await Promise.all(GEAR_OPS_ALL_SCOPES.map((s) => getGearOpsSchemaStatus(s)));

  return (
    <section className="space-y-4">
      <PageHeader
        title="GearOps schema diagnostics"
        description="Schema readiness for each supported scope. Admin only."
      />
      <GearOpsSubnav current="admin" />

      <div className="rounded-lg border bg-white dark:bg-zinc-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50 dark:bg-zinc-800 text-left">
              <th className="px-3 py-2 font-medium">Scope</th>
              <th className="px-3 py-2 font-medium">Connected</th>
              <th className="px-3 py-2 font-medium">Schema ready</th>
              <th className="px-3 py-2 font-medium">Checked tables</th>
              <th className="px-3 py-2 font-medium">Missing tables</th>
              <th className="px-3 py-2 font-medium">Missing columns</th>
              <th className="px-3 py-2 font-medium">Pending actions</th>
              <th className="px-3 py-2 font-medium">Checked at</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.scope} className="border-b last:border-0 align-top">
                <td className="px-3 py-2 font-mono font-medium">{result.scope}</td>
                <td className="px-3 py-2">
                  <StatusChip ok={result.connected} label={result.connected ? "Yes" : "No"} />
                </td>
                <td className="px-3 py-2">
                  <StatusChip ok={result.schemaReady} label={result.schemaReady ? "Yes" : "No"} />
                </td>
                <td className="px-3 py-2">
                  <CodeList items={result.checkedTables} />
                </td>
                <td className="px-3 py-2">
                  {result.missingTables.length === 0 ? (
                    <span className="text-zinc-400">—</span>
                  ) : (
                    <CodeList items={result.missingTables} highlight />
                  )}
                </td>
                <td className="px-3 py-2">
                  {result.missingColumns.length === 0 ? (
                    <span className="text-zinc-400">—</span>
                  ) : (
                    <CodeList items={result.missingColumns} highlight />
                  )}
                </td>
                <td className="px-3 py-2">
                  {result.pendingActions.length === 0 ? (
                    <span className="text-zinc-400">—</span>
                  ) : (
                    <ul className="space-y-1">
                      {result.pendingActions.map((action, i) => (
                        <li key={i} className="text-amber-700 dark:text-amber-400">{action}</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-2 text-zinc-500 whitespace-nowrap">{result.checkedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        JSON endpoint: <code className="font-mono">/api/gear-ops/schema-diagnostics</code>
      </p>
    </section>
  );
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={
        ok
          ? "inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
          : "inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
      }
    >
      {label}
    </span>
  );
}

function CodeList({ items, highlight }: { items: string[]; highlight?: boolean }) {
  if (items.length === 0) {
    return <span className="text-zinc-400">—</span>;
  }
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li
          key={item}
          className={
            highlight
              ? "font-mono text-xs text-red-700 dark:text-red-400"
              : "font-mono text-xs text-zinc-600 dark:text-zinc-400"
          }
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
