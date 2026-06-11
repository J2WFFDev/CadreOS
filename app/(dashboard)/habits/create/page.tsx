import Link from "next/link";

import { ErrorMessage } from "@/components/dashboard/error-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { canAssignHabitToOthers, canCreateHabit, resolveHabitAccessContext } from "@/lib/habits/access";
import { getHabitCreateErrorMessage } from "@/lib/habits/create";
import {
  HABIT_TARGET_UNIT_OPTIONS,
  HABIT_WEEKDAY_OPTIONS,
  MAX_HABIT_DESCRIPTION_LENGTH,
  MAX_HABIT_TITLE_LENGTH,
} from "@/lib/habits/policy";
import { getOrganizationScope } from "@/lib/organization-context";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CreateHabitPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const scope = await getOrganizationScope();
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const createErrorMessage = getHabitCreateErrorMessage(errorCode ?? null);

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

  const canAssignOthers = canAssignHabitToOthers(accessContext);
  const [athletes, teams] = await Promise.all([
    canAssignOthers ? db.person.findMany({
      where: {
        organizationId: scope.organizationId,
        roles: { some: { roleType: "ATHLETE", organizationId: scope.organizationId } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }) : Promise.resolve([]),
    canAssignOthers ? db.team.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }) : Promise.resolve([]),
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

      {createErrorMessage ? <ErrorMessage message={createErrorMessage} /> : null}

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

        {canAssignOthers ? (
          <>
            <div className="space-y-1">
              <label htmlFor="athletePersonId" className="block text-sm font-medium">Assigned Athlete <span className="text-red-500">*</span></label>
              <select id="athletePersonId" name="athletePersonId" required className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800">
                <option value="">— Select athlete —</option>
                {athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{athlete.firstName} {athlete.lastName}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="assignedToTeamId" className="block text-sm font-medium">Existing team assignment <span className="text-zinc-400">(optional)</span></label>
              <select id="assignedToTeamId" name="assignedToTeamId" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800">
                <option value="">— No team assignment —</option>
                {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
              <p className="text-xs text-zinc-500">This uses the existing single-team Habit assignment. It does not fan out or create Habits for team members.</p>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <input type="hidden" name="athletePersonId" value={scope.auth.personId ?? ""} />
            <p className="text-sm font-medium">Assigned Athlete</p>
            <p className="text-sm">You</p>
            <p className="text-xs text-zinc-500">Athlete self-service Habits are created for yourself and cannot be assigned to a team.</p>
          </div>
        )}

        <fieldset className="space-y-3 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Tracking mode</legend>

          <div className="space-y-1">
            <label htmlFor="trackingMode" className="block text-sm font-medium">How is completion tracked?</label>
            <select
              id="trackingMode"
              name="trackingMode"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="CHECKOFF">Checkoff - record one check-in per day</option>
              <option value="COUNT">Count - record one numeric check-in per day</option>
              <option value="NOTES">Notes - record one note-based check-in per day</option>
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
              <label htmlFor="targetUnitOption" className="block text-sm font-medium">Unit <span className="text-zinc-400">(optional)</span></label>
              <select id="targetUnitOption" name="targetUnitOption" className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800">
                <option value="">— Select unit —</option>
                {HABIT_TARGET_UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-md border p-4">
          <legend className="px-1 text-sm font-medium">Cadence <span className="text-zinc-400">(optional)</span></legend>

          <div className="space-y-1">
            <label htmlFor="frequency" className="block text-sm font-medium">Frequency</label>
            <select
              id="frequency"
              name="frequency"
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">— No set cadence —</option>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>

          <div className="space-y-2">
            <p className="block text-sm font-medium">Weekly days</p>
            <div className="flex flex-wrap gap-3">
              {HABIT_WEEKDAY_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="daysOfWeek" value={option.value} />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="startDate" className="block text-sm font-medium">Start date <span className="text-zinc-400">(defaults to today when cadence is set)</span></label>
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
