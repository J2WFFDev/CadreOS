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

  let programs:
    | Array<{
        id: string;
        name: string;
        organization: { id: string; name: string };
        _count: { teams: number };
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
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load programs right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Programs</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Organize your programs, seasons, and team groupings.
          </p>
        </div>
        <Link href="/programs/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
          New program
        </Link>
      </div>

      {programs.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 text-center dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No programs have been created yet.</p>
          <Link
            href="/programs/new"
            className="mt-3 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Create the first program
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {programs.map((program) => (
            <div key={program.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <Link href={`/programs/${program.id}`} className="text-lg font-medium underline">
                {program.name}
              </Link>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Organization: {program.organization.name}
              </p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Team count: {program._count.teams}</p>
              <Link href={`/programs/${program.id}`} className="mt-3 inline-block text-sm underline">
                View program details
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
