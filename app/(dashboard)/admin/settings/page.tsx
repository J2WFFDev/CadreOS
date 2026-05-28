import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { assertOrganizationAdminAccess, resolveActorRoleContext } from "@/lib/authorization";
import { AuthorizationDeniedError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Settings" description="Organization-level configuration." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load settings right now."} />
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
          <PageHeader title="Settings" description="Organization-level configuration." />
          <ErrorMessage message={error.message} />
        </section>
      );
    }
    throw error;
  }

  const organization = await db.organization.findUnique({
    where: { id: scope.organizationId },
    select: { id: true, name: true, status: true, createdAt: true },
  });

  if (!organization) {
    return (
      <section className="space-y-4">
        <PageHeader title="Settings" description="Organization-level configuration." />
        <ErrorMessage message="Organization not found." />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader title="Settings" description="Organization-level configuration." />

      <div className="rounded-lg border bg-white dark:bg-zinc-900">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Organization</h3>
        </div>
        <dl className="divide-y text-sm">
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Name</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{organization.name}</dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Status</dt>
            <dd className="text-zinc-900 dark:text-zinc-50">{organization.status}</dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Organization ID</dt>
            <dd className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{organization.id}</dd>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <dt className="font-medium text-zinc-600 dark:text-zinc-400">Created</dt>
            <dd className="text-zinc-500 dark:text-zinc-400">
              {organization.createdAt.toISOString().slice(0, 10)}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
