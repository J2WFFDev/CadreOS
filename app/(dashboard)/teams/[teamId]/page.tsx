import { RoleType, ScopeType } from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
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

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildTeamViewHref(teamId: string, filters: { seasonId?: string; roleFilter?: string }) {
  const params = new URLSearchParams();

  if (filters.seasonId) {
    params.set("seasonId", filters.seasonId);
  }

  if (filters.roleFilter && filters.roleFilter !== "ALL") {
    params.set("roleFilter", filters.roleFilter);
  }

  const query = params.toString();
  return query ? `/teams/${teamId}?${query}` : `/teams/${teamId}`;
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
          person: {
            id: string;
            firstName: string;
            lastName: string;
            email: string | null;
            athleteLinks: Array<{
              id: string;
              guardian: {
                id: string;
                firstName: string;
                lastName: string;
                _count: { userAccounts: number };
              };
            }>;
          };
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
                  athleteLinks: {
                    where: {
                      organizationId: scope.organizationId,
                    },
                    select: {
                      id: true,
                      guardian: {
                        select: {
                          id: true,
                          firstName: true,
                          lastName: true,
                          _count: {
                            select: {
                              userAccounts: true,
                            },
                          },
                        },
                      },
                    },
                  },
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
  const roleFilterParam = readSearchParam(resolvedSearchParams, "roleFilter");
  const roleFilter = roleFilterParam && Object.values(RoleType).includes(roleFilterParam as RoleType)
    ? (roleFilterParam as RoleType)
    : "ALL";
  const filteredSelectedSeasonRosterMembers =
    roleFilter === "ALL"
      ? selectedSeasonRosterMembers
      : selectedSeasonRosterMembers.filter((membership) => membership.rosterRole === roleFilter);
  const athleteRosterMemberships = selectedSeasonRosterMembers.filter((membership) => membership.rosterRole === RoleType.ATHLETE);
  const athleteRosterWithGuardianLinks = athleteRosterMemberships.filter(
    (membership) => membership.person.athleteLinks.length > 0,
  ).length;
  const athleteRosterWithGuardianAccountLinkGaps = athleteRosterMemberships.filter((membership) =>
    membership.person.athleteLinks.some((relationship) => relationship.guardian._count.userAccounts === 0),
  ).length;
  const athleteRosterWithoutGuardianLinks = athleteRosterMemberships.length - athleteRosterWithGuardianLinks;
  const roleAssignmentsByPersonId = new Map<
    string,
    Array<{ id: string; roleType: string; person: { id: string; firstName: string; lastName: string } }>
  >();
  for (const role of team.roles) {
    const personRoles = roleAssignmentsByPersonId.get(role.person.id) ?? [];
    personRoles.push(role);
    roleAssignmentsByPersonId.set(role.person.id, personRoles);
  }
  const rosterMembersWithoutRoleAssignments = selectedSeasonRosterMembers.filter(
    (membership) => (roleAssignmentsByPersonId.get(membership.person.id) ?? []).length === 0,
  ).length;
  const selectedSeasonRosterPersonIds = new Set(selectedSeasonRosterMembers.map((membership) => membership.person.id));
  const availablePeople = organizationPeople.filter((person) => !selectedSeasonRosterPersonIds.has(person.id));
  const inactiveOrUnassignedRoleMembers = team.roles.filter((role) => !selectedSeasonRosterPersonIds.has(role.person.id));

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
          <BackLink href="/teams" label="Teams" />
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
                href={buildTeamViewHref(team.id, { seasonId: season.id, roleFilter: roleFilter === "ALL" ? undefined : roleFilter })}
                className={`rounded-md border px-2 py-1 ${
                  selectedSeasonForView?.id === season.id ? "bg-zinc-100 dark:bg-zinc-800" : ""
                }`}
              >
                {season.name}
              </Link>
            ))}
          </div>
        ) : null}
        {selectedSeasonRosterMembers.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <Link
              href={buildTeamViewHref(team.id, { seasonId: selectedSeasonForView?.id, roleFilter: undefined })}
              className={`rounded-md border px-2 py-1 ${roleFilter === "ALL" ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
            >
              All roster roles
            </Link>
            {Object.values(RoleType).map((roleType) => (
              <Link
                key={roleType}
                href={buildTeamViewHref(team.id, { seasonId: selectedSeasonForView?.id, roleFilter: roleType })}
                className={`rounded-md border px-2 py-1 ${roleFilter === roleType ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
              >
                {formatEnumLabel(roleType)}
              </Link>
            ))}
          </div>
        ) : null}
        {selectedSeasonRosterMembers.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No members on team for this season yet.
          </p>
        ) : filteredSelectedSeasonRosterMembers.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No roster members match the selected role filter.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-3 py-2 font-medium">Member</th>
                  <th className="px-3 py-2 font-medium">Roster role</th>
                  <th className="px-3 py-2 font-medium">Role assignment status</th>
                  <th className="px-3 py-2 font-medium">Member status</th>
                  <th className="px-3 py-2 font-medium">Guardian / relationship status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSelectedSeasonRosterMembers.map((membership) => {
                  const personRoleAssignments = roleAssignmentsByPersonId.get(membership.person.id) ?? [];
                  const roleAssignmentStatus =
                    personRoleAssignments.length === 0
                      ? "Role assignment missing"
                      : personRoleAssignments.map((assignment) => formatEnumLabel(assignment.roleType)).join(", ");
                  const guardianStatus =
                    membership.rosterRole === RoleType.ATHLETE
                      ? membership.person.athleteLinks.length > 0
                        ? (() => {
                            const linkedGuardianCount = membership.person.athleteLinks.length;
                            const guardiansMissingAccountLinks = membership.person.athleteLinks.filter(
                              (relationship) => relationship.guardian._count.userAccounts === 0,
                            ).length;
                            if (guardiansMissingAccountLinks > 0) {
                              return `${linkedGuardianCount} guardian relationship${linkedGuardianCount === 1 ? "" : "s"} · ${guardiansMissingAccountLinks} guardian account link missing`;
                            }
                            return `${linkedGuardianCount} guardian relationship${linkedGuardianCount === 1 ? "" : "s"} linked`;
                          })()
                        : "No guardian relationship linked"
                      : "Relationship visibility intentionally limited to athlete roster rows";

                  return (
                    <tr key={membership.id} className="border-b align-top last:border-b-0">
                      <td className="px-3 py-2">
                        <Link href={`/people/${membership.person.id}`} className="underline">
                          {membership.person.firstName} {membership.person.lastName}
                        </Link>
                        {membership.person.email ? (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400">{membership.person.email}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{formatEnumLabel(membership.rosterRole)}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{roleAssignmentStatus}</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">Active on selected season roster</td>
                      <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">{guardianStatus}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Athlete guardian relationship coverage for this season: {athleteRosterWithGuardianLinks} athlete
          {athleteRosterWithGuardianLinks === 1 ? "" : "s"} with guardian link
          {athleteRosterWithGuardianLinks === 1 ? "" : "s"}, {athleteRosterWithoutGuardianLinks} without.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Athlete rows with guardian account-link gaps: {athleteRosterWithGuardianAccountLinkGaps} athlete
          {athleteRosterWithGuardianAccountLinkGaps === 1 ? "" : "s"} have at least one guardian relationship with no
          linked user account.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Team roster role-assignment gaps: {rosterMembersWithoutRoleAssignments} member
          {rosterMembersWithoutRoleAssignments === 1 ? "" : "s"} with role assignment missing.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Relationship status indicators are staff-facing roster diagnostics only. They do not grant guardian access,
          and guardian onboarding/invitation workflows are intentionally deferred.
        </p>
        {athleteRosterMemberships.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            No guardian relationship data for this season because no athletes are on the selected roster.
          </p>
        ) : athleteRosterWithGuardianLinks === 0 ? (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            No guardian relationship data is currently linked for athletes on this season roster.
          </p>
        ) : null}
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
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No role assignments on this team yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {team.roles.map((role) => (
              <li key={role.id}>
                <Link href={`/people/${role.person.id}`} className="underline">
                  {role.person.firstName} {role.person.lastName}
                </Link>{" "}
                · {formatEnumLabel(role.roleType)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Inactive / unassigned member signals</h3>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Team role assignments that are not on the selected season roster are shown as inactive/unassigned members.
        </p>
        {inactiveOrUnassignedRoleMembers.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No inactive/unassigned members detected for this season view.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {inactiveOrUnassignedRoleMembers.map((role) => (
              <li key={role.id}>
                <Link href={`/people/${role.person.id}`} className="underline">
                  {role.person.firstName} {role.person.lastName}
                </Link>{" "}
                · {formatEnumLabel(role.roleType)} · Inactive/unassigned member
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
