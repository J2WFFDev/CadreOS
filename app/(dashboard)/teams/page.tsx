import Link from "next/link";
import { ScopeType } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { selectSeededOrCurrentSeason } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();
  const readinessFilterParam = readSearchParam(resolvedSearchParams, "readiness");
  const readinessFilter =
    readinessFilterParam === "needs_attention" || readinessFilterParam === "operationally_clear"
      ? readinessFilterParam
      : "all";
  const assignmentSignalFilterParam = readSearchParam(resolvedSearchParams, "assignmentSignal");
  const assignmentSignalFilter =
    assignmentSignalFilterParam === "role_assignment_gap" ||
    assignmentSignalFilterParam === "inactive_or_unassigned_roles"
      ? assignmentSignalFilterParam
      : "all";

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Teams</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query teams right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Teams</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No organization context is available yet.
          </p>
        </div>
      </section>
    );
  }

  let teams:
    | Array<{
        id: string;
        name: string;
        program: {
          id: string;
          name: string;
          seasons: Array<{ id: string; name: string; startDate: Date | null; endDate: Date | null }>;
        };
        roster: Array<{ id: string; seasonId: string; personId: string; rosterRole: string }>;
        roles: Array<{ id: string; personId: string }>;
      }>
    | null = null;

  try {
    teams = await db.team.findMany({
      where: { organizationId: scope.organizationId },
      include: {
        program: {
          select: {
            id: true,
            name: true,
            seasons: {
              where: {
                organizationId: scope.organizationId,
              },
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
              },
              orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
            },
          },
        },
        roster: {
          select: {
            id: true,
            seasonId: true,
            personId: true,
            rosterRole: true,
          },
        },
        roles: {
          where: {
            scopeType: ScopeType.TEAM,
          },
          select: {
            id: true,
            personId: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
  } catch {
    teams = null;
  }

  if (!teams) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Teams</h2>
        <ErrorMessage message="Unable to load teams right now. Please try again later." />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Teams"
        description="Manage team memberships, rosters, and roles across your programs."
        actions={
          <Link href="/teams/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            New team
          </Link>
        }
      />

      {teams.length === 0 ? (
        <EmptyState message="No teams have been created yet." actionHref="/teams/new" actionLabel="Create the first team" />
      ) : (
        <>
          <form method="GET" className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <label htmlFor="readiness" className="text-sm font-medium">
                  Readiness state
                </label>
                <select id="readiness" name="readiness" defaultValue={readinessFilter} className="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="all">All readiness states</option>
                  <option value="needs_attention">Needs attention</option>
                  <option value="operationally_clear">Operationally clear</option>
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="assignmentSignal" className="text-sm font-medium">
                  Assignment signal
                </label>
                <select
                  id="assignmentSignal"
                  name="assignmentSignal"
                  defaultValue={assignmentSignalFilter}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="all">All assignment states</option>
                  <option value="role_assignment_gap">Roster role-assignment gaps</option>
                  <option value="inactive_or_unassigned_roles">Inactive/unassigned role assignments</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button type="submit" className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  Apply
                </button>
                {readinessFilter !== "all" || assignmentSignalFilter !== "all" ? (
                  <Link href="/teams" className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Clear
                  </Link>
                ) : null}
              </div>
            </div>
          </form>
          <div className="grid gap-3 sm:grid-cols-2">
            {teams
              .map((team) => {
                const selectedSeason = selectSeededOrCurrentSeason(team.program.seasons);
                const seasonRoster = selectedSeason
                  ? team.roster.filter((membership) => membership.seasonId === selectedSeason.id)
                  : [];
                const athleteRosterCount = seasonRoster.filter((membership) => membership.rosterRole === "ATHLETE").length;
                const seasonRosterPersonIds = new Set(seasonRoster.map((membership) => membership.personId));
                const roleAssignmentPersonIds = new Set(team.roles.map((role) => role.personId));
                const roleAssignmentGapCount = [...seasonRosterPersonIds].filter(
                  (personId) => !roleAssignmentPersonIds.has(personId),
                ).length;
                const inactiveRoleAssignmentCount = team.roles.filter(
                  (role) => !seasonRosterPersonIds.has(role.personId),
                ).length;
                const hasRosterGap = seasonRoster.length === 0;
                const needsAttention = hasRosterGap || roleAssignmentGapCount > 0 || inactiveRoleAssignmentCount > 0;
                return {
                  team,
                  selectedSeason,
                  seasonRoster,
                  athleteRosterCount,
                  roleAssignmentGapCount,
                  inactiveRoleAssignmentCount,
                  needsAttention,
                  hasRosterGap,
                };
              })
              .filter((entry) => {
                if (readinessFilter === "needs_attention" && !entry.needsAttention) {
                  return false;
                }
                if (readinessFilter === "operationally_clear" && entry.needsAttention) {
                  return false;
                }
                if (assignmentSignalFilter === "role_assignment_gap" && entry.roleAssignmentGapCount === 0) {
                  return false;
                }
                if (
                  assignmentSignalFilter === "inactive_or_unassigned_roles" &&
                  entry.inactiveRoleAssignmentCount === 0
                ) {
                  return false;
                }
                return true;
              })
              .map((entry) => (
                <div key={entry.team.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/teams/${entry.team.id}`} className="text-base font-medium underline">
                      {entry.team.name}
                    </Link>
                    {entry.needsAttention ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Needs attention
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Operationally clear
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Program:{" "}
                    <Link href={`/programs/${entry.team.program.id}`} className="underline">
                      {entry.team.program.name}
                    </Link>
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Season context: {entry.selectedSeason ? entry.selectedSeason.name : "No season available"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {entry.selectedSeason
                      ? `Selected season roster: ${entry.seasonRoster.length} members (${entry.athleteRosterCount} athletes)`
                      : "Selected season roster: none"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Team role assignments: {entry.team.roles.length}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Role-assignment gaps: {entry.roleAssignmentGapCount}
                    {" · "}
                    Inactive/unassigned role signals: {entry.inactiveRoleAssignmentCount}
                  </p>
                  {entry.hasRosterGap ? (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                      No selected-season roster currently configured.
                    </p>
                  ) : null}
                </div>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
