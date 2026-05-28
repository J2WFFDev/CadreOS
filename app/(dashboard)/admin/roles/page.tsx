import { RoleType, ScopeType } from "@prisma/client";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { assertOrganizationAdminAccess, resolveActorRoleContext } from "@/lib/authorization";
import { AuthorizationDeniedError } from "@/lib/authorization";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function formatRoleType(role: RoleType): string {
  const labels: Record<RoleType, string> = {
    ORGANIZATION_ADMIN: "Organization Admin",
    PROGRAM_DIRECTOR: "Program Director",
    COACH: "Coach",
    ASSISTANT_COACH: "Assistant Coach",
    PARENT_GUARDIAN: "Parent / Guardian",
    ATHLETE: "Athlete",
  };
  return labels[role] ?? role;
}

function formatScopeType(scope: ScopeType): string {
  const labels: Record<ScopeType, string> = {
    ORGANIZATION: "Organization",
    PROGRAM: "Program",
    TEAM: "Team",
  };
  return labels[scope] ?? scope;
}

export default async function AdminRolesPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Roles & Permissions" description="Manage staff role assignments." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load roles right now."} />
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
          <PageHeader title="Roles & Permissions" description="Manage staff role assignments." />
          <ErrorMessage message={error.message} />
        </section>
      );
    }
    throw error;
  }

  // TODO: Add pagination when role assignment counts grow large.
  const ROLE_ASSIGNMENT_LIMIT = 500;
  const roleAssignments = await db.roleAssignment.findMany({
    where: { organizationId: scope.organizationId },
    orderBy: [{ roleType: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      roleType: true,
      scopeType: true,
      createdAt: true,
      person: { select: { id: true, firstName: true, lastName: true } },
      program: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
    },
    take: ROLE_ASSIGNMENT_LIMIT,
  });

  return (
    <section className="space-y-4">
        <PageHeader
          title="Roles & Permissions"
          description={`Staff role assignments for this organization.${roleAssignments.length === ROLE_ASSIGNMENT_LIMIT ? ` Showing first ${ROLE_ASSIGNMENT_LIMIT} records.` : ""}`}
        />

      {roleAssignments.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No role assignments found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Scoped to</th>
                <th className="px-4 py-3 font-medium">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {roleAssignments.map((assignment) => {
                const scopeTarget =
                  assignment.scopeType === ScopeType.PROGRAM
                    ? (assignment.program?.name ?? "—")
                    : assignment.scopeType === ScopeType.TEAM
                      ? (assignment.team?.name ?? "—")
                      : "—";

                return (
                  <tr key={assignment.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      {assignment.person.firstName} {assignment.person.lastName}
                    </td>
                    <td className="px-4 py-3">{formatRoleType(assignment.roleType)}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {formatScopeType(assignment.scopeType)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{scopeTarget}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {assignment.createdAt.toISOString().slice(0, 10)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
