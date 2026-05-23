import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function PersonDetailsPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
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

  try {
    const person = await db.person.findFirst({
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
              },
            },
          },
          orderBy: [{ scopeType: "asc" }, { roleType: "asc" }],
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
    });

    if (!person) {
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

    return (
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            {person.firstName} {person.lastName}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{person.email ?? "No email on file"}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Organization: {scope.organizationName ?? scope.organizationId}
          </p>
        </div>

        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h3 className="mb-3 text-lg font-medium">Role assignments</h3>
          {person.roles.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No role assignments.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {person.roles.map((role) => (
                <li key={role.id}>
                  {formatEnumLabel(role.roleType)} · {formatEnumLabel(role.scopeType)}
                  {role.program ? ` · Program: ${role.program.name}` : ""}
                  {role.team ? ` · Team: ${role.team.name}` : ""}
                </li>
              ))}
            </ul>
          )}
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
  } catch {
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
}
