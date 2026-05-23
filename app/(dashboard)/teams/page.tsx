import Link from "next/link";
import { ScopeType } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { selectSeededOrCurrentSeason } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const scope = await getOrganizationScope();

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
        roster: Array<{ id: string; seasonId: string; rosterRole: string }>;
        roles: Array<{ id: string }>;
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
            rosterRole: true,
          },
        },
        roles: {
          where: {
            scopeType: ScopeType.TEAM,
          },
          select: {
            id: true,
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
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => {
            const selectedSeason = selectSeededOrCurrentSeason(team.program.seasons);
            const seasonRoster = selectedSeason
              ? team.roster.filter((membership) => membership.seasonId === selectedSeason.id)
              : [];
            const athleteRosterCount = seasonRoster.filter((membership) => membership.rosterRole === "ATHLETE").length;

            return (
              <div key={team.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <Link href={`/teams/${team.id}`} className="text-base font-medium underline">
                  {team.name}
                </Link>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Program:{" "}
                  <Link href={`/programs/${team.program.id}`} className="underline">
                    {team.program.name}
                  </Link>
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Season context: {selectedSeason ? selectedSeason.name : "No season available"}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {selectedSeason
                    ? `Selected season roster: ${seasonRoster.length} members (${athleteRosterCount} athletes)`
                    : "Selected season roster: none"}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Team role assignments: {team.roles.length}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
