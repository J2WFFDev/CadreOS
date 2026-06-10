import { HabitFrequency, HabitStatus } from "@prisma/client";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FilterTabs } from "@/components/dashboard/filter-tabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { canCreateHabit, canReadHabit, resolveHabitAccessContext } from "@/lib/habits/access";
import { habitAccessErrorMessage } from "@/lib/habits/access-feedback";
import { badgeVariantForHabitStatus, labelForHabitCadence, labelForHabitStatus } from "@/lib/habits/policy";
import { formatShortDateTime } from "@/lib/format-date";
import { getOrganizationScope } from "@/lib/organization-context";
import { db } from "@/lib/db";
import { describeSchemaUnavailableError, isSchemaUnavailableError } from "@/lib/workflows";

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
        <PageHeader title="Habit Library" description="Create and manage recurring behaviors without creating Tasks for check-ins." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load habits right now."} />
      </section>
    );
  }

  const statusFilter = normalizeStatusFilter(params.status);
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const accessErrorMessage = habitAccessErrorMessage(errorCode ?? null);

  const whereStatus =
    statusFilter === "active"
      ? { status: HabitStatus.ACTIVE }
      : statusFilter === "paused"
        ? { status: HabitStatus.PAUSED }
        : statusFilter === "archived"
          ? { status: HabitStatus.ARCHIVED }
          : {};

  let accessContext:
    | Awaited<ReturnType<typeof resolveHabitAccessContext>>
    | null = null;
  let habits:
    | Array<{
        id: string;
        title: string;
        description: string | null;
        status: HabitStatus;
        athletePersonId: string;
        assignedToTeamId: string | null;
        createdByPersonId: string;
        createdAt: Date;
        updatedAt: Date;
        lastCompletedAt: Date | null;
        athlete: { firstName: string; lastName: string };
        assignedToTeam: { name: string; programId: string } | null;
        schedules: Array<{ frequency: HabitFrequency; daysOfWeek: string | null }>;
        _count: { completions: number };
      }>
    | null = null;
  let loadErrorMessage: string | null = null;

  try {
    accessContext = await resolveHabitAccessContext({
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
    });

    habits = await db.habit.findMany({
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
        lastCompletedAt: true,
        athlete: { select: { firstName: true, lastName: true } },
        assignedToTeam: { select: { name: true, programId: true } },
        schedules: { select: { frequency: true, daysOfWeek: true }, take: 1, orderBy: { createdAt: "asc" } },
        _count: { select: { completions: true } },
      },
      take: HABIT_LIST_LIMIT,
    });
  } catch (error) {
    const detail = describeSchemaUnavailableError(error);
    loadErrorMessage = isSchemaUnavailableError(error)
      ? `Habits are currently unavailable because ${detail ?? "required habit tables/columns are missing"}.`
      : "Unable to load habits right now.";
    console.error("[habits.page] Failed to load habits", {
      organizationId: scope.organizationId,
      actorPersonId: scope.auth.personId,
      schemaDetail: detail,
      error,
    });
  }

  if (!accessContext || !habits) {
    return (
      <section className="space-y-4">
        <PageHeader title="Habit Library" description="Create and manage recurring behaviors without creating Tasks for check-ins." />
        <ErrorMessage message={loadErrorMessage ?? "Unable to load habits right now."} />
      </section>
    );
  }

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
        title="Habit Library"
        description="Create and manage Habit definitions. Check-ins stay in activity/history and do not create Tasks."
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
      {accessErrorMessage ? <ErrorMessage message={accessErrorMessage} /> : null}

      {visibleHabits.length === 0 ? (
        <EmptyState
          message="No habits are visible for the selected filter and your current access."
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
                <th className="px-4 py-3 font-medium">Last check-in</th>
                <th className="px-4 py-3 font-medium">Context / List</th>
                <th className="px-4 py-3 font-medium">Visibility</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {visibleHabits.map((habit) => {
                const athleteName = `${habit.athlete.firstName} ${habit.athlete.lastName}`.trim() || "Unknown";
                const schedule = habit.schedules[0] ?? null;
                return (
                  <tr key={habit.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/habits/${habit.id}`} className="underline">
                        {habit.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{athleteName}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {labelForHabitCadence({
                        frequency: schedule?.frequency ?? null,
                        daysOfWeek: schedule?.daysOfWeek ?? null,
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {habit.lastCompletedAt ? formatShortDateTime(habit.lastCompletedAt) : "No check-ins"}
                      <p className="text-xs text-zinc-500">{habit._count.completions} total</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Not modeled for Habits</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">Habit access policy</td>
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
