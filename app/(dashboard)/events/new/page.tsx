import { EventStatus, EventType } from "@prisma/client";
import Link from "next/link";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const scope = await getOrganizationScope();
  const resolvedSearchParams = await searchParams;

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New event</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to load event creation right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New event</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let programs: Array<{ id: string; name: string }> | null = null;
  let teams: Array<{ id: string; name: string; program: { id: string; name: string } }> | null = null;

  try {
    [programs, teams] = await Promise.all([
      db.program.findMany({
        where: { organizationId: scope.organizationId },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }],
      }),
      db.team.findMany({
        where: { organizationId: scope.organizationId },
        select: {
          id: true,
          name: true,
          program: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ name: "asc" }],
      }),
    ]);
  } catch {
    programs = null;
    teams = null;
  }

  if (!programs || !teams) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">New event</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load programs and teams right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  const title = readSearchParam(resolvedSearchParams, "title");
  const eventType = readSearchParam(resolvedSearchParams, "eventType") || EventType.PRACTICE;
  const status = readSearchParam(resolvedSearchParams, "status") || EventStatus.DRAFT;
  const programId = readSearchParam(resolvedSearchParams, "programId") || programs[0]?.id || "";
  const teamId = readSearchParam(resolvedSearchParams, "teamId");
  const startsAt = readSearchParam(resolvedSearchParams, "startsAt");
  const endsAt = readSearchParam(resolvedSearchParams, "endsAt");
  const location = readSearchParam(resolvedSearchParams, "location");
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">New event</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organization: {scope.organizationName ?? scope.organizationId}
        </p>
      </div>

      {generalError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{generalError}</p>
        </div>
      ) : null}

      {programs.length === 0 ? (
        <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          Add at least one program before creating events.{" "}
          <Link href="/programs/new" className="underline">
            Create a program
          </Link>
          .
        </div>
      ) : (
        <form action="/events/create" method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Created-by attribution uses mock actor context and falls back to a seeded/admin organization person
            until real authentication-to-person resolution is implemented.
          </p>

          <div className="space-y-1">
            <label htmlFor="title" className="text-sm font-medium">
              Title
            </label>
            <input id="title" name="title" defaultValue={title} className="w-full rounded-md border px-3 py-2 text-sm" />
            {readSearchParam(resolvedSearchParams, "titleError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "titleError")}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="eventType" className="text-sm font-medium">
                Event type
              </label>
              <select id="eventType" name="eventType" defaultValue={eventType} className="w-full rounded-md border px-3 py-2 text-sm">
                {Object.values(EventType).map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())}
                  </option>
                ))}
              </select>
              {readSearchParam(resolvedSearchParams, "eventTypeError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "eventTypeError")}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <select id="status" name="status" defaultValue={status} className="w-full rounded-md border px-3 py-2 text-sm">
                {Object.values(EventStatus).map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())}
                  </option>
                ))}
              </select>
              {readSearchParam(resolvedSearchParams, "statusError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "statusError")}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="programId" className="text-sm font-medium">
                Program
              </label>
              <select id="programId" name="programId" defaultValue={programId} className="w-full rounded-md border px-3 py-2 text-sm">
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
              {readSearchParam(resolvedSearchParams, "programIdError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "programIdError")}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label htmlFor="teamId" className="text-sm font-medium">
                Team (optional)
              </label>
              <select id="teamId" name="teamId" defaultValue={teamId} className="w-full rounded-md border px-3 py-2 text-sm">
                <option value="">No team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} — {team.program.name}
                  </option>
                ))}
              </select>
              {readSearchParam(resolvedSearchParams, "teamIdError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "teamIdError")}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="startsAt" className="text-sm font-medium">
                Starts at
              </label>
              <input
                id="startsAt"
                name="startsAt"
                type="datetime-local"
                defaultValue={startsAt}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              {readSearchParam(resolvedSearchParams, "startsAtError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "startsAtError")}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <label htmlFor="endsAt" className="text-sm font-medium">
                Ends at (optional)
              </label>
              <input
                id="endsAt"
                name="endsAt"
                type="datetime-local"
                defaultValue={endsAt}
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              {readSearchParam(resolvedSearchParams, "endsAtError") ? (
                <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "endsAtError")}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="location" className="text-sm font-medium">
              Location (optional)
            </label>
            <input
              id="location"
              name="location"
              defaultValue={location}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            {readSearchParam(resolvedSearchParams, "locationError") ? (
              <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "locationError")}</p>
            ) : null}
          </div>

          <div className="flex gap-3">
            <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
              Create event
            </button>
            <Link href="/events" className="rounded-md border px-4 py-2 text-sm">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </section>
  );
}
