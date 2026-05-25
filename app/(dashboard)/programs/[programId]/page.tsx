import { MemberLifecycleStatus, ScopeType } from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { canPerformAction } from "@/lib/permissions";
import { selectSeededOrCurrentSeason } from "@/lib/workflows";

export const dynamic = "force-dynamic";

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function ProgramDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { programId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();
  const rolloverSuccess = readSearchParam(resolvedSearchParams, "rolloverSuccess");

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Program</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query program details right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Program</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let queryFailed = false;
  let program:
    | {
        id: string;
        name: string;
        organization: { id: string; name: string };
        teams: Array<{ id: string; name: string }>;
        seasons: Array<{ id: string; name: string; startDate: Date | null; endDate: Date | null }>;
        roles: Array<{
          id: string;
          roleType: string;
          person: { id: string; firstName: string; lastName: string };
        }>;
      }
    | null = null;

  try {
    program = await db.program.findFirst({
      where: {
        id: programId,
        organizationId: scope.organizationId,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        teams: {
          select: {
            id: true,
            name: true,
          },
          orderBy: [{ name: "asc" }],
        },
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
        roles: {
          where: {
            scopeType: ScopeType.PROGRAM,
          },
          include: {
            person: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: [{ roleType: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Program</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load program details right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  if (!program) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Program</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Program not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  const canAccessSeasonRollover =
    scope.auth.clerkUserId &&
    (await canPerformAction({
      actorUserId: scope.auth.clerkUserId,
      organizationId: scope.organizationId,
      action: "season.rollover",
      programId: program.id,
    }));

  const selectedSeason = selectSeededOrCurrentSeason(program.seasons);
  const selectedSeasonRoster = selectedSeason
    ? await db.rosterMembership.findMany({
        where: {
          organizationId: scope.organizationId,
          seasonId: selectedSeason.id,
          team: {
            programId: program.id,
          },
        },
        select: {
          id: true,
          rosterRole: true,
          personId: true,
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
      })
    : [];
  const selectedSeasonLifecycleCounts = Object.values(MemberLifecycleStatus).reduce(
    (counts, status) => {
      counts[status] = selectedSeasonRoster.filter((membership) => membership.person.lifecycleStatus === status).length;
      return counts;
    },
    {} as Record<MemberLifecycleStatus, number>,
  );
  const selectedSeasonRosterPersonIds = new Set(selectedSeasonRoster.map((membership) => membership.personId));
  const selectedSeasonAthleteRoster = selectedSeasonRoster.filter((membership) => membership.rosterRole === "ATHLETE");
  const selectedSeasonAthletesMissingGuardianLinkage = selectedSeasonAthleteRoster.filter(
    (membership) => membership.person.athleteLinks.length === 0,
  ).length;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <BackLink href="/programs" label="Programs" />
        <h2 className="text-2xl font-semibold tracking-tight">{program.name}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Organization: {program.organization.name}</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/programs/${program.id}/edit`}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Edit program
          </Link>
          <Link
            href={`/programs/${program.id}/seasons/new`}
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            New season
          </Link>
        </div>
      </div>

      {rolloverSuccess ? (
        <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-700 dark:bg-green-950/40">
          <p className="text-sm text-green-900 dark:text-green-200">{rolloverSuccess}</p>
        </div>
      ) : null}

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-2 text-lg font-medium">Roster lifecycle readiness</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Selected season: {selectedSeason?.name ?? "No season available"}.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Unique roster members in selected season: {selectedSeasonRosterPersonIds.size}.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Lifecycle mix: Active {selectedSeasonLifecycleCounts[MemberLifecycleStatus.ACTIVE]} · Prospect{" "}
          {selectedSeasonLifecycleCounts[MemberLifecycleStatus.PROSPECT]} · Inactive{" "}
          {selectedSeasonLifecycleCounts[MemberLifecycleStatus.INACTIVE]} · Archived{" "}
          {selectedSeasonLifecycleCounts[MemberLifecycleStatus.ARCHIVED]} · Alumni{" "}
          {selectedSeasonLifecycleCounts[MemberLifecycleStatus.ALUMNI]}.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Athlete rows missing guardian linkage in selected season: {selectedSeasonAthletesMissingGuardianLinkage}.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Seasons</h3>
        {program.seasons.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No seasons are configured for this program yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {program.seasons.map((season) => (
              <li key={season.id} className="flex flex-wrap items-center gap-2">
                <span>{season.name}</span>
                <Link href={`/programs/${program.id}/seasons/${season.id}/edit`} className="underline">
                  Edit
                </Link>
                {canAccessSeasonRollover ? (
                  <Link href={`/programs/${program.id}/seasons/${season.id}/rollover`} className="underline">
                    Rollover
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Teams</h3>
        {program.teams.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No teams are assigned to this program yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {program.teams.map((team) => (
              <li key={team.id}>
                <Link href={`/teams/${team.id}`} className="underline">
                  {team.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Program role assignments</h3>
        {program.roles.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No program-scoped role assignments.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {program.roles.map((role) => (
              <li key={role.id}>
                {role.person.firstName} {role.person.lastName} · {formatEnumLabel(role.roleType)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
