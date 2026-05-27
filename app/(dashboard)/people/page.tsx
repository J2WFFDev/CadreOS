import Link from "next/link";
import { MemberLifecycleStatus } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
  resolveStaffScopeResolution,
  type StaffScopeResolution,
} from "@/lib/authorization";
import { db } from "@/lib/db";
import { resolveGuardianRelationshipAccess } from "@/lib/guardian-relationship-access";
import { MEMBER_LIFECYCLE_STATUS_LABELS } from "@/lib/member-ops";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function formatRoleSummary(roleTypes: string[]) {
  if (roleTypes.length === 0) {
    return "No roles assigned";
  }

  return roleTypes
    .map((roleType) => roleType.replaceAll("_", " ").toLowerCase())
    .map((roleType) => roleType.replace(/\b\w/g, (char) => char.toUpperCase()))
    .join(", ");
}

function formatAssignmentSummary(assignments: Array<{
  roleType: string;
  scopeType: string;
  program: { id: string; name: string } | null;
  team: { id: string; name: string; program: { id: string; name: string } | null } | null;
}>) {
  if (assignments.length === 0) {
    return "No roles assigned";
  }

  const summaries = assignments.map((assignment) => {
    const roleLabel = formatRoleSummary([assignment.roleType]);
    const scopeLabel = assignment.scopeType.replaceAll("_", " ").toLowerCase();
    const titledScopeLabel = scopeLabel.replace(/\b\w/g, (char) => char.toUpperCase());

    if (assignment.scopeType === "PROGRAM") {
      return `${roleLabel} (${titledScopeLabel}${assignment.program ? `: ${assignment.program.name}` : ""})`;
    }

    if (assignment.scopeType === "TEAM") {
      if (assignment.team?.program?.name) {
        return `${roleLabel} (${titledScopeLabel}: ${assignment.team.name} · ${assignment.team.program.name})`;
      }

      return `${roleLabel} (${titledScopeLabel}${assignment.team ? `: ${assignment.team.name}` : ""})`;
    }

    return `${roleLabel} (${titledScopeLabel})`;
  });

  return [...new Set(summaries)].join(", ");
}

function formatTeamMembershipSummary(memberships: Array<{
  team: { id: string; name: string; program: { id: string; name: string } };
}>) {
  if (memberships.length === 0) {
    return "No team memberships";
  }

  const summaries = memberships.map((membership) => `${membership.team.program.name} · ${membership.team.name}`);

  return [...new Set(summaries)].join(", ");
}

function matchesScopedTeamOrProgram(
  staffScopeResolution: StaffScopeResolution,
  teamId: string | null,
  programId: string | null,
) {
  if (staffScopeResolution.allowAllStaffScope) {
    return true;
  }

  if (teamId && staffScopeResolution.allowedTeamIds.includes(teamId)) {
    return true;
  }

  if (programId && staffScopeResolution.allowedProgramIds.includes(programId)) {
    return true;
  }

  return false;
}

export default async function PeoplePage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">People</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query people right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">People</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No organization context is available yet.
          </p>
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
    workflow: "people.list.access",
    entityType: "person",
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">People</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view people operational workflows.
          </p>
        </div>
      </section>
    );
  }

  const staffScopeResolution = resolveStaffScopeResolution(actorRoleContext);
  if (
    !staffScopeResolution.allowAllStaffScope &&
    (staffScopeResolution.hasAmbiguousScopeAssignments || !staffScopeResolution.hasExplicitScopedAccess)
  ) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">People</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your role scope is incomplete for safe people visibility evaluation. Contact an organization admin.
          </p>
        </div>
      </section>
    );
  }

  const guardianAccess = await resolveGuardianRelationshipAccess({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });
  const canViewGuardianRelationshipDetails = guardianAccess.canViewGuardianRelationshipDetails;

  let people:
    | Array<{
        id: string;
        firstName: string;
        lastName: string;
        email: string | null;
        lifecycleStatus: MemberLifecycleStatus;
        roles: Array<{
          roleType: string;
          scopeType: string;
          program: { id: string; name: string } | null;
          team: { id: string; name: string; program: { id: string; name: string } | null } | null;
        }>;
        roster: Array<{
          rosterRole: string;
          team: { id: string; name: string; program: { id: string; name: string } };
        }>;
        _count: {
          guardianLinks: number;
          athleteLinks: number;
        };
      }>
    | null = null;

  try {
    people = await db.person.findMany({
      where: {
        organizationId: scope.organizationId,
        ...(staffScopeResolution.allowAllStaffScope
          ? {}
          : {
              OR: [
                ...(staffScopeResolution.allowedTeamIds.length > 0
                  ? [{ roster: { some: { organizationId: scope.organizationId, teamId: { in: staffScopeResolution.allowedTeamIds } } } }]
                  : []),
                ...(staffScopeResolution.allowedTeamIds.length > 0
                  ? [{ roles: { some: { organizationId: scope.organizationId, teamId: { in: staffScopeResolution.allowedTeamIds } } } }]
                  : []),
                ...(staffScopeResolution.allowedProgramIds.length > 0
                  ? [{ roster: { some: { organizationId: scope.organizationId, team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } } } }]
                  : []),
                ...(staffScopeResolution.allowedProgramIds.length > 0
                  ? [{ roles: { some: { organizationId: scope.organizationId, programId: { in: staffScopeResolution.allowedProgramIds } } } }]
                  : []),
                ...(staffScopeResolution.allowedProgramIds.length > 0
                  ? [{ roles: { some: { organizationId: scope.organizationId, team: { is: { programId: { in: staffScopeResolution.allowedProgramIds } } } } } }]
                  : []),
              ],
            }),
      },
      include: {
        roles: {
          select: {
            roleType: true,
            scopeType: true,
            program: {
              select: {
                id: true,
                name: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
                program: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        roster: {
          select: {
            rosterRole: true,
            team: {
              select: {
                id: true,
                name: true,
                program: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            guardianLinks: true,
            athleteLinks: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    people = people.map((person) => ({
      ...person,
      roles: person.roles.filter((assignment) =>
        matchesScopedTeamOrProgram(
          staffScopeResolution,
          assignment.team?.id ?? null,
          assignment.program?.id ?? assignment.team?.program?.id ?? null,
        ),
      ),
      roster: person.roster.filter((membership) =>
        matchesScopedTeamOrProgram(
          staffScopeResolution,
          membership.team.id,
          membership.team.program.id,
        ),
      ),
    }));
  } catch {
    people = null;
  }

  if (!people) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">People</h2>
        <ErrorMessage message="Unable to load people right now. Please try again later." />
      </section>
    );
  }

  const lifecycleCounts = people.reduce(
    (counts, person) => {
      counts[person.lifecycleStatus] = (counts[person.lifecycleStatus] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>,
  );
  const activePeopleWithoutRosterMembership = people.filter(
    (person) => person.lifecycleStatus === "ACTIVE" && person.roster.length === 0,
  ).length;
  const scopedAthletesMissingGuardianLinkage = canViewGuardianRelationshipDetails
    ? people.filter(
        (person) =>
          (person.roles.some((role) => role.roleType === "ATHLETE") ||
            person.roster.some((membership) => membership.rosterRole === "ATHLETE")) &&
          person._count.athleteLinks === 0,
      ).length
    : 0;

  return (
    <section className="space-y-4">
      <PageHeader
        title="People"
        description="Manage athletes, guardians, coaches, and other personnel in your organization."
        actions={
          <Link href="/people/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            New person
          </Link>
        }
      />

      {people.length === 0 ? (
        <EmptyState message="No people have been added yet." actionHref="/people/new" actionLabel="Add the first person" />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-base font-medium">Roster lifecycle readiness</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Status mix in current scope: Active {lifecycleCounts.ACTIVE ?? 0} · Prospect {lifecycleCounts.PROSPECT ?? 0}
              {" "}· Inactive {lifecycleCounts.INACTIVE ?? 0} · Archived {lifecycleCounts.ARCHIVED ?? 0} · Alumni{" "}
              {lifecycleCounts.ALUMNI ?? 0}.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Active members with no roster membership in current scope: {activePeopleWithoutRosterMembership}.
            </p>
            {canViewGuardianRelationshipDetails ? (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Athlete profiles with no guardian relationship in current scope: {scopedAthletesMissingGuardianLinkage}.
              </p>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-4 py-3 font-medium">First name</th>
                  <th className="px-4 py-3 font-medium">Last name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium">Team / Program</th>
                  {canViewGuardianRelationshipDetails ? (
                    <th className="px-4 py-3 font-medium">Guardian links</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {people.map((person) => {
                  return (
                    <tr key={person.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <Link href={`/people/${person.id}`} className="underline">
                          {person.firstName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{person.lastName}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{person.email ?? "—"}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {MEMBER_LIFECYCLE_STATUS_LABELS[person.lifecycleStatus]}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {formatAssignmentSummary(person.roles)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {formatTeamMembershipSummary(person.roster)}
                      </td>
                      {canViewGuardianRelationshipDetails ? (
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          Guardian for {person._count.guardianLinks} athlete{person._count.guardianLinks === 1 ? "" : "s"} ·
                          Athlete linked to {person._count.athleteLinks} guardian{person._count.athleteLinks === 1 ? "" : "s"}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!canViewGuardianRelationshipDetails ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Guardian relationship diagnostics are limited to staff role assignments for youth privacy.
        </p>
      ) : null}
    </section>
  );
}
