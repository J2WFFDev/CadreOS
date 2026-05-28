import { HabitStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/dashboard/empty-state";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  canArchiveHabit,
  canCheckInHabit,
  canEditHabit,
  canPauseHabit,
  canReadCompletionDetail,
  canReadHabit,
  resolveHabitAccessContext,
} from "@/lib/habits/access";
import {
  badgeVariantForHabitStatus,
  computeCompletionCount,
  computeCurrentStreak,
  labelForHabitFrequency,
  labelForHabitStatus,
  MAX_CHECKIN_NOTE_LENGTH,
} from "@/lib/habits/policy";
import { getOrganizationScope } from "@/lib/organization-context";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HabitDetailPage({ params }: { params: Promise<{ habitId: string }> }) {
  const { habitId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Habit" description="Recurring behavior check-in." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load habit right now."} />
      </section>
    );
  }

  const habit = await db.habit.findFirst({
    where: { id: habitId, organizationId: scope.organizationId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      athletePersonId: true,
      assignedToTeamId: true,
      createdByPersonId: true,
      archivedAt: true,
      pausedAt: true,
      createdAt: true,
      updatedAt: true,
      athlete: { select: { firstName: true, lastName: true } },
      assignedToTeam: { select: { name: true, programId: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      schedules: {
        orderBy: { createdAt: "asc" },
        select: { id: true, frequency: true, daysOfWeek: true, startDate: true, endDate: true },
      },
      completions: {
        orderBy: { completedOn: "desc" },
        select: { id: true, completedOn: true, note: true, athletePersonId: true },
      },
    },
  });

  if (!habit) notFound();

  const accessContext = await resolveHabitAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  const habitRecord = {
    id: habit.id,
    athletePersonId: habit.athletePersonId,
    assignedToTeamId: habit.assignedToTeamId,
    createdByPersonId: habit.createdByPersonId,
    status: habit.status,
    teamProgramId: habit.assignedToTeam?.programId ?? null,
  };

  if (!canReadHabit(accessContext, habitRecord)) notFound();

  const canEdit = canEditHabit(accessContext, habitRecord);
  const canArchive = canArchiveHabit(accessContext, habitRecord);
  const canPause = canPauseHabit(accessContext, habitRecord);
  const canCheckIn = canCheckInHabit(accessContext, habitRecord);
  const showCompletionDetail = canReadCompletionDetail(accessContext, habitRecord);

  const completionDates = habit.completions.map((c) => c.completedOn);
  const frequency = habit.schedules[0]?.frequency;
  const currentStreak = frequency ? computeCurrentStreak(completionDates, frequency) : null;
  const completionCount = computeCompletionCount(completionDates);

  const athleteName = `${habit.athlete.firstName} ${habit.athlete.lastName}`.trim() || "Unknown";
  const creatorName = `${habit.createdBy.firstName} ${habit.createdBy.lastName}`.trim() || "Unknown";

  return (
    <section className="space-y-6">
      <PageHeader
        title={habit.title}
        description={habit.description ?? "Recurring behavior / check-in target"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <Link href={`/habits/${habit.id}/edit`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                Edit
              </Link>
            ) : null}
            {canPause && habit.status === HabitStatus.ACTIVE ? (
              <form method="POST" action={`/habits/${habit.id}/pause`} className="inline">
                <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  Pause
                </button>
              </form>
            ) : null}
            {canPause && habit.status === HabitStatus.PAUSED ? (
              <form method="POST" action={`/habits/${habit.id}/pause`} className="inline">
                <input type="hidden" name="resume" value="true" />
                <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
                  Resume
                </button>
              </form>
            ) : null}
            {canArchive ? (
              <form method="POST" action={`/habits/${habit.id}/archive`} className="inline">
                <button
                  type="submit"
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
                  onClick={(e) => {
                    if (!confirm("Archive this habit? Completions will be preserved.")) e.preventDefault();
                  }}
                >
                  Archive
                </button>
              </form>
            ) : null}
            <Link href="/habits" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
              All habits
            </Link>
          </div>
        }
      />

      {/* Metadata card */}
      <div className="rounded-lg border bg-white p-5 dark:bg-zinc-900">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</dt>
            <dd className="mt-1"><StatusBadge variant={badgeVariantForHabitStatus(habit.status)} label={labelForHabitStatus(habit.status)} /></dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Athlete</dt>
            <dd className="mt-1 text-sm">{athleteName}</dd>
          </div>
          {habit.assignedToTeam ? (
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Team</dt>
              <dd className="mt-1 text-sm">{habit.assignedToTeam.name}</dd>
            </div>
          ) : null}
          {frequency ? (
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Cadence</dt>
              <dd className="mt-1 text-sm">{labelForHabitFrequency(frequency)}</dd>
            </div>
          ) : null}
          {habit.schedules[0]?.daysOfWeek ? (
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Days</dt>
              <dd className="mt-1 text-sm">{habit.schedules[0].daysOfWeek}</dd>
            </div>
          ) : null}
          {habit.schedules[0]?.startDate ? (
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Start date</dt>
              <dd className="mt-1 text-sm">{habit.schedules[0].startDate.toISOString().slice(0, 10)}</dd>
            </div>
          ) : null}
          {habit.schedules[0]?.endDate ? (
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">End date</dt>
              <dd className="mt-1 text-sm">{habit.schedules[0].endDate.toISOString().slice(0, 10)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total check-ins</dt>
            <dd className="mt-1 text-sm font-semibold">{completionCount}</dd>
          </div>
          {currentStreak !== null ? (
            <div>
              <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Current streak</dt>
              <dd className="mt-1 text-sm font-semibold">{currentStreak} {frequency === "DAILY" ? "day(s)" : frequency === "WEEKLY" ? "week(s)" : ""}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Created by</dt>
            <dd className="mt-1 text-sm">{creatorName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Created</dt>
            <dd className="mt-1 text-sm text-zinc-500">{habit.createdAt.toISOString().slice(0, 10)}</dd>
          </div>
        </dl>
      </div>

      {/* Check-in form */}
      {canCheckIn ? (
        <div className="rounded-lg border bg-white p-5 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold">Record a check-in</h2>
          <form method="POST" action={`/habits/${habit.id}/check-in`} className="space-y-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="completedOn" className="block text-sm font-medium">Date <span className="text-red-500">*</span></label>
                <input
                  id="completedOn"
                  name="completedOn"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="note" className="block text-sm font-medium">Note <span className="text-zinc-400">(optional)</span></label>
                <input
                  id="note"
                  name="note"
                  type="text"
                  maxLength={MAX_CHECKIN_NOTE_LENGTH}
                  placeholder="Optional note about this check-in"
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
                Record check-in
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Completion history */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Completion history</h2>
        {habit.completions.length === 0 ? (
          <EmptyState
            message="No check-ins recorded yet."
            actionHref={canCheckIn ? undefined : undefined}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b bg-zinc-50 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  {showCompletionDetail ? <th className="px-4 py-3 font-medium">Note</th> : null}
                </tr>
              </thead>
              <tbody>
                {habit.completions.map((completion) => (
                  <tr key={completion.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{completion.completedOn.toISOString().slice(0, 10)}</td>
                    {showCompletionDetail ? (
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {completion.note ?? <span className="text-zinc-400">—</span>}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
