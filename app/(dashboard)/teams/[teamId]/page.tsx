import { RoleType, ScopeType } from "@prisma/client";
import Link from "next/link";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { selectSeededOrCurrentSeason } from "@/lib/phase1c/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function TeamDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { teamId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query team details right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let queryFailed = false;
  let team:
    | {
        id: string;
        name: string;
        program: {
          id: string;
          name: string;
          seasons: Array<{ id: string; name: string; startDate: Date | null; endDate: Date | null }>;
        };
        roles: Array<{
          id: string;
          roleType: string;
          person: { id: string; firstName: string; lastName: string };
        }>;
        roster: Array<{
          id: string;
          rosterRole: string;
          person: { id: string; firstName: string; lastName: string; email: string | null };
          season: { id: string; name: string; startDate: Date | null; endDate: Date | null };
        }>;
      }
    | null = null;
  let organizationPeople: Array<{ id: string; firstName: string; lastName: string }> = [];

  try {
    [team, organizationPeople] = await Promise.all([
      db.team.findFirst({
        where: {
          id: teamId,
          organizationId: scope.organizationId,
        },
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
          roles: {
            where: {
              scopeType: ScopeType.TEAM,
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
          roster: {
            include: {
              person: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              season: {
                select: {
                  id: true,
                  name: true,
                  startDate: true,
                  endDate: true,
                },
              },
            },
            orderBy: [{ createdAt: "desc" }],
          },
        },
      }),
      db.person.findMany({
        where: {
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load team details right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  if (!team) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Team not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  const selectedSeason = selectSeededOrCurrentSeason(team.program.seasons);
  const requestedSeasonId = readSearchParam(resolvedSearchParams, "seasonId");
  const selectedSeasonForView =
    team.program.seasons.find((season) => season.id === requestedSeasonId) ?? selectedSeason;
  const selectedSeasonRosterMembers = selectedSeasonForView
    ? team.roster.filter((membership) => membership.season.id === selectedSeasonForView.id)
    : [];
  const selectedSeasonRosterPersonIds = new Set(selectedSeasonRosterMembers.map((membership) => membership.person.id));
  const availablePeople = organizationPeople.filter((person) => !selectedSeasonRosterPersonIds.has(person.id));

  const rosterError = readSearchParam(resolvedSearchParams, "rosterError");
  const rosterPersonIdError = readSearchParam(resolvedSearchParams, "rosterPersonIdError");
  const rosterSeasonIdError = readSearchParam(resolvedSearchParams, "seasonIdError");
  const rosterRoleError = readSearchParam(resolvedSearchParams, "rosterRoleError");
  const selectedRosterSeasonId =
    readSearchParam(resolvedSearchParams, "seasonId") || selectedSeasonForView?.id || "";
  const selectedRosterPersonId =
    readSearchParam(resolvedSearchParams, "rosterPersonId") || availablePeople[0]?.id || "";
  const selectedRosterRole =
    readSearchParam(resolvedSearchParams, "rosterRole") || RoleType.ATHLETE;

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href="/teams" className="hover:text-zinc-700 dark:hover:text-zinc-200">
            ← Teams
          </Link>
          <span>·</span>
          <Link href={`/programs/${team.program.id}`} className="hover:text-zinc-700 dark:hover:text-zinc-200">
            {team.program.name}
          </Link>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">{team.name}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Program: {team.program.name}</p>
        <Link
          href="#add-roster-member"
          className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
        >
          Add roster member
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Roster members</h3>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Season: {selectedSeasonForView?.name ?? "No season available"}
        </p>
        {team.program.seasons.length > 1 ? (
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            {team.program.seasons.map((season) => (
              <Link
                key={season.id}
                href={`/teams/${team.id}?seasonId=${season.id}`}
                className={`rounded-md border px-2 py-1 ${
                  selectedSeasonForView?.id === season.id ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                {season.name}
              </Link>
            ))}
          </div>
        ) : null}
        {selectedSeasonRosterMembers.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No roster members found for this season.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {selectedSeasonRosterMembers.map((membership) => (
              <li key={membership.id}>
                {membership.person.firstName} {membership.person.lastName}
                {membership.person.email ? ` (${membership.person.email})` : ""} ·{" "}
                {formatEnumLabel(membership.rosterRole)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div id="add-roster-member" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Add roster member</h3>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Target season: {selectedSeasonForView?.name ?? "No season available"}
        </p>

        {rosterError ? <p className="mb-3 text-sm text-red-600">{rosterError}</p> : null}

        {!selectedSeasonForView ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Add or seed a season for this program before adding roster members.
          </p>
        ) : availablePeople.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            All organization people are already on this team for the selected season.
          </p>
        ) : (
          <form action={`/teams/${team.id}/roster`} method="post" className="space-y-3">
            {team.program.seasons.length === 1 ? (
              <input type="hidden" name="seasonId" value={selectedRosterSeasonId} />
            ) : (
              <div className="space-y-1">
                <label htmlFor="seasonId" className="text-sm font-medium">
                  Season
                </label>
                <select
                  id="seasonId"
                  name="seasonId"
                  defaultValue={selectedRosterSeasonId}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {team.program.seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
                {rosterSeasonIdError ? <p className="text-sm text-red-600">{rosterSeasonIdError}</p> : null}
              </div>
            )}

            <div className="space-y-1">
              <label htmlFor="personId" className="text-sm font-medium">
                Person
              </label>
              <select
                id="personId"
                name="personId"
                defaultValue={selectedRosterPersonId}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {availablePeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))}
              </select>
              {rosterPersonIdError ? <p className="text-sm text-red-600">{rosterPersonIdError}</p> : null}
            </div>

            <div className="space-y-1">
              <label htmlFor="rosterRole" className="text-sm font-medium">
                Roster role
              </label>
              <select
                id="rosterRole"
                name="rosterRole"
                defaultValue={selectedRosterRole}
                className="w-full rounded-md border px-3 py-2 text-sm"
              >
                {Object.values(RoleType).map((roleType) => (
                  <option key={roleType} value={roleType}>
                    {formatEnumLabel(roleType)}
                  </option>
                ))}
              </select>
              {rosterRoleError ? <p className="text-sm text-red-600">{rosterRoleError}</p> : null}
            </div>

            <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
              Add member
            </button>
          </form>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Team role assignments</h3>
        {team.roles.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No team-scoped role assignments.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {team.roles.map((role) => (
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
