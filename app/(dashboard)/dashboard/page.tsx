import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Metric = {
  label: string;
  value: number;
};

export default async function DashboardPage() {
  let databaseReady = true;
  let organizationCount = 0;
  let programCount = 0;
  let teamCount = 0;
  let peopleCount = 0;

  try {
    [organizationCount, programCount, teamCount, peopleCount] = await Promise.all([
      db.organization.count(),
      db.program.count(),
      db.team.count(),
      db.person.count(),
    ]);
  } catch (error) {
    const isMissingSchemaError =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022");

    if (isMissingSchemaError) {
      databaseReady = false;
    } else {
      throw error;
    }
  }

  const metrics: Metric[] = [
    { label: "Organizations", value: organizationCount },
    { label: "Programs", value: programCount },
    { label: "Teams", value: teamCount },
    { label: "People", value: peopleCount },
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Welcome to CadreOS</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Dashboard shell is active with authentication deferred for Phase 0 and now reads real database
        counts for Phase 1A.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <h3 className="text-base font-medium">Read-only views</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/people" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            People
          </Link>
          <Link href="/programs" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Programs
          </Link>
          <Link href="/teams" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Teams
          </Link>
          <Link href="/events" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Events
          </Link>
          <Link href="/tasks" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Tasks
          </Link>
          <Link href="/notes" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Notes
          </Link>
        </div>
      </div>
      <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
        <p className="text-sm">
          Auth provider integration and real permission enforcement will be implemented in a later phase.
        </p>
      </div>
      {!databaseReady ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Database is reachable, but application tables are not available yet. Run Prisma migrations to
            initialize the schema.
          </p>
        </div>
      ) : null}
    </section>
  );
}
