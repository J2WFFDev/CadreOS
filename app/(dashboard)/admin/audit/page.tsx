import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { assertOrganizationAdminAccess, resolveActorRoleContext } from "@/lib/authorization";
import { AuthorizationDeniedError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Audit / History" description="Organization activity log." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load audit log right now."} />
      </section>
    );
  }

  const actorContext = await resolveActorRoleContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  try {
    assertOrganizationAdminAccess(actorContext);
  } catch (error) {
    if (error instanceof AuthorizationDeniedError) {
      return (
        <section className="space-y-4">
          <PageHeader title="Audit / History" description="Organization activity log." />
          <ErrorMessage message={error.message} />
        </section>
      );
    }
    throw error;
  }

  // TODO: Add pagination when audit log grows large.
  const AUDIT_EVENT_LIMIT = 200;
  const auditEvents = await db.auditEvent.findMany({
    where: { organizationId: scope.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      actor: { select: { id: true, firstName: true, lastName: true } },
    },
    take: AUDIT_EVENT_LIMIT,
  });

  return (
    <section className="space-y-4">
      <PageHeader
        title="Audit / History"
        description={`Recent organization activity.${auditEvents.length === AUDIT_EVENT_LIMIT ? ` Showing most recent ${AUDIT_EVENT_LIMIT} events.` : ""}`}
      />

      {auditEvents.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No audit events recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity type</th>
                <th className="px-4 py-3 font-medium">Entity ID</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((event) => (
                <tr key={event.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {event.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
                  </td>
                  <td className="px-4 py-3">
                    {event.actor
                      ? `${event.actor.firstName} ${event.actor.lastName}`.trim()
                      : <span className="text-zinc-400 dark:text-zinc-500">System</span>}
                  </td>
                  <td className="px-4 py-3">{event.action}</td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{event.entityType}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400 dark:text-zinc-500">
                    {event.entityId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
