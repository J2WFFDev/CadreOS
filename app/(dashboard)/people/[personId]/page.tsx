import { RoleType, ScopeType } from "@prisma/client";
import Link from "next/link";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function hasSearchParam(searchParams: SearchParams, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(searchParams, key);
}

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function PersonDetailsPage({
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
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query person details right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No organization context is available yet.
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
        email: string | null;
        phone: string | null;
        roles: Array<{
          id: string;
          roleType: string;
          scopeType: string;
          program: { id: string; name: string } | null;
          team: { id: string; name: string; program: { id: string; name: string } | null } | null;
        }>;
        guardianLinks: Array<{
          id: string;
          relationshipType: string;
          athlete: { id: string; firstName: string; lastName: string };
        }>;
        athleteLinks: Array<{
          id: string;
          relationshipType: string;
          guardian: { id: string; firstName: string; lastName: string };
        }>;
        roster: Array<{
          id: string;
          rosterRole: string;
          team: { id: string; name: string };
          season: { id: string; name: string };
        }>;
      }
    | null = null;
  let programs: Array<{ id: string; name: string }> = [];
  let teams: Array<{ id: string; name: string; program: { id: string; name: string } }> = [];

  try {
    [person, programs, teams] = await Promise.all([
      db.person.findFirst({
        where: {
          id: personId,
          organizationId: scope.organizationId,
        },
        include: {
          roles: {
            include: {
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
            orderBy: [{ scopeType: "asc" }, { roleType: "asc" }, { createdAt: "asc" }],
          },
          guardianLinks: {
            include: {
              athlete: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: {
              athlete: {
                lastName: "asc",
              },
            },
          },
          athleteLinks: {
            include: {
              guardian: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: {
              guardian: {
                lastName: "asc",
              },
            },
          },
          roster: {
            include: {
              team: {
                select: { id: true, name: true },
              },
              season: {
                select: { id: true, name: true },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      }),
      db.program.findMany({
        where: {
          organizationId: scope.organizationId,
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
    ]);
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load person details right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  if (person === null) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Person</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Person not found in the selected organization.
          </p>
        </div>
      </section>
    );
  }

  const roleError = readSearchParam(resolvedSearchParams, "roleError");
  const roleTypeError = readSearchParam(resolvedSearchParams, "roleTypeError");
  const scopeTypeError = readSearchParam(resolvedSearchParams, "scopeTypeError");
  const programIdError = readSearchParam(resolvedSearchParams, "programIdError");
  const teamIdError = readSearchParam(resolvedSearchParams, "teamIdError");

  const selectedRoleType = (readSearchParam(resolvedSearchParams, "roleType") || RoleType.ATHLETE) as RoleType;
  const selectedScopeType = (readSearchParam(resolvedSearchParams, "scopeType") || ScopeType.ORGANIZATION) as ScopeType;
  const selectedProgramId = hasSearchParam(resolvedSearchParams, "programId")
    ? readSearchParam(resolvedSearchParams, "programId")
    : "";
  const selectedTeamId = hasSearchParam(resolvedSearchParams, "teamId")
    ? readSearchParam(resolvedSearchParams, "teamId")
    : "";

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <Link href="/people" className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
          ← People
        </Link>
        <h2 className="text-2xl font-semibold tracking-tight">
          {person.firstName} {person.lastName}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{person.email ?? "No email on file"}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{person.phone ?? "No phone on file"}</p>
        <Link href={`/people/${person.id}/edit`} className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
          Edit person
        </Link>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Role assignments</h3>
        {person.roles.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No role assignments.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {person.roles.map((role) => (
              <li key={role.id} className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 last:border-b-0 last:pb-0">
                <span>
                  {formatEnumLabel(role.roleType)} · {formatEnumLabel(role.scopeType)}
                  {role.scopeType === ScopeType.PROGRAM
                    ? ` · Program: ${role.program?.name ?? "Unknown program"}`
                    : ""}
                  {role.scopeType === ScopeType.TEAM
                    ? ` · Team: ${role.team?.name ?? "Unknown team"}${role.team?.program?.name ? ` (${role.team.program.name})` : ""}`
                    : ""}
                </span>
                <form action={`/people/${person.id}/roles/${role.id}/delete`} method="post">
                  <button type="submit" className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40">
                    Remove role
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div id="assign-role" className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Assign role</h3>

        {roleError ? <p className="mb-3 text-sm text-red-600">{roleError}</p> : null}

        <form action={`/people/${person.id}/roles/create`} method="post" className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="roleType" className="text-sm font-medium">
              Role type
            </label>
            <select id="roleType" name="roleType" defaultValue={selectedRoleType} className="w-full rounded-md border px-3 py-2 text-sm">
              {Object.values(RoleType).map((roleType) => (
                <option key={roleType} value={roleType}>
                  {formatEnumLabel(roleType)}
                </option>
              ))}
            </select>
            {roleTypeError ? <p className="text-sm text-red-600">{roleTypeError}</p> : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="scopeType" className="text-sm font-medium">
              Scope type
            </label>
            <select id="scopeType" name="scopeType" defaultValue={selectedScopeType} className="w-full rounded-md border px-3 py-2 text-sm">
              {Object.values(ScopeType).map((scopeType) => (
                <option key={scopeType} value={scopeType}>
                  {formatEnumLabel(scopeType)}
                </option>
              ))}
            </select>
            {scopeTypeError ? <p className="text-sm text-red-600">{scopeTypeError}</p> : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="programId" className="text-sm font-medium">
              Program (required for PROGRAM scope)
            </label>
            <select id="programId" name="programId" defaultValue={selectedProgramId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No program</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </select>
            {programIdError ? <p className="text-sm text-red-600">{programIdError}</p> : null}
          </div>

          <div className="space-y-1">
            <label htmlFor="teamId" className="text-sm font-medium">
              Team (required for TEAM scope)
            </label>
            <select id="teamId" name="teamId" defaultValue={selectedTeamId} className="w-full rounded-md border px-3 py-2 text-sm">
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.program.name} · {team.name}
                </option>
              ))}
            </select>
            {teamIdError ? <p className="text-sm text-red-600">{teamIdError}</p> : null}
          </div>

          <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Assign role
          </button>
        </form>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Guardian / athlete relationships</h3>
        {person.guardianLinks.length === 0 && person.athleteLinks.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No guardian/athlete relationships.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {person.guardianLinks.length > 0 ? (
              <div>
                <p className="font-medium">Guardian for</p>
                <ul className="mt-1 list-disc pl-5">
                  {person.guardianLinks.map((link) => (
                    <li key={link.id}>
                      {link.athlete.firstName} {link.athlete.lastName} ({formatEnumLabel(link.relationshipType)})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {person.athleteLinks.length > 0 ? (
              <div>
                <p className="font-medium">Athlete linked to guardians</p>
                <ul className="mt-1 list-disc pl-5">
                  {person.athleteLinks.map((link) => (
                    <li key={link.id}>
                      {link.guardian.firstName} {link.guardian.lastName} ({formatEnumLabel(link.relationshipType)})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Roster memberships</h3>
        {person.roster.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No roster memberships.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {person.roster.map((membership) => (
              <li key={membership.id}>
                Team: {membership.team.name} · Season: {membership.season.name} · Role:{" "}
                {formatEnumLabel(membership.rosterRole)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
