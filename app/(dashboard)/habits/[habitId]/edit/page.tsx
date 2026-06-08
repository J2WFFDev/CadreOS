import { HabitFrequency, HabitTrackingMode } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { canEditHabit, resolveHabitAccessContext } from "@/lib/habits/access";
import { MAX_HABIT_DESCRIPTION_LENGTH, MAX_HABIT_TITLE_LENGTH } from "@/lib/habits/policy";
import { getOrganizationScope } from "@/lib/organization-context";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function EditHabitPage({ params }: { params: Promise<{ habitId: string }> }) {
  const { habitId } = await params;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Edit Habit" description="Update this habit." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load page right now."} />
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
      trackingMode: true,
      targetCount: true,
      targetUnit: true,
      schedules: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true, frequency: true, daysOfWeek: true, startDate: true, endDate: true } },
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
  };

  if (!canEditHabit(accessContext, habitRecord)) {
    return (
      <section className="space-y-4">
        <PageHeader title="Edit Habit" description="Update this habit." />
        <ErrorMessage message="You do not have permission to edit this habit." />
        <Link href={`/habits/${habitId}`} className="text-sm underline">Back to habit</Link>
      </section>
    );
  }

  const [athletes, teams] = await Promise.all([
    db.person.findMany({
      where: {
        organizationId: scope.organizationId,
        roles: { some: { roleType: "ATHLETE", organizationId: scope.organizationId } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    db.team.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const schedule = habit.schedules[0];

  return (
    <section className="space-y-4">
      <PageHeader
        title="Edit Habit"
        description="Update this habit's title, description, tracking mode, cadence, or assignment."
        actions={
          <Link href={`/habits/${habitId}`} className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Cancel
          </Link>
        }
      />

      <form method="POST" action={`/habits/${habitId}/edit/update`} className="space-y-5 rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <div className="space-y-1">
          <label htmlFor="title" className="block text-sm font-medium">Habit title <span className="text-red-500">*</span></label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={habit.title}
            maxLength={MAX_HABIT_TITLE_LENGTH}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="description" className="block text-sm font-medium">Description <span className="text-zinc-400">(optional)</span></label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={MAX_HABIT_DESCRIPTION_LENGTH}
            defaultValue={habit.description ?? ""}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="athletePersonId" className="block text-sm font-medium">Athlete <span className="text-red-500">*</span></label>
          <select
            id="athletePersonId"
            name="athletePersonId"
            required
            defaultValue={habit.athletePersonId}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">— Select athlete —</option>
            {athletes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.firstName} {a.lastName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="assignedToTeamId" className="block text-sm font-medium">Team / Program <span className="text-zinc-400">(optional)</span></label>
          <select
            id="assignedToTeamId"
            name="assignedToTeamId"
            defaultValue={habit.assignedToTeamId ?? ""}
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">— No team assignment —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <fieldset className="space-y-3 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Tracking mode</legend>

          <div className="space-y-1">
            <label htmlFor="trackingMode" className="block text-sm font-medium">How is completion tracked?</label>
            <select
              id="trackingMode"
              name="trackingMode"
              defaultValue={habit.trackingMode ?? HabitTrackingMode.CHECKOFF}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value={HabitTrackingMode.CHECKOFF}>Checkoff - record one check-in per day</option>
              <option value={HabitTrackingMode.COUNT}>Count - record one numeric check-in per day</option>
              <option value={HabitTrackingMode.NOTES}>Notes - record one note-based check-in per day</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="targetCount" className="block text-sm font-medium">Target count <span className="text-zinc-400">(optional, Count mode)</span></label>
              <input
                id="targetCount"
                name="targetCount"
                type="number"
                min={1}
                defaultValue={habit.targetCount ?? ""}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="targetUnit" className="block text-sm font-medium">Unit <span className="text-zinc-400">(optional, e.g. reps, minutes)</span></label>
              <input
                id="targetUnit"
                name="targetUnit"
                type="text"
                defaultValue={habit.targetUnit ?? ""}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Cadence</legend>
          <div className="space-y-1">
            <label htmlFor="frequency" className="block text-sm font-medium">Frequency</label>
            <select
              id="frequency"
              name="frequency"
              defaultValue={schedule?.frequency ?? ""}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">— No set cadence —</option>
              <option value={HabitFrequency.DAILY}>Daily</option>
              <option value={HabitFrequency.WEEKLY}>Weekly</option>
              <option value={HabitFrequency.CUSTOM}>Custom</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="daysOfWeek" className="block text-sm font-medium">Weekly days <span className="text-zinc-400">(MON,WED,FRI)</span></label>
            <input
              id="daysOfWeek"
              name="daysOfWeek"
              type="text"
              defaultValue={schedule?.daysOfWeek ?? ""}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="startDate" className="block text-sm font-medium">Start date</label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={schedule?.startDate ? schedule.startDate.toISOString().slice(0, 10) : ""}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="endDate" className="block text-sm font-medium">End date <span className="text-zinc-400">(optional)</span></label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={schedule?.endDate ? schedule.endDate.toISOString().slice(0, 10) : ""}
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          </div>
          {schedule ? <input type="hidden" name="scheduleId" value={schedule.id} /> : null}
        </fieldset>

        <div className="flex justify-end gap-3">
          <Link href={`/habits/${habitId}`} className="rounded-md border px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">Cancel</Link>
          <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Save changes
          </button>
        </div>
      </form>
    </section>
  );
}
