import Link from "next/link";
import { MemberLifecycleStatus, ScopeType } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReviewFocusPanel } from "@/components/dashboard/review-focus-panel";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { selectSeededOrCurrentSeason } from "@/lib/workflows";

export const dynamic = "force-dynamic";
const STALE_TEAM_GAP_WINDOW_DAYS = 14;
const RECENT_TEAM_ACTIVITY_WINDOW_HOURS = 72;

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function buildHref(pathname: string, filters: Record<string, string>) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
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
  const operationalIndicatorFilterParam = readSearchParam(resolvedSearchParams, "operationalIndicator");
  const operationalIndicatorFilter =
    operationalIndicatorFilterParam === "recently_active" ||
    operationalIndicatorFilterParam === "stale" ||
    operationalIndicatorFilterParam === "needs_review" ||
    operationalIndicatorFilterParam === "unresolved_too_long"
      ? operationalIndicatorFilterParam
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
        updatedAt: Date;
        program: {
          id: string;
          name: string;
          seasons: Array<{ id: string; name: string; startDate: Date | null; endDate: Date | null }>;
        };
        roster: Array<{
          id: string;
          seasonId: string;
          personId: string;
          rosterRole: string;
          person: {
            lifecycleStatus: MemberLifecycleStatus;
            athleteLinks: Array<{ id: string }>;
          };
        }>;
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
            person: {
              select: {
                lifecycleStatus: true,
                athleteLinks: {
                  where: {
                    organizationId: scope.organizationId,
                  },
                  select: {
                    id: true,
                  },
                  take: 1,
                },
              },
            },
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
  const now = new Date();
  const staleGapCutoff = new Date(now.getTime() - STALE_TEAM_GAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recentActivityCutoff = new Date(now.getTime() - RECENT_TEAM_ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000);
  const teamEntries = teams.map((team) => {
    const selectedSeason = selectSeededOrCurrentSeason(team.program.seasons);
    const seasonRoster = selectedSeason
      ? team.roster.filter((membership) => membership.seasonId === selectedSeason.id)
      : [];
    const seasonRosterByPersonId = new Map<string, (typeof seasonRoster)[number]>();
    for (const membership of seasonRoster) {
      if (seasonRosterByPersonId.has(membership.personId)) {
        continue;
      }
      seasonRosterByPersonId.set(membership.personId, membership);
    }
    const selectedSeasonRosterMembers = [...seasonRosterByPersonId.values()];
    const athleteRosterCount = selectedSeasonRosterMembers.filter((membership) => membership.rosterRole === "ATHLETE").length;
    const seasonRosterPersonIds = new Set(selectedSeasonRosterMembers.map((membership) => membership.personId));
    const roleAssignmentPersonIds = new Set(team.roles.map((role) => role.personId));
    const roleAssignmentGapCount = [...seasonRosterPersonIds].filter(
      (personId) => !roleAssignmentPersonIds.has(personId),
    ).length;
    const inactiveRoleAssignmentCount = team.roles.filter((role) => !seasonRosterPersonIds.has(role.personId)).length;
    const lifecycleStatusCounts = Object.values(MemberLifecycleStatus).reduce(
      (counts, status) => {
        counts[status] = selectedSeasonRosterMembers.filter(
          (membership) => membership.person.lifecycleStatus === status,
        ).length;
        return counts;
      },
      {} as Record<MemberLifecycleStatus, number>,
    );
    const membersWithoutActiveLifecycle = selectedSeasonRosterMembers.filter(
      (membership) => membership.person.lifecycleStatus !== MemberLifecycleStatus.ACTIVE,
    ).length;
    const athletesMissingGuardianLinkage = selectedSeasonRosterMembers.filter(
      (membership) => membership.rosterRole === "ATHLETE" && membership.person.athleteLinks.length === 0,
    ).length;
    const hasRosterGap = seasonRoster.length === 0;
    const needsAttention =
      hasRosterGap ||
      roleAssignmentGapCount > 0 ||
      inactiveRoleAssignmentCount > 0 ||
      membersWithoutActiveLifecycle > 0 ||
      athletesMissingGuardianLinkage > 0;
    const stale = needsAttention && team.updatedAt.getTime() < staleGapCutoff.getTime();
    const recentlyActive = team.updatedAt.getTime() >= recentActivityCutoff.getTime();
    const unresolvedTooLong = needsAttention && stale;

    return {
      team,
      selectedSeason,
      seasonRoster,
      athleteRosterCount,
      roleAssignmentGapCount,
      inactiveRoleAssignmentCount,
      lifecycleStatusCounts,
      membersWithoutActiveLifecycle,
      athletesMissingGuardianLinkage,
      needsAttention,
      hasRosterGap,
      stale,
      recentlyActive,
      unresolvedTooLong,
    };
  });
  const filteredTeamEntries = teamEntries.filter((entry) => {
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
    if (operationalIndicatorFilter === "recently_active" && !entry.recentlyActive) {
      return false;
    }
    if (operationalIndicatorFilter === "stale" && !entry.stale) {
      return false;
    }
    if (operationalIndicatorFilter === "needs_review" && !entry.needsAttention) {
      return false;
    }
    if (operationalIndicatorFilter === "unresolved_too_long" && !entry.unresolvedTooLong) {
      return false;
    }
    return true;
  });
  const activeFilterLabels: string[] = [];
  if (readinessFilter !== "all") {
    activeFilterLabels.push(
      `Readiness: ${readinessFilter === "needs_attention" ? "Needs attention" : "Operationally clear"}`,
    );
  }
  if (assignmentSignalFilter !== "all") {
    activeFilterLabels.push(
      `Assignment signal: ${
        assignmentSignalFilter === "role_assignment_gap"
          ? "Roster role-assignment gaps"
          : "Inactive/unassigned role assignments"
      }`,
    );
  }
  if (operationalIndicatorFilter !== "all") {
    activeFilterLabels.push(`Operational indicator: ${operationalIndicatorFilter.replaceAll("_", " ")}`);
  }
  const buildTeamsHref = (overrides: Record<string, string>) =>
    buildHref("/teams", {
      readiness: readinessFilter === "all" ? "" : readinessFilter,
      assignmentSignal: assignmentSignalFilter === "all" ? "" : assignmentSignalFilter,
      operationalIndicator: operationalIndicatorFilter === "all" ? "" : operationalIndicatorFilter,
      ...overrides,
    });

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

      <ReviewFocusPanel
        title="Operational review focus"
        description="Review team roster and assignment readiness in one place, with quick links that preserve the current team review scope."
        activeFilters={activeFilterLabels}
        defaultScope="No filters are active. Review spans all teams in the current organization."
        stats={[
          {
            label: "Teams in current scope",
            value: filteredTeamEntries.length,
            href: activeFilterLabels.length > 0 ? buildTeamsHref({}) : "/teams",
          },
          {
            label: "Need attention",
            value: filteredTeamEntries.filter((entry) => entry.needsAttention).length,
            href: buildTeamsHref({ readiness: "needs_attention" }),
            tone: filteredTeamEntries.some((entry) => entry.needsAttention) ? "warning" : "success",
          },
          {
            label: "Stale",
            value: filteredTeamEntries.filter((entry) => entry.stale).length,
            href: buildTeamsHref({ operationalIndicator: "stale" }),
            tone: filteredTeamEntries.some((entry) => entry.stale) ? "warning" : "neutral",
          },
          {
            label: "Unresolved too long",
            value: filteredTeamEntries.filter((entry) => entry.unresolvedTooLong).length,
            href: buildTeamsHref({ operationalIndicator: "unresolved_too_long" }),
            tone: filteredTeamEntries.some((entry) => entry.unresolvedTooLong) ? "danger" : "success",
          },
          {
            label: "Role-assignment gaps",
            value: filteredTeamEntries.reduce((count, entry) => count + entry.roleAssignmentGapCount, 0),
            href: buildTeamsHref({ assignmentSignal: "role_assignment_gap" }),
            tone: filteredTeamEntries.some((entry) => entry.roleAssignmentGapCount > 0) ? "warning" : "success",
          },
          {
            label: "Recently active",
            value: filteredTeamEntries.filter((entry) => entry.recentlyActive).length,
            href: buildTeamsHref({ operationalIndicator: "recently_active" }),
            tone: filteredTeamEntries.some((entry) => entry.recentlyActive) ? "info" : "neutral",
          },
        ]}
        links={[
          { label: "Needs attention", href: buildTeamsHref({ readiness: "needs_attention" }) },
          { label: "Role-assignment gaps", href: buildTeamsHref({ assignmentSignal: "role_assignment_gap" }) },
          { label: "Stale readiness gaps", href: buildTeamsHref({ operationalIndicator: "stale" }) },
          { label: "Recent team changes", href: buildTeamsHref({ operationalIndicator: "recently_active" }) },
        ]}
        guidance="Team readiness signals are derived from selected-season roster membership, existing role assignments, and team update timestamps. Automation and invitations remain deferred."
      />

      {teams.length === 0 ? (
        <EmptyState message="No teams have been created yet." actionHref="/teams/new" actionLabel="Create the first team" />
      ) : (
        <>
          <form method="GET" className="rounded-lg border bg-white p-3 dark:bg-zinc-900">
            <div className="grid gap-3 md:grid-cols-4">
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
              <div className="space-y-1">
                <label htmlFor="operationalIndicator" className="text-sm font-medium">
                  Operational indicator
                </label>
                <select
                  id="operationalIndicator"
                  name="operationalIndicator"
                  defaultValue={operationalIndicatorFilter}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="all">All operational indicators</option>
                  <option value="recently_active">Recently active</option>
                  <option value="stale">Stale</option>
                  <option value="needs_review">Needs review</option>
                  <option value="unresolved_too_long">Unresolved too long</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button type="submit" className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  Apply
                </button>
                {readinessFilter !== "all" || assignmentSignalFilter !== "all" || operationalIndicatorFilter !== "all" ? (
                  <Link href="/teams" className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    Clear
                  </Link>
                ) : null}
              </div>
            </div>
          </form>
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredTeamEntries.map((entry) => (
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
                    {entry.recentlyActive ? (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        Recently active
                      </span>
                    ) : null}
                    {entry.stale ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Stale
                      </span>
                    ) : null}
                    {entry.unresolvedTooLong ? (
                      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        Unresolved too long
                      </span>
                    ) : null}
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
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Lifecycle mix: Active {entry.lifecycleStatusCounts[MemberLifecycleStatus.ACTIVE]} · Prospect{" "}
                    {entry.lifecycleStatusCounts[MemberLifecycleStatus.PROSPECT]} · Inactive{" "}
                    {entry.lifecycleStatusCounts[MemberLifecycleStatus.INACTIVE]} · Archived{" "}
                    {entry.lifecycleStatusCounts[MemberLifecycleStatus.ARCHIVED]} · Alumni{" "}
                    {entry.lifecycleStatusCounts[MemberLifecycleStatus.ALUMNI]}.
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Team role assignments: {entry.team.roles.length}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Role-assignment gaps: {entry.roleAssignmentGapCount}
                    {" · "}
                    Inactive/unassigned role signals: {entry.inactiveRoleAssignmentCount}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Selected-season roster members not currently Active: {entry.membersWithoutActiveLifecycle}
                    {" · "}
                    Athlete rows missing guardian linkage: {entry.athletesMissingGuardianLinkage}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Last operational change: {entry.team.updatedAt.toISOString().slice(0, 16).replace("T", " ")} UTC
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
