import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Metric = {
  label: string;
  value: number;
};

export default async function DashboardPage() {
  const [organizationCount, programCount, teamCount, peopleCount] = await Promise.all([
    db.organization.count(),
    db.program.count(),
    db.team.count(),
    db.person.count(),
  ]);

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
        <p className="text-sm">
          Auth provider integration and real permission enforcement will be implemented in a later phase.
        </p>
      </div>
    </section>
  );
}
