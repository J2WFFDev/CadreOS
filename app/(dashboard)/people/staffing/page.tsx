import { StaffingAssignmentStatus, StaffingRoleCategory } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import {
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import {
  ensureStaffingRoleFoundation,
  STAFFING_ASSIGNMENT_STATUS_LABELS,
  STAFFING_ROLE_CATEGORY_LABELS,
} from "@/lib/member-ops-staffing";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function StaffingFoundationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Staffing foundation</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to load staffing settings right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Staffing foundation</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  const actorRoleContext = await resolveActorRoleContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const staffAccessDecision = evaluateStaffOnlyContentAccess(actorRoleContext);
  logAuthorizationDecision(staffAccessDecision, {
    workflow: "people.staffing.access",
    entityType: "staffingRole",
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Staffing foundation</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to manage staffing foundations.
          </p>
        </div>
      </section>
    );
  }

  await ensureStaffingRoleFoundation(scope.organizationId);

  const [staffingRoles, activeAssignments] = await Promise.all([
    db.staffingRole.findMany({
      where: { organizationId: scope.organizationId },
      include: { _count: { select: { assignments: true } } },
      orderBy: [{ isSystemDefined: "desc" }, { category: "asc" }, { name: "asc" }],
    }),
    db.staffingAssignment.findMany({
      where: {
        organizationId: scope.organizationId,
        status: StaffingAssignmentStatus.ACTIVE,
      },
      include: {
        person: { select: { id: true, firstName: true, lastName: true } },
        staffingRole: { select: { name: true, category: true } },
        team: { select: { name: true } },
        program: { select: { name: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 20,
    }),
  ]);

  const success = readSearchParam(resolvedSearchParams, "success");
  const error = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/people" label="Members" />
        <h2 className="text-2xl font-semibold tracking-tight">Staffing and volunteer foundation</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Manage staffing role definitions and keep active staffing visibility centralized for MemberOps.
        </p>
      </div>

      {success ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950/40">
          <p className="text-sm text-green-900 dark:text-green-200">{success}</p>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{error}</p>
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-lg font-medium">Staffing visibility</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Active staff assignments: {activeAssignments.length}
        </p>
        <div className="mt-3 space-y-2 text-sm">
          {activeAssignments.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-400">No active staffing assignments yet.</p>
          ) : (
            activeAssignments.map((assignment) => (
              <div key={assignment.id} className="rounded-md border p-3">
                <p className="font-medium">
                  {assignment.person.firstName} {assignment.person.lastName} · {assignment.staffingRole.name}
                </p>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {STAFFING_ROLE_CATEGORY_LABELS[assignment.staffingRole.category]} · {STAFFING_ASSIGNMENT_STATUS_LABELS[assignment.status]}
                  {assignment.team ? ` · Team: ${assignment.team.name}` : ""}
                  {!assignment.team && assignment.program ? ` · Program: ${assignment.program.name}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <div>
            <h3 className="text-lg font-medium">Staffing role model</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              System-defined staffing, volunteer, coaching, and admin role foundations are pre-seeded and remain editable by assignment.
            </p>
          </div>
          <div className="space-y-2">
            {staffingRoles.map((role) => (
              <div key={role.id} className="rounded-md border p-3">
                <p className="font-medium">{role.name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {STAFFING_ROLE_CATEGORY_LABELS[role.category]} · {role.active ? "Active" : "Inactive"} · Assigned {role._count.assignments} time{role._count.assignments === 1 ? "" : "s"}
                </p>
                {role.requiredQualificationName ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Qualification compatibility: {role.requiredQualificationType}: {role.requiredQualificationName}
                  </p>
                ) : null}
                {role.isSystemDefined ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">System-defined foundation role</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <div>
            <h3 className="text-lg font-medium">Volunteer and staffing role creation</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Create additional organization staffing roles without changing built-in role foundations.
            </p>
          </div>
          <form action="/people/staffing/roles/create" method="post" className="grid gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Role name</span>
              <input name="name" required maxLength={80} className="w-full rounded-md border px-3 py-2" placeholder="Example: Tournament Volunteer" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Category</span>
              <select name="category" defaultValue={StaffingRoleCategory.VOLUNTEER} className="w-full rounded-md border px-3 py-2">
                {Object.values(StaffingRoleCategory).map((category) => (
                  <option key={category} value={category}>
                    {STAFFING_ROLE_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Description</span>
              <textarea name="description" rows={3} className="w-full rounded-md border px-3 py-2" />
            </label>
            <button type="submit" className="w-fit rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
              Create staffing role
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
