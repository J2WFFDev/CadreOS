import { RoleType } from "@prisma/client";

import { BackLink } from "@/components/dashboard/back-link";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormActions } from "@/components/dashboard/form-actions";
import {
  MEMBEROPS_ROSTER_ROLE_TYPES,
} from "@/lib/member-ops";
import {
  evaluatePersonOperationalContentAccess,
  evaluateStaffOnlyContentAccess,
  logAuthorizationDecision,
  resolveActorRoleContext,
  resolveStaffScopeResolution,
  type StaffScopeResolution,
} from "@/lib/authorization";
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

function derivePersonOperationalScope(person: {
  roles: Array<{
    program: { id: string } | null;
    team: { id: string; program: { id: string } | null } | null;
  }>;
  roster: Array<{
    team: { id: string; program: { id: string } };
  }>;
}) {
  return {
    teamIds: Array.from(
      new Set([
        ...person.roles.map((role) => role.team?.id ?? null),
        ...person.roster.map((membership) => membership.team.id),
      ].filter((value): value is string => Boolean(value))),
    ),
    programIds: Array.from(
      new Set([
        ...person.roles.map((role) => role.program?.id ?? role.team?.program?.id ?? null),
        ...person.roster.map((membership) => membership.team.program.id),
      ].filter((value): value is string => Boolean(value))),
    ),
  };
}

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function MovePersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { personId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Move member</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to load move workflow right now."} />
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Move member</h2>
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
    workflow: "people.move.access",
    entityType: "person",
    entityId: personId,
  });

  if (!staffAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Move member</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have staff access to move members.
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
        <h2 className="text-2xl font-semibold tracking-tight">Move member</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your role scope is incomplete for safe member move evaluation. Contact an organization admin.
          </p>
        </div>
      </section>
    );
  }

  let queryFailed = false;
  let person:
    | {
        id: string;
        firstName: string;
        lastName: string;
        roles: Array<{
          program: { id: string } | null;
          team: { id: string; program: { id: string } | null } | null;
        }>;
        roster: Array<{
          id: string;
          rosterRole: string;
          team: { id: string; name: string; program: { id: string; name: string } };
          season: { id: string; name: string };
        }>;
      }
    | null = null;
  let programs: Array<{ id: string; name: string }> = [];
  let teams: Array<{ id: string; name: string; program: { id: string; name: string } }> = [];
  let seasons: Array<{
    id: string;
    name: string;
    startDate: Date | null;
    endDate: Date | null;
    program: { id: string; name: string };
  }> = [];

  try {
    [person, programs, teams, seasons] = await Promise.all([
      db.person.findFirst({
        where: {
          id: personId,
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          roles: {
            select: {
              program: {
                select: {
                  id: true,
                },
              },
              team: {
                select: {
                  id: true,
                  program: {
                    select: {
                      id: true,
                    },
                  },
                },
              },
            },
          },
          roster: {
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  startDate: true,
                  endDate: true,
                  program: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              season: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: [{ createdAt: "desc" }],
          },
        },
      }),
      db.program.findMany({
        where: {
          organizationId: scope.organizationId,
          ...(staffScopeResolution.allowAllStaffScope
            ? {}
            : {
                OR: [
                  ...(staffScopeResolution.allowedProgramIds.length > 0
                    ? [{ id: { in: staffScopeResolution.allowedProgramIds } }]
                    : []),
                  ...(staffScopeResolution.allowedTeamIds.length > 0
                    ? [{ teams: { some: { id: { in: staffScopeResolution.allowedTeamIds } } } }]
                    : []),
                ],
              }),
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: [{ name: "asc" }],
      }),
      db.team.findMany({
        where: {
          organizationId: scope.organizationId,
          ...(staffScopeResolution.allowAllStaffScope
            ? {}
            : {
                OR: [
                  ...(staffScopeResolution.allowedTeamIds.length > 0
                    ? [{ id: { in: staffScopeResolution.allowedTeamIds } }]
                    : []),
                  ...(staffScopeResolution.allowedProgramIds.length > 0
                    ? [{ programId: { in: staffScopeResolution.allowedProgramIds } }]
                    : []),
                ],
              }),
        },
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
        orderBy: [{ program: { name: "asc" } }, { name: "asc" }],
      }),
      db.season.findMany({
        where: {
          organizationId: scope.organizationId,
        },
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
        orderBy: [{ program: { name: "asc" } }, { startDate: "desc" }, { createdAt: "desc" }],
      }),
    ]);
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Move member</h2>
        <ErrorMessage message="Unable to load move workflow right now. Please try again later." />
      </section>
    );
  }

  if (!person) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Move member</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Person not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  const personAccessDecision = evaluatePersonOperationalContentAccess(
    actorRoleContext,
    derivePersonOperationalScope(person),
  );
  logAuthorizationDecision(personAccessDecision, {
    workflow: "people.move.scope",
    entityType: "person",
    entityId: person.id,
  });

  if (!personAccessDecision.allowed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Move member</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You do not have access to this person within your current team/program scope.
          </p>
        </div>
      </section>
    );
  }

  const visibleRoster = staffScopeResolution.allowAllStaffScope
    ? person.roster
    : person.roster.filter((membership) =>
        matchesScopedTeamOrProgram(
          staffScopeResolution,
          membership.team.id,
          membership.team.program.id,
        ),
      );
  const fallbackMembership = visibleRoster[0] ?? null;

  const selectedProgramId =
    readSearchParam(resolvedSearchParams, "programId") || fallbackMembership?.team.program.id || programs[0]?.id || "";
  const teamsForSelectedProgram = teams.filter((team) => team.program.id === selectedProgramId);
  const seasonsForSelectedProgram = seasons.filter((season) => season.program.id === selectedProgramId);
  const currentSeasonForSelectedProgram = selectSeededOrCurrentSeason(seasonsForSelectedProgram);
  const selectedTeamId =
    readSearchParam(resolvedSearchParams, "teamId") || fallbackMembership?.team.id || teamsForSelectedProgram[0]?.id || "";
  const selectedSeasonId =
    readSearchParam(resolvedSearchParams, "seasonId") ||
    currentSeasonForSelectedProgram?.id ||
    fallbackMembership?.season.id ||
    "";
  const selectedRosterRole =
    (readSearchParam(resolvedSearchParams, "rosterRole") || fallbackMembership?.rosterRole || RoleType.ATHLETE) as RoleType;
  const selectedSourceMembershipId =
    readSearchParam(resolvedSearchParams, "sourceMembershipId") || fallbackMembership?.id || "";
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <BackLink href={`/people/${person.id}`} label="Person detail" />
        <h2 className="text-2xl font-semibold tracking-tight">Move member</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {person.firstName} {person.lastName}
        </p>
      </div>

      {generalError ? <ErrorMessage message={generalError} /> : null}

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Current roster memberships</h3>
        {visibleRoster.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No visible roster memberships for this person.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {visibleRoster.map((membership) => (
              <li key={membership.id}>
                Program: {membership.team.program.name} · Team: {membership.team.name} · Season: {membership.season.name} · Role:{" "}
                {formatEnumLabel(membership.rosterRole)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={`/people/${person.id}/move/update`} method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <div className="space-y-1">
          <label htmlFor="sourceMembershipId" className="text-sm font-medium">
            Current membership to transition (optional)
          </label>
          <select
            id="sourceMembershipId"
            name="sourceMembershipId"
            defaultValue={selectedSourceMembershipId}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Create new membership context</option>
            {visibleRoster.map((membership) => (
              <option key={membership.id} value={membership.id}>
                {membership.team.program.name} · {membership.team.name} · {membership.season.name} · {formatEnumLabel(membership.rosterRole)}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "sourceMembershipIdError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "sourceMembershipIdError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="programId" className="text-sm font-medium">
            Target program
          </label>
          <select id="programId" name="programId" defaultValue={selectedProgramId} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">Select a program</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "programIdError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "programIdError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="teamId" className="text-sm font-medium">
            Target team
          </label>
          <select id="teamId" name="teamId" defaultValue={selectedTeamId} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">Select a team</option>
            {teamsForSelectedProgram.map((team) => (
              <option key={team.id} value={team.id}>
                {team.program.name} · {team.name}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "teamIdError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "teamIdError")}</p>
          ) : null}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Team options are filtered to the selected program.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="seasonId" className="text-sm font-medium">
            Target season
          </label>
          <select id="seasonId" name="seasonId" defaultValue={selectedSeasonId} className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="">Select a season</option>
            {seasonsForSelectedProgram.map((season) => (
              <option key={season.id} value={season.id}>
                {season.program.name} · {season.name}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "seasonIdError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "seasonIdError")}</p>
          ) : null}
        </div>

        <div className="space-y-1">
          <label htmlFor="rosterRole" className="text-sm font-medium">
            Target roster role
          </label>
          <select
            id="rosterRole"
            name="rosterRole"
            defaultValue={selectedRosterRole}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {MEMBEROPS_ROSTER_ROLE_TYPES.map((roleType) => (
              <option key={roleType} value={roleType}>
                {formatEnumLabel(roleType)}
              </option>
            ))}
          </select>
          {readSearchParam(resolvedSearchParams, "rosterRoleError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "rosterRoleError")}</p>
          ) : null}
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {currentSeasonForSelectedProgram
            ? `Season defaults to current season: ${currentSeasonForSelectedProgram.name}.`
            : "Select a season to continue."}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          This workflow preserves lifecycle status, role assignments, guardian relationships, and existing operational records.
        </p>

        <FormActions submitLabel="Move member" cancelHref={`/people/${person.id}`} />
      </form>
    </section>
  );
}
