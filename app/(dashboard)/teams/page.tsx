import Link from "next/link";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Teams</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query teams right now."}
          </p>
        </div>
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
        program: { id: string; name: string };
      }>
    | null = null;

  try {
    teams = await db.team.findMany({
      where: { organizationId: scope.organizationId },
      include: {
        program: {
          select: { id: true, name: true },
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
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load teams right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Teams</h2>
        <div className="flex items-center gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Organization: {scope.organizationName ?? scope.organizationId}
          </p>
          <Link href="/teams/new" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            New team
          </Link>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No teams found for this organization.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <div key={team.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <p className="text-lg font-medium">{team.name}</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Program: {team.program.name}</p>
              <Link href={`/teams/${team.id}`} className="mt-3 inline-block text-sm underline">
                View team details
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
