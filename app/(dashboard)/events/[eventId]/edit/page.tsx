import { EventStatus, EventType } from "@prisma/client";
import Link from "next/link";

import { db } from "@/lib/db";
import { getOrganizationScope } from "@/lib/organization-context";
import { formatDateTimeInputValue } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readSearchParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { eventId } = await params;
  const resolvedSearchParams = await searchParams;
  const scope = await getOrganizationScope();

  if (!scope.databaseReady) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit event</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {scope.errorMessage ?? "Unable to load event edit right now."}
          </p>
        </div>
      </section>
    );
  }

  if (!scope.organizationId) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit event</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No organization context is available yet.</p>
        </div>
      </section>
    );
  }

  let queryFailed = false;
  let event:
    | {
        id: string;
        title: string;
        eventType: string;
        status: string;
        programId: string;
        teamId: string | null;
        startsAt: Date;
        endsAt: Date | null;
        location: string | null;
      }
    | null = null;
  let programs: Array<{ id: string; name: string }> = [];
  let teams: Array<{ id: string; name: string; program: { id: string; name: string } }> = [];

  try {
    [event, programs, teams] = await Promise.all([
      db.event.findFirst({
        where: {
          id: eventId,
          organizationId: scope.organizationId,
        },
        select: {
          id: true,
          title: true,
          eventType: true,
          status: true,
          programId: true,
          teamId: true,
          startsAt: true,
          endsAt: true,
          location: true,
        },
      }),
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
            select: { id: true, name: true },
          },
        },
        orderBy: [{ name: "asc" }],
      }),
    ]);
  } catch {
    queryFailed = true;
  }

  if (queryFailed) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit event</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Unable to load event edit data right now. Please try again later.
          </p>
        </div>
      </section>
    );
  }

  if (!event) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit event</h2>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Event not found in the selected organization.</p>
        </div>
      </section>
    );
  }

  if (programs.length === 0) {
    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Edit event</h2>
        <div className="rounded-lg border bg-white p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          No programs are available for this organization yet.
        </div>
      </section>
    );
  }

  const title = readSearchParam(resolvedSearchParams, "title") || event.title;
  const eventType = readSearchParam(resolvedSearchParams, "eventType") || event.eventType || EventType.PRACTICE;
  const status = readSearchParam(resolvedSearchParams, "status") || event.status || EventStatus.DRAFT;
  const programId = readSearchParam(resolvedSearchParams, "programId") || event.programId;
  const teamId = readSearchParam(resolvedSearchParams, "teamId") || event.teamId || "";
  const startsAt = readSearchParam(resolvedSearchParams, "startsAt") || formatDateTimeInputValue(event.startsAt);
  const endsAt = readSearchParam(resolvedSearchParams, "endsAt") || formatDateTimeInputValue(event.endsAt);
  const location = readSearchParam(resolvedSearchParams, "location") || event.location || "";
  const generalError = readSearchParam(resolvedSearchParams, "error");

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Edit event</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Organization: {scope.organizationName ?? scope.organizationId}
        </p>
      </div>

      {generalError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="text-sm text-amber-900 dark:text-amber-200">{generalError}</p>
        </div>
      ) : null}

      <form action={`/events/${event.id}/edit/update`} method="post" className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
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
          <input id="location" name="location" defaultValue={location} className="w-full rounded-md border px-3 py-2 text-sm" />
          {readSearchParam(resolvedSearchParams, "locationError") ? (
            <p className="text-sm text-red-600">{readSearchParam(resolvedSearchParams, "locationError")}</p>
          ) : null}
        </div>

        <div className="flex gap-3">
          <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
            Save event
          </button>
          <Link href={`/events/${event.id}`} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
