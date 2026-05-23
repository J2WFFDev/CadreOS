import { ScopeType } from "@prisma/client";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function TeamDetailsPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
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
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No organization context is available yet.
          </p>
        </div>
      </section>
    );
  }

  let queryFailed = false;
  let team:
    | {
        id: string;
        name: string;
        program: { id: string; name: string };
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

  try {
    team = await db.team.findFirst({
      where: {
        id: teamId,
        organizationId: scope.organizationId,
      },
      include: {
        program: {
          select: { id: true, name: true },
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
    });
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
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Team not found in the selected organization.
          </p>
        </div>
      </section>
    );
  }

  const now = new Date();
  const activeRosterMembership = team.roster.find((membership) => {
    if (!membership.season.startDate) {
      return false;
    }

    if (membership.season.startDate > now) {
      return false;
    }

    if (membership.season.endDate && membership.season.endDate < now) {
      return false;
    }

    return true;
  });

  const demoRosterMembership = team.roster.find((membership) =>
    membership.season.name.toLowerCase().includes("demo"),
  );

  const selectedSeasonId =
    activeRosterMembership?.season.id ?? demoRosterMembership?.season.id ?? team.roster[0]?.season.id;
  const selectedSeasonName = team.roster.find((membership) => membership.season.id === selectedSeasonId)?.season.name;
  const selectedSeasonRosterMembers = team.roster.filter((membership) => membership.season.id === selectedSeasonId);

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{team.name}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Program: {team.program.name}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organization: {scope.organizationName ?? scope.organizationId}
        </p>
      </div>

      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="mb-3 text-lg font-medium">Roster members</h3>
        <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
          Season: {selectedSeasonName ?? "No season available"}
        </p>
        {selectedSeasonRosterMembers.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No roster members found for the active/demo season.
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
