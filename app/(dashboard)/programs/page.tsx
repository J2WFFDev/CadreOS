import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Programs</h2>
        <ErrorMessage message={scope.errorMessage ?? "Unable to query programs right now."} />
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
        <ErrorMessage message="Unable to load programs right now. Please try again later." />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Programs"
        description="Organize your programs, seasons, and team groupings."
        actions={
          <Link href="/programs/new" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
            New program
          </Link>
        }
      />

      {programs.length === 0 ? (
        <EmptyState message="No programs have been created yet." actionHref="/programs/new" actionLabel="Create the first program" />
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
