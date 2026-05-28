import { HabitFrequency, HabitStatus } from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { canCreateHabit, canReadHabit, resolveHabitAccessContext } from "@/lib/habits/access";
import { labelForHabitFrequency, labelForHabitStatus } from "@/lib/habits/policy";
import { getOrganizationScope } from "@/lib/organization-context";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
const HABIT_LIST_LIMIT = 300;

function normalizeStatusFilter(rawStatus: string | string[] | undefined): "active" | "paused" | "archived" | "all" {
  const value = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;
  if (value === "paused") return "paused";
  if (value === "archived") return "archived";
  if (value === "all") return "all";
  return "active";
}

function badgeClasses(status: HabitStatus): string {
  if (status === HabitStatus.ACTIVE) return "inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300";
  if (status === HabitStatus.PAUSED) return "inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  return "inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
}

export default async function HabitsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const scope = await getOrganizationScope();
  const params = await searchParams;

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Habits" description="Track recurring behaviors and check-in history." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load habits right now."} />
      </section>
    );
  }

  const accessContext = await resolveHabitAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  const statusFilter = normalizeStatusFilter(params.status);

  const whereStatus =
    statusFilter === "active"
      ? { status: HabitStatus.ACTIVE }
      : statusFilter === "paused"
        ? { status: HabitStatus.PAUSED }
        : statusFilter === "archived"
          ? { status: HabitStatus.ARCHIVED }
          : {};

  const habits = await db.habit.findMany({
    where: { organizationId: scope.organizationId, ...whereStatus },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      athletePersonId: true,
      assignedToTeamId: true,
      createdByPersonId: true,
      createdAt: true,
      updatedAt: true,
      athlete: { select: { firstName: true, lastName: true } },
      assignedToTeam: { select: { name: true, programId: true } },
      schedules: { select: { frequency: true }, take: 1, orderBy: { createdAt: "asc" } },
      _count: { select: { completions: true } },
    },
    take: HABIT_LIST_LIMIT,
  });

  const visibleHabits = habits.filter((h) =>
    canReadHabit(accessContext, {
      id: h.id,
      athletePersonId: h.athletePersonId,
      assignedToTeamId: h.assignedToTeamId,
      createdByPersonId: h.createdByPersonId,
      status: h.status,
      teamProgramId: h.assignedToTeam?.programId ?? null,
    }),
  );

  const canCreate = canCreateHabit(accessContext);

  const tabBase =
    "rounded-md border px-3 py-1.5 text-sm";
  const tabActive = `${tabBase} bg-zinc-100 dark:bg-zinc-800`;
  const tabInactive = `${tabBase} hover:bg-zinc-50 dark:hover:bg-zinc-800`;

  return (
    <section className="space-y-4">
      <PageHeader
        title="Habits"
        description="Track recurring behaviors, check-ins, and completion streaks."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/habits?status=active" aria-current={statusFilter === "active" ? "page" : undefined} className={statusFilter === "active" ? tabActive : tabInactive}>Active</Link>
            <Link href="/habits?status=paused" aria-current={statusFilter === "paused" ? "page" : undefined} className={statusFilter === "paused" ? tabActive : tabInactive}>Paused</Link>
            <Link href="/habits?status=archived" aria-current={statusFilter === "archived" ? "page" : undefined} className={statusFilter === "archived" ? tabActive : tabInactive}>Archived</Link>
            <Link href="/habits?status=all" aria-current={statusFilter === "all" ? "page" : undefined} className={statusFilter === "all" ? tabActive : tabInactive}>All</Link>
            {canCreate ? (
              <Link href="/habits/create" className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black">
                Create habit
              </Link>
            ) : null}
          </div>
        }
      />

      {visibleHabits.length === 0 ? (
        <EmptyState
          message="No habits are visible for the selected filter and your role scope."
          actionHref={canCreate ? "/habits/create" : "/dashboard"}
          actionLabel={canCreate ? "Create first habit" : "Back to dashboard"}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 font-medium">Habit</th>
                <th className="px-4 py-3 font-medium">Athlete</th>
                <th className="px-4 py-3 font-medium">Cadence</th>
                <th className="px-4 py-3 font-medium">Check-ins</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {visibleHabits.map((habit) => {
                const athleteName = `${habit.athlete.firstName} ${habit.athlete.lastName}`.trim() || "Unknown";
                const frequency = habit.schedules[0]?.frequency as HabitFrequency | undefined;
                return (
                  <tr key={habit.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/habits/${habit.id}`} className="underline">
                        {habit.title}
                      </Link>
                      {habit.assignedToTeam?.name ? (
                        <p className="text-xs text-zinc-500">Team: {habit.assignedToTeam.name}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{athleteName}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {frequency ? labelForHabitFrequency(frequency) : <span className="text-zinc-400">—</span>}
                    </td>
                    <td className="px-4 py-3">{habit._count.completions}</td>
                    <td className="px-4 py-3">
                      <span className={badgeClasses(habit.status)}>{labelForHabitStatus(habit.status)}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{habit.updatedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
