import Link from "next/link";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Programs</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to query programs right now."}
          </p>
        </div>
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

  try {
    const programs = await db.program.findMany({
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
      },
      orderBy: { name: "asc" },
    });

    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Programs</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Organization: {scope.organizationName ?? scope.organizationId}
          </p>
        </div>

        {programs.length === 0 ? (
          <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No programs found for this organization.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {programs.map((program) => (
              <div key={program.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <p className="text-lg font-medium">{program.name}</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Organization: {program.organization.name}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Team count: {program._count.teams}
                </p>
                <Link href="/teams" className="mt-3 inline-block text-sm underline">
                  View teams
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  } catch {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Programs</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load programs right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }
}
