import { HabitFrequency, HabitStatus } from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FilterTabs } from "@/components/dashboard/filter-tabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { canCreateHabit, canReadHabit, resolveHabitAccessContext } from "@/lib/habits/access";
import { badgeVariantForHabitStatus, labelForHabitFrequency, labelForHabitStatus } from "@/lib/habits/policy";
import { formatShortDateTime } from "@/lib/format-date";
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

  return (
    <section className="space-y-4">
      <PageHeader
        title="Habits"
        description="Track recurring behaviors, check-ins, and completion streaks."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FilterTabs
              tabs={[
                { label: "Active", href: "/habits?status=active", value: "active" },
                { label: "Paused", href: "/habits?status=paused", value: "paused" },
                { label: "Archived", href: "/habits?status=archived", value: "archived" },
                { label: "All", href: "/habits?status=all", value: "all" },
              ]}
              activeValue={statusFilter}
            />
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
                      <StatusBadge variant={badgeVariantForHabitStatus(habit.status)} label={labelForHabitStatus(habit.status)} />
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{formatShortDateTime(habit.updatedAt)}</td>
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
