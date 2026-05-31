import Link from "next/link";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { canCreateHabit, resolveHabitAccessContext } from "@/lib/habits/access";
import { MAX_HABIT_DESCRIPTION_LENGTH, MAX_HABIT_TITLE_LENGTH } from "@/lib/habits/policy";
import { getOrganizationScope } from "@/lib/organization-context";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CreateHabitPage() {
  const scope = await getOrganizationScope();

  if (!scope.databaseReady || !scope.organizationId) {
    return (
      <section className="space-y-4">
        <PageHeader title="Create Habit" description="Define a new recurring behavior or check-in target." />
        <ErrorMessage message={scope.errorMessage ?? "Unable to load page right now."} />
      </section>
    );
  }

  const accessContext = await resolveHabitAccessContext({
    organizationId: scope.organizationId,
    actorPersonId: scope.auth.personId,
  });

  if (!canCreateHabit(accessContext)) {
    return (
      <section className="space-y-4">
        <PageHeader title="Create Habit" description="Define a new recurring behavior or check-in target." />
        <ErrorMessage message="You do not have permission to create habits." />
        <Link href="/habits" className="text-sm underline">Back to habits</Link>
      </section>
    );
  }

  // Load athletes and teams for assignment fields
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

  return (
    <section className="space-y-4">
      <PageHeader
        title="Create Habit"
        description="Define a new recurring behavior or check-in target."
        actions={
          <Link href="/habits" className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">
            Cancel
          </Link>
        }
      />

      <form method="POST" action="/habits/create/save" className="space-y-5 rounded-lg border bg-white p-6 dark:bg-zinc-900">
        <div className="space-y-1">
          <label htmlFor="title" className="block text-sm font-medium">Habit title <span className="text-red-500">*</span></label>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={MAX_HABIT_TITLE_LENGTH}
            placeholder="e.g. Morning stretching routine"
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
            placeholder="Brief description of the habit goal or intent"
            className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="athletePersonId" className="block text-sm font-medium">Athlete <span className="text-red-500">*</span></label>
          <select
            id="athletePersonId"
            name="athletePersonId"
            required
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
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="CHECKOFF">Checkoff — mark as done</option>
              <option value="COUNT">Count — track a numeric value</option>
              <option value="NOTES">Notes — log a free-text entry</option>
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
                placeholder="e.g. 10"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="targetUnit" className="block text-sm font-medium">Unit <span className="text-zinc-400">(optional, e.g. reps, minutes)</span></label>
              <input
                id="targetUnit"
                name="targetUnit"
                type="text"
                placeholder="e.g. reps"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Recurrence / Cadence <span className="text-zinc-400">(optional)</span></legend>

          <div className="space-y-1">
            <label htmlFor="frequency" className="block text-sm font-medium">Frequency</label>
            <select
              id="frequency"
              name="frequency"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">— No schedule —</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="daysOfWeek" className="block text-sm font-medium">Days of week <span className="text-zinc-400">(comma-separated for Weekly, e.g. MON,WED,FRI)</span></label>
            <input
              id="daysOfWeek"
              name="daysOfWeek"
              type="text"
              placeholder="MON,WED,FRI"
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
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="endDate" className="block text-sm font-medium">End date <span className="text-zinc-400">(optional)</span></label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
          </div>
        </fieldset>

        <div className="flex justify-end gap-3">
          <Link href="/habits" className="rounded-md border px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">Cancel</Link>
          <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Create habit
          </button>
        </div>
      </form>
    </section>
  );
}
