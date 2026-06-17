import Link from "next/link";
import { MemberLifecycleStatus, ProgramParticipationStatus } from "@prisma/client";

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
import { MEMBER_LIFECYCLE_STATUS_LABELS } from "@/lib/member-ops";
import { mergeExplicitAndDerivedProgramParticipation } from "@/lib/member-ops-program-participation";
import {
  buildMemberLifecycleStatusCounts,
  formatLifecycleStatusSummary,
  MEMBER_LIFECYCLE_STATUS_ORDER,
  resolveMemberLifecycleFilter,
} from "@/lib/member-ops-lifecycle";
import {
  formatMemberOpsPeopleSetupIncompleteMessage,
  logMemberOpsPeopleSchemaIssue,
} from "@/lib/member-ops-schema-guard";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const LIFECYCLE_LOAD_ERROR_MESSAGE = "Unable to load membership lifecycle right now. Please try again later.";

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function buildLifecycleHref(status: MemberLifecycleStatus | "all") {
  return status === "all" ? "/member-ops/lifecycle" : `/member-ops/lifecycle?status=${status}`;
}

function formatPersonName(person: { firstName: string; lastName: string }) {
  return `${person.firstName} ${person.lastName}`.trim();
}

function formatRoleLabel(roleType: string) {
  return roleType
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRoleSummary(roleTypes: readonly string[]) {
  if (roleTypes.length === 0) {
    return "No roles assigned";
  }

  return [...new Set(roleTypes.map(formatRoleLabel))].join(", ");
}

function formatProgramTeamSummary(
  memberships: Array<{
    team: { id: string; name: string; program: { id: string; name: string } };
  }>,
  roles: Array<{
    roleType: string;
    program: { id: string; name: string } | null;
    team: { id: string; name: string; program: { id: string; name: string } | null } | null;
  }>,
  participations: Array<{
    id: string;
    status: ProgramParticipationStatus;
    program: { id: string; name: string };
    season: { id: string; name: string } | null;
  }>,
) {
  const participationSummaries = mergeExplicitAndDerivedProgramParticipation({
    personId: "display-only",
    participations,
    roles,
    roster: memberships.map((membership) => ({
      rosterRole: "ROSTER",
      team: {
        id: membership.team.id,
        name: membership.team.name,
        program: membership.team.program,
      },
    })),
  }).map((context) => (context.seasonName ? `${context.programName} (${context.seasonName})` : context.programName));
  const rosterSummaries = memberships.map((membership) => `${membership.team.program.name} · ${membership.team.name}`);
  const roleSummaries = roles.map((role) => {
    if (role.team?.program?.name) {
      return `${role.team.program.name} · ${role.team.name}`;
    }
    if (role.program?.name) {
      return role.program.name;
    }
    return null;
  });
  const summaries = [...participationSummaries, ...rosterSummaries, ...roleSummaries].filter((value): value is string => Boolean(value));

  return summaries.length > 0 ? [...new Set(summaries)].join(", ") : "No program/team context";
}

function formatLastUpdated(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
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

export default async function MemberOpsLifecyclePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const lifecycleFilter = resolveMemberLifecycleFilter(readSearchParam(resolvedSearchParams, "status"));
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Membership Lifecycle</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query membership lifecycle right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Membership Lifecycle</h2>
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
    workflow: "member-ops.lifecycle.access",
    entityType: "person",
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Membership Lifecycle</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to view MemberOps lifecycle workflows.
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
        <h2 className="text-2xl font-semibold tracking-tight">Membership Lifecycle</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your role scope is incomplete for safe lifecycle visibility evaluation. Contact an organization admin.
          </p>
        </div>
      </section>
    );
  }

  let people:
    | Array<{
        id: string;
        firstName: string;
        lastName: string;
        lifecycleStatus: MemberLifecycleStatus;
        createdAt: Date;
        updatedAt: Date;
        roles: Array<{
          roleType: string;
          program: { id: string; name: string } | null;
          team: { id: string; name: string; program: { id: string; name: string } | null } | null;
        }>;
        roster: Array<{
          rosterRole: string;
          team: { id: string; name: string; program: { id: string; name: string } };
        }>;
        programParticipations: Array<{
          id: string;
          status: ProgramParticipationStatus;
          program: { id: string; name: string };
          season: { id: string; name: string } | null;
        }>;
      }>
    | null = null;
  let peopleLoadErrorMessage: string | null = null;

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
                ...(staffScopeResolution.allowedProgramIds.length > 0
                  ? [{ programParticipations: { some: { organizationId: scope.organizationId, programId: { in: staffScopeResolution.allowedProgramIds } } } }]
                  : []),
              ],
            }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        lifecycleStatus: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            roleType: true,
            program: { select: { id: true, name: true } },
            team: {
              select: {
                id: true,
                name: true,
                program: { select: { id: true, name: true } },
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
                program: { select: { id: true, name: true } },
              },
            },
          },
        },
        programParticipations: {
          where: {
            organizationId: scope.organizationId,
            ...(staffScopeResolution.allowAllStaffScope
              ? {}
              : { programId: { in: staffScopeResolution.allowedProgramIds } }),
          },
          select: {
            id: true,
            status: true,
            program: { select: { id: true, name: true } },
            season: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ lifecycleStatus: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
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
      programParticipations: person.programParticipations.filter((participation) =>
        matchesScopedTeamOrProgram(
          staffScopeResolution,
          null,
          participation.program.id,
        ),
      ),
    }));
  } catch (error) {
    const schemaIssue = logMemberOpsPeopleSchemaIssue("member-ops.lifecycle", error, {
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
    });
    peopleLoadErrorMessage = schemaIssue
      ? formatMemberOpsPeopleSetupIncompleteMessage(schemaIssue)
      : LIFECYCLE_LOAD_ERROR_MESSAGE;
    if (!schemaIssue) {
      console.error("[member-ops.lifecycle] Failed to load lifecycle overview", {
        organizationId: scope.organizationId,
        actorPersonId: scope.auth.personId,
        error,
      });
    }
    people = null;
  }

  if (!people) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Membership Lifecycle</h2>
        <ErrorMessage message={peopleLoadErrorMessage ?? LIFECYCLE_LOAD_ERROR_MESSAGE} />
      </section>
    );
  }

  const lifecycleCounts = buildMemberLifecycleStatusCounts(people.map((person) => person.lifecycleStatus));
  const filteredPeople = lifecycleFilter === "all"
    ? people
    : people.filter((person) => person.lifecycleStatus === lifecycleFilter);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Membership Lifecycle"
        description="Review lifecycle status coverage across scoped MemberOps people records."
        actions={
          <Link href="/people" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Open Members
          </Link>
        }
      />

      {people.length === 0 ? (
        <EmptyState message="No members have been added yet." actionHref="/people/new" actionLabel="Add the first member" />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-base font-medium">Lifecycle status overview</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Status mix in current scope: {formatLifecycleStatusSummary(lifecycleCounts)}.
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              This route is read-only and uses existing person, role, roster, and program participation data. Joining, transfer, departure, and offboarding automation remain future work.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <Link
              href={buildLifecycleHref("all")}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                lifecycleFilter === "all" ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              All statuses ({people.length})
            </Link>
            {MEMBER_LIFECYCLE_STATUS_ORDER.map((status) => (
              <Link
                key={status}
                href={buildLifecycleHref(status)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  lifecycleFilter === status
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                {MEMBER_LIFECYCLE_STATUS_LABELS[status]} ({lifecycleCounts[status] ?? 0})
              </Link>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Lifecycle status</th>
                  <th className="px-4 py-3 font-medium">Program / team context</th>
                  <th className="px-4 py-3 font-medium">Role / person type</th>
                  <th className="px-4 py-3 font-medium">Last updated</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredPeople.map((person) => {
                  const roleTypes = [
                    ...person.roles.map((role) => role.roleType),
                    ...person.roster.map((membership) => membership.rosterRole),
                  ];

                  return (
                    <tr key={person.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3">
                        <Link href={`/people/${person.id}`} className="underline">
                          {formatPersonName(person)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {MEMBER_LIFECYCLE_STATUS_LABELS[person.lifecycleStatus]}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {formatProgramTeamSummary(person.roster, person.roles, person.programParticipations)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {formatRoleSummary(roleTypes)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {formatLastUpdated(person.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {formatLastUpdated(person.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredPeople.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No members match the selected lifecycle status.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
