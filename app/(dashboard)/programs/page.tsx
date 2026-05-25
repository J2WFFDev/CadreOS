import Link from "next/link";
import { MemberLifecycleStatus, RoleType } from "@prisma/client";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { selectSeededOrCurrentSeason } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Programs</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query programs right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Programs</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No organization context is available yet.
          </p>
        </div>
      </section>
    );
  }

  let programs:
    | Array<{
        id: string;
        name: string;
        organization: { id: string; name: string };
        _count: { teams: number };
        seasons: Array<{ id: string; name: string; startDate: Date | null; endDate: Date | null }>;
        teams: Array<{
          id: string;
          roster: Array<{
            seasonId: string;
            personId: string;
            rosterRole: RoleType;
            person: {
              id: string;
              lifecycleStatus: MemberLifecycleStatus;
              athleteLinks: Array<{ id: string }>;
            };
          }>;
        }>;
      }>
    | null = null;

  try {
    programs = await db.program.findMany({
      where: { organizationId: scope.organizationId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            teams: true,
          },
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
        teams: {
          select: {
            id: true,
            roster: {
              where: {
                organizationId: scope.organizationId,
              },
              select: {
                seasonId: true,
                personId: true,
                rosterRole: true,
                person: {
                  select: {
                    id: true,
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
          },
        },
      },
      orderBy: { name: "asc" },
    });
  } catch {
    programs = null;
  }

  if (!programs) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Programs</h2>
        <ErrorMessage message="Unable to load programs right now. Please try again later." />
      </section>
    );
  }

  const programEntries = programs.map((program) => {
    const selectedSeason = selectSeededOrCurrentSeason(program.seasons);
    const selectedSeasonRoster = selectedSeason
      ? program.teams.flatMap((team) =>
          team.roster.filter((membership) => membership.seasonId === selectedSeason.id),
        )
      : [];
    const selectedSeasonRosterByPersonId = new Map<
      string,
      {
        personId: string;
        rosterRole: RoleType;
        lifecycleStatus: MemberLifecycleStatus;
        hasGuardianRelationship: boolean;
      }
    >();

    for (const membership of selectedSeasonRoster) {
      if (selectedSeasonRosterByPersonId.has(membership.personId)) {
        continue;
      }

      selectedSeasonRosterByPersonId.set(membership.personId, {
        personId: membership.personId,
        rosterRole: membership.rosterRole,
        lifecycleStatus: membership.person.lifecycleStatus,
        hasGuardianRelationship: membership.person.athleteLinks.length > 0,
      });
    }

    const selectedSeasonRosterMembers = [...selectedSeasonRosterByPersonId.values()];
    const lifecycleStatusCounts = Object.values(MemberLifecycleStatus).reduce(
      (counts, status) => {
        counts[status] = selectedSeasonRosterMembers.filter(
          (membership) => membership.lifecycleStatus === status,
        ).length;
        return counts;
      },
      {} as Record<MemberLifecycleStatus, number>,
    );
    const selectedSeasonAthletesMissingGuardianLinkage = selectedSeasonRosterMembers.filter(
      (membership) => membership.rosterRole === RoleType.ATHLETE && !membership.hasGuardianRelationship,
    ).length;
    const selectedSeasonMembersWithoutActiveLifecycle = selectedSeasonRosterMembers.filter(
      (membership) => membership.lifecycleStatus !== MemberLifecycleStatus.ACTIVE,
    ).length;
    const readinessConcernCount =
      selectedSeasonAthletesMissingGuardianLinkage + selectedSeasonMembersWithoutActiveLifecycle;

    return {
      program,
      selectedSeason,
      lifecycleStatusCounts,
      selectedSeasonRosterCount: selectedSeasonRosterMembers.length,
      selectedSeasonAthletesMissingGuardianLinkage,
      selectedSeasonMembersWithoutActiveLifecycle,
      readinessConcernCount,
    };
  });
  const programsWithReadinessConcerns = programEntries.filter(
    (entry) => entry.readinessConcernCount > 0 || entry.selectedSeasonRosterCount === 0,
  ).length;

  return (
    <section className="space-y-4">
      <PageHeader
        title="Programs"
        description="Organize your programs, seasons, and team groupings."
        actions={
          <Link href="/programs/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            New program
          </Link>
        }
      />

      {programs.length === 0 ? (
        <EmptyState message="No programs have been created yet." actionHref="/programs/new" actionLabel="Create the first program" />
      ) : (
        <>
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <h3 className="text-base font-medium">Program and season roster readiness</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Programs with selected-season readiness concerns (lifecycle or guardian coverage gaps):{" "}
              {programsWithReadinessConcerns}/{programEntries.length}.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <Link href="/teams?readiness=needs_attention" className="rounded-full border px-2 py-1">
                Team readiness lane
              </Link>
              <Link href="/people" className="rounded-full border px-2 py-1">
                People lifecycle and guardian context
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
          {programEntries.map((entry) => (
            <div key={entry.program.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <Link href={`/programs/${entry.program.id}`} className="text-lg font-medium underline">
                {entry.program.name}
              </Link>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Organization: {entry.program.organization.name}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Team count: {entry.program._count.teams}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Selected season: {entry.selectedSeason?.name ?? "No season available"}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Selected-season roster members: {entry.selectedSeasonRosterCount}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Lifecycle mix: Active {entry.lifecycleStatusCounts[MemberLifecycleStatus.ACTIVE]} · Prospect{" "}
                {entry.lifecycleStatusCounts[MemberLifecycleStatus.PROSPECT]} · Inactive{" "}
                {entry.lifecycleStatusCounts[MemberLifecycleStatus.INACTIVE]} · Archived{" "}
                {entry.lifecycleStatusCounts[MemberLifecycleStatus.ARCHIVED]} · Alumni{" "}
                {entry.lifecycleStatusCounts[MemberLifecycleStatus.ALUMNI]}.
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Selected-season roster members not currently Active: {entry.selectedSeasonMembersWithoutActiveLifecycle}.
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Athlete rows missing guardian linkage: {entry.selectedSeasonAthletesMissingGuardianLinkage}.
              </p>
              {entry.selectedSeasonRosterCount === 0 ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  No selected-season roster is currently configured for this program.
                </p>
              ) : null}
              <Link href={`/programs/${entry.program.id}`} className="mt-3 inline-block text-sm underline">
                View program details
              </Link>
            </div>
          ))}
          </div>
        </>
      )}
    </section>
  );
}
