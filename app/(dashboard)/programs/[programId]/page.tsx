import { ScopeType } from "@prisma/client";
import Link from "next/link";

import { BackLink } from "@/components/dashboard/back-link";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

function formatEnumLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function ProgramDetailsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const scope = await getOrganizationScope();

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
        seasons: Array<{ id: string; name: string }>;
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
